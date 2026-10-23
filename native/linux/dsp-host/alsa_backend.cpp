/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The DSP host's output where PipeWire does not run: ALSA's "default" PCM,
 * which a PulseAudio desktop routes into PulseAudio (and so to the
 * listener's output), and which a bare system maps to the first card.
 *
 * `libasound.so.2` is opened at run time, as PipeWire is, and its handful of
 * functions are declared here by hand: they are ALSA's stable `snd_pcm_*`
 * ABI, unchanged since 1.0, and declaring them keeps the build free of a
 * header package the machine running it does not need either.
 *
 * The device thread blocks in `snd_pcm_writei` until the device has room —
 * the device's own period is the wait, never a clock of ours.
 *
 * Interleaved, though the host renders planar: PulseAudio's ALSA plugin
 * (the route on every PulseAudio desktop) takes interleaved access only, and
 * asking it for non-interleaved failed the open outright on Debian 12.
 */

#include <dlfcn.h>

#include <algorithm>
#include <atomic>
#include <cerrno>
#include <cstring>
#include <thread>
#include <vector>

#include "pipewire_backend.h"

namespace fluideq_linux {

namespace {

struct snd_pcm;  // Opaque, as ALSA's own header leaves it.
using snd_pcm_uframes_t = unsigned long;
using snd_pcm_sframes_t = long;

// ALSA's enum values, fixed by its ABI.
constexpr int kStreamPlayback = 0;      // SND_PCM_STREAM_PLAYBACK
constexpr int kFormatFloatLe = 14;      // SND_PCM_FORMAT_FLOAT_LE
constexpr int kAccessInterleaved = 3;  // SND_PCM_ACCESS_RW_INTERLEAVED
constexpr unsigned kRate = 48000;
// 80 ms, as the engine keeps on its PulseAudio route: PulseAudio's ALSA
// plugin, the path on every PulseAudio desktop, is not steady at 40 ms, and a
// press of play is still heard at once.
constexpr unsigned kLatencyMicros = 80000;
constexpr uint32_t kChannels = 2;
constexpr uint32_t kMaxBlock = 8192;

struct AlsaApi {
  int (*open)(snd_pcm** pcm, const char* name, int stream, int mode);
  int (*set_params)(snd_pcm* pcm, int format, int access, unsigned channels,
                    unsigned rate, int soft_resample, unsigned latency);
  int (*get_params)(snd_pcm* pcm, snd_pcm_uframes_t* buffer,
                    snd_pcm_uframes_t* period);
  snd_pcm_sframes_t (*writei)(snd_pcm* pcm, const void* buffer,
                              snd_pcm_uframes_t size);
  int (*recover)(snd_pcm* pcm, int err, int silent);
  int (*drop)(snd_pcm* pcm);
  int (*close)(snd_pcm* pcm);
  const char* (*strerror)(int errnum);
};

const AlsaApi* alsa_api(std::string& error) {
  static const AlsaApi* const loaded = [] () -> const AlsaApi* {
    void* library = dlopen("libasound.so.2", RTLD_NOW | RTLD_LOCAL);
    if (library == nullptr) return nullptr;
    static AlsaApi api{};
    const auto bind = [library](const char* name, auto& slot) {
      void* symbol = dlsym(library, name);
      slot = reinterpret_cast<std::remove_reference_t<decltype(slot)>>(symbol);
      return symbol != nullptr;
    };
    const bool ok = bind("snd_pcm_open", api.open) &&
                    bind("snd_pcm_set_params", api.set_params) &&
                    bind("snd_pcm_get_params", api.get_params) &&
                    bind("snd_pcm_writei", api.writei) &&
                    bind("snd_pcm_recover", api.recover) &&
                    bind("snd_pcm_drop", api.drop) &&
                    bind("snd_pcm_close", api.close) &&
                    bind("snd_strerror", api.strerror);
    return ok ? &api : nullptr;
  }();
  if (loaded == nullptr) error = "ALSA (libasound.so.2) is not installed";
  return loaded;
}

class AlsaBackend final : public IAudioOutputBackend {
 public:
  AlsaBackend(const AlsaApi& api, const FeqBackendHooks& hooks)
      : api_(api), hooks_(hooks) {}
  ~AlsaBackend() override { close(); }

  bool open(FeqBackendFormat& negotiated, std::string& error) override {
    close();
    absent_ = false;
    int result = api_.open(&pcm_, "default", kStreamPlayback, 0);
    if (result < 0) {
      absent_ = result == -ENOENT || result == -ENODEV;
      error = std::string("ALSA: ") + api_.strerror(result);
      pcm_ = nullptr;
      return false;
    }
    result = api_.set_params(pcm_, kFormatFloatLe, kAccessInterleaved,
                             kChannels, kRate, 1, kLatencyMicros);
    snd_pcm_uframes_t buffer = 0;
    snd_pcm_uframes_t period = 0;
    if (result >= 0) result = api_.get_params(pcm_, &buffer, &period);
    if (result < 0 || period == 0) {
      error = std::string("ALSA: ") +
              (result < 0 ? api_.strerror(result) : "no period size");
      close();
      return false;
    }
    // A quarter of the buffer at most per write. PulseAudio's ALSA plugin
    // reports its whole buffer as one period, and writing a whole buffer at a
    // time left the device nothing queued while the next was rendered:
    // 4.1 s rendered in a 6 s hold on Debian 12.
    if (buffer > 0 && period > buffer / 2) period = std::max<snd_pcm_uframes_t>(buffer / 4, 1);
    period_ = static_cast<uint32_t>(std::min<snd_pcm_uframes_t>(period, kMaxBlock));
    buffer_frames_ = static_cast<uint32_t>(buffer);
    for (auto& plane : planes_) plane.assign(period_, 0.0f);
    interleaved_.assign(static_cast<size_t>(period_) * kChannels, 0.0f);
    negotiated.sample_rate = kRate;
    negotiated.channels = kChannels;
    negotiated.max_block_frames = period_;
    return true;
  }

  bool endpoint_absent() const override { return absent_; }

  bool start(std::string& error) override {
    if (pcm_ == nullptr) {
      error = "ALSA: not open";
      return false;
    }
    stopping_.store(false, std::memory_order_release);
    running_.store(true, std::memory_order_release);
    try {
      thread_ = std::thread([this] { run(); });
    } catch (...) {
      running_.store(false, std::memory_order_release);
      error = "ALSA: could not start the device thread";
      return false;
    }
    return true;
  }

  void close() override {
    stopping_.store(true, std::memory_order_release);
    // Returns within one period: the thread is waiting on the device, which
    // takes a period's worth of frames and lets the write return.
    if (thread_.joinable()) thread_.join();
    running_.store(false, std::memory_order_release);
    if (pcm_ != nullptr) {
      api_.drop(pcm_);
      api_.close(pcm_);
      pcm_ = nullptr;
    }
  }

  bool is_open() const override { return pcm_ != nullptr; }
  bool is_running() const override {
    return running_.load(std::memory_order_acquire);
  }

  FeqBackendStats stats() const override {
    FeqBackendStats out;
    out.underruns = underruns_.load(std::memory_order_relaxed);
    out.periods = periods_.load(std::memory_order_relaxed);
    out.buffer_frames = pcm_ != nullptr ? buffer_frames_ : 0;
    return out;
  }

  bool needs_reopen() const override {
    return reopen_.load(std::memory_order_acquire);
  }
  void clear_reopen() override {
    reopen_.store(false, std::memory_order_release);
  }

  const char* name() const override { return "alsa"; }

 private:
  void run() noexcept {
    float* planes[kChannels] = {planes_[0].data(), planes_[1].data()};
    while (!stopping_.load(std::memory_order_acquire)) {
      for (auto& plane : planes_) std::fill(plane.begin(), plane.end(), 0.0f);
      if (hooks_.render != nullptr) hooks_.render(hooks_.context, planes, period_);
      for (uint32_t f = 0; f < period_; ++f) {
        for (uint32_t c = 0; c < kChannels; ++c) {
          interleaved_[static_cast<size_t>(f) * kChannels + c] = planes[c][f];
        }
      }
      snd_pcm_uframes_t written = 0;
      while (written < period_ && !stopping_.load(std::memory_order_acquire)) {
        const snd_pcm_sframes_t result =
            api_.writei(pcm_, interleaved_.data() + written * kChannels,
                        period_ - written);
        if (result >= 0) {
          written += static_cast<snd_pcm_uframes_t>(result);
          continue;
        }
        if (result == -EPIPE) underruns_.fetch_add(1, std::memory_order_relaxed);
        if (api_.recover(pcm_, static_cast<int>(result), 1) < 0) {
          // The device went: the host closes, and opens again on request.
          running_.store(false, std::memory_order_release);
          reopen_.store(true, std::memory_order_release);
          if (hooks_.reopen_wanted != nullptr) hooks_.reopen_wanted(hooks_.context);
          return;
        }
      }
      periods_.fetch_add(1, std::memory_order_relaxed);
      if (hooks_.period_done != nullptr) hooks_.period_done(hooks_.context);
    }
  }

  const AlsaApi& api_;
  const FeqBackendHooks hooks_;
  snd_pcm* pcm_ = nullptr;
  uint32_t period_ = 0;
  uint32_t buffer_frames_ = 0;
  bool absent_ = false;
  std::vector<float> planes_[kChannels];
  std::vector<float> interleaved_;
  std::thread thread_;
  std::atomic<bool> stopping_{false};
  std::atomic<bool> running_{false};
  std::atomic<bool> reopen_{false};
  std::atomic<uint64_t> underruns_{0};
  std::atomic<uint64_t> periods_{0};
};

}  // namespace

std::unique_ptr<IAudioOutputBackend> make_alsa_backend(
    const FeqBackendHooks& hooks, std::string& error) {
  const AlsaApi* api = alsa_api(error);
  if (api == nullptr) return nullptr;
  return std::make_unique<AlsaBackend>(*api, hooks);
}

}  // namespace fluideq_linux
