/* FluidEQ — GPL-3.0-or-later */
#include "lan.h"
#include "audio_backend.h"
#include "output_devices.h"
#include "playback_core.h"
#include <algorithm>
#include <array>
#include <atomic>
#include <cctype>
#include <vector>

std::unique_ptr<IAudioOutputBackend> create_coreaudio_backend_for_device(
    const FeqBackendHooks&, uint32_t);

namespace feq::maclan {
namespace {
AudioObjectID resolve_output(std::string guid) {
  if (guid.empty()) return fluideq_mac::default_output_device();
  std::transform(guid.begin(), guid.end(), guid.begin(), [](unsigned char c) {
    return static_cast<char>(std::toupper(c));
  });
  AudioObjectPropertyAddress property{kAudioHardwarePropertyDevices,
      kAudioObjectPropertyScopeGlobal, kAudioObjectPropertyElementMain};
  UInt32 size = 0;
  if (AudioObjectGetPropertyDataSize(kAudioObjectSystemObject, &property, 0, nullptr, &size) != noErr) return kAudioObjectUnknown;
  std::vector<AudioObjectID> devices(size / sizeof(AudioObjectID));
  if (AudioObjectGetPropertyData(kAudioObjectSystemObject, &property, 0, nullptr, &size, devices.data()) != noErr) return kAudioObjectUnknown;
  for (const auto device : devices)
    if (fluideq_mac::endpoint_guid(fluideq_mac::device_uid(device)) == guid) return device;
  return kAudioObjectUnknown;
}
}

struct Playback::State {
  State(Replies& out, Wake& changes) : replies(out), wake(changes) {}
  ~State() { close(); }
  bool open(const std::string& output, std::string& error) {
    close();
    guid = output;
    const auto device = resolve_output(guid);
    if (device == kAudioObjectUnknown) { error = "The selected Share Audio output is unavailable"; return false; }
    backend = create_coreaudio_backend_for_device({render, nullptr, changed, this}, device);
    if (!backend->open(format, error) || format.channels != 2 ||
        format.max_block_frames == 0 || format.max_block_frames > 65536) {
      close(); return false;
    }
    scratch.assign(static_cast<size_t>(format.max_block_frames) * 2, 0.0f);
    for (const auto& peer : peers) if (peer) {
      if (!peer->output_format(format.sample_rate, 2, 3)) { close(); return false; }
      peer->reset();
    }
    if (!backend->start(error)) { close(); return false; }
    const auto stats = backend->stats();
    const double delay = static_cast<double>(stats.buffer_frames) * 1000 / format.sample_rate;
    return replies.send(6, 0, format.sample_rate, &delay, sizeof(delay));
  }
  void close() {
    if (backend) backend->close();
    backend.reset();
    retired.clear();
  }
  bool push(const Header& h, const float* samples, uint32_t sequence) {
    if (h.id == 0 || h.id > remote::kMaxPeers || h.rate < 8000 || h.rate > 384000 ||
        h.channels == 0 || h.channels > remote::kMaxChannels ||
        h.frames == 0 || h.frames > remote::kMaxPacketFrames) return false;
    if (!backend || !backend->is_running()) return true;
    reclaim();
    if (retired.size() >= 64) return false;
    auto& peer = peers[h.id - 1];
    if (!peer || peer->source_rate() != h.rate || peer->source_channels() != h.channels) {
      auto next = std::make_unique<remote::PeerPlayback>(h.rate, h.channels);
      if (!next->output_format(format.sample_rate, 2, 3)) return false;
      audible[h.id - 1].store(next.get());
      if (peer) retired.push_back({std::move(peer), blocks.load()});
      peer = std::move(next);
    }
    peer->push(samples, h.frames, sequence);
    metered[h.id - 1] += h.frames;
    if (metered[h.id - 1] >= h.rate / 30) {
      metered[h.id - 1] = 0;
      const auto stats = peer->stats();
      const double values[]{stats.buffered_ms, stats.peak, stats.rms};
      return replies.send(5, h.id, h.rate, values, sizeof(values));
    }
    return true;
  }
  void remove(uint32_t id) {
    if (id == 0 || id > remote::kMaxPeers) return;
    audible[id - 1].store(nullptr);
    if (peers[id - 1]) retired.push_back({std::move(peers[id - 1]), blocks.load()});
    metered[id - 1] = 0;
    reclaim();
  }
  void reclaim() {
    if (!backend || !backend->is_running()) { retired.clear(); return; }
    const auto block = blocks.load();
    std::erase_if(retired, [block](const Retired& old) { return block - old.block >= 2; });
  }
  static void changed(void* context) { static_cast<State*>(context)->wake.notify(); }
  static void render(void* context, float* const* output, uint32_t frames) {
    auto& self = *static_cast<State*>(context);
    if (frames > self.format.max_block_frames) return;
    std::fill_n(self.scratch.data(), static_cast<size_t>(frames) * 2, 0.0f);
    for (const auto& entry : self.audible) if (auto* peer = entry.load()) peer->mix(self.scratch.data(), frames);
    const float to = self.volume.load();
    const float step = frames == 0 ? 0 : (to - self.volume_now) / frames;
    for (uint32_t f = 0; f < frames; ++f) {
      self.volume_now += step;
      for (uint32_t c = 0; c < 2; ++c) output[c][f] = self.scratch[f * 2 + c] * self.volume_now;
    }
    self.volume_now = to;
    self.blocks.fetch_add(1);
  }
  struct Retired { std::unique_ptr<remote::PeerPlayback> peer; uint64_t block; };
  Replies& replies; Wake& wake;
  std::string guid;
  std::unique_ptr<IAudioOutputBackend> backend;
  FeqBackendFormat format;
  std::array<std::unique_ptr<remote::PeerPlayback>, remote::kMaxPeers> peers{};
  std::array<std::atomic<remote::PeerPlayback*>, remote::kMaxPeers> audible{};
  std::array<uint32_t, remote::kMaxPeers> metered{};
  std::vector<Retired> retired;
  std::vector<float> scratch;
  std::atomic<uint64_t> blocks{0};
  std::atomic<float> volume{1};
  float volume_now = 1;
};

Playback::Playback(Replies& replies, Wake& wake) : state_(std::make_unique<State>(replies, wake)) {}
Playback::~Playback() = default;
bool Playback::open(const std::string& guid, std::string& error) { return state_->open(guid, error); }
void Playback::close() { state_->close(); }
void Playback::service() {
  if (state_->backend && state_->backend->needs_reopen()) {
    const auto guid = state_->guid;
    std::string error;
    if (!state_->open(guid, error)) {
      state_->replies.send(4, 0, 0x80004005);
    }
  }
}
bool Playback::push(const Header& h, const float* samples, uint32_t sequence) { return state_->push(h, samples, sequence); }
void Playback::remove(uint32_t id) { state_->remove(id); }
void Playback::reset() { for (uint32_t id = 1; id <= remote::kMaxPeers; ++id) state_->remove(id); }
void Playback::volume(float value) { state_->volume.store(value); }
}  // namespace feq::maclan
