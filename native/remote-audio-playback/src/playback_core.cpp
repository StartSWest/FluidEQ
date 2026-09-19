/* FluidEQ — GPL-3.0-or-later */
#include "playback_core.h"
#include "sinc_kernel.h"
#include <algorithm>
#include <array>
#include <atomic>
#include <cmath>
#include <vector>

namespace feq::remote {
struct PeerPlayback::State {
  const std::uint32_t rate;
  const std::uint16_t channels;
  const std::uint32_t capacity;
  std::vector<float> ring;
  std::atomic<std::uint64_t> written{0}, released{0}, restart{0};
  std::atomic<std::uint32_t> epoch{0};
  std::uint32_t producer_sequence = 0, consumer_epoch = 0;
  bool has_sequence = false, playing = false;
  std::uint32_t output_rate = 48000;
  std::uint16_t output_channels = 2;
  std::vector<float> kernel;
  double position = 0, start = 0, gain = 0, target_ms = 30, correction = 0;
  double filtered_error = 0;
  std::uint64_t stable_frames = 0;
  std::array<float, kMaxChannels> last{};
  std::array<std::array<float, kMaxChannels>, kMaxChannels> matrix{};
  std::atomic<double> buffered{0}, target{30}, ppm{0}, peak{0}, rms{0};
  std::atomic<std::uint64_t> underruns{0}, discontinuities{0}, trimmed{0};
  State(std::uint32_t hz, std::uint16_t count)
      : rate(hz), channels(count), capacity(hz / 2 + 128),
        ring(static_cast<size_t>(capacity) * count, 0) {}
};

PeerPlayback::PeerPlayback(std::uint32_t rate, std::uint16_t channels)
    : state_(std::make_unique<State>(rate, channels)) {}
PeerPlayback::~PeerPlayback() = default;

bool PeerPlayback::output_format(std::uint32_t rate, std::uint16_t channels,
                                 std::uint32_t speaker_mask) {
  auto& s = *state_;
  if (rate < 8000 || rate > 384000 || channels == 0 || channels > kMaxChannels ||
      s.rate < 8000 || s.rate > 384000 || s.channels == 0 || s.channels > kMaxChannels) return false;
  s.output_rate = rate;
  s.output_channels = channels;
  s.kernel = sinc_kernel(static_cast<double>(rate) / s.rate);
  s.matrix = {};
  // Windows canonical order. Stereo to surround stays at the front; it is
  // the receiver's Room effect, not the transport, that may upmix it.
  if (channels >= s.channels && s.channels != 1) {
    for (unsigned c = 0; c < s.channels; ++c) s.matrix[c][c] = 1;
  } else if (s.channels == 1) {
    s.matrix[0][0] = 1;
    if (channels > 1) s.matrix[1][0] = 1;
  } else {
    std::array<std::uint32_t, kMaxChannels> source{};
    const std::uint32_t mask = s.channels == 6 ? 0x3f : s.channels == 8 ? 0x63f : (1u << s.channels) - 1;
    unsigned n = 0;
    for (unsigned bit = 0; bit < 18 && n < s.channels; ++bit) if (mask & (1u << bit)) source[n++] = 1u << bit;
    if (channels == 2 || channels == 1) {
      for (unsigned c = 0; c < s.channels; ++c) {
        const auto speaker = source[c];
        s.matrix[0][c] = speaker == 1 ? 1.F : speaker == 4 ? 0.70710678F : speaker == 8 ? 0.25F : (speaker == 16 || speaker == 512) ? 0.5F : 0.F;
        s.matrix[1][c] = speaker == 2 ? 1.F : speaker == 4 ? 0.70710678F : speaker == 8 ? 0.25F : (speaker == 32 || speaker == 1024) ? 0.5F : 0.F;
        if (channels == 1) s.matrix[0][c] = 0.5F * (s.matrix[0][c] + s.matrix[1][c]);
      }
    } else {
      // Map matching speakers; side/rear surround fold together when one
      // layout has fewer surrounds. LFE never becomes a full-range channel.
      unsigned out = 0;
      for (unsigned bit = 0; bit < 18 && out < channels; ++bit) {
        if ((speaker_mask & (1u << bit)) == 0) continue;
        for (unsigned c = 0; c < s.channels; ++c) {
          const auto src = source[c], dst = 1u << bit;
          if (src == dst || ((src == 512 || src == 16) && (dst == 512 || dst == 16)) ||
              ((src == 1024 || src == 32) && (dst == 1024 || dst == 32))) s.matrix[out][c] = 1;
        }
        ++out;
      }
    }
  }
  return true;
}

bool PeerPlayback::push(const float* samples, std::uint32_t frames,
                        std::uint32_t sequence) noexcept {
  auto& s = *state_;
  if (samples == nullptr || frames == 0 || frames > kMaxPacketFrames) return false;
  const auto written = s.written.load(std::memory_order_relaxed);
  if (s.has_sequence && sequence != s.producer_sequence + 1) {
    s.restart.store(written);
    s.epoch.fetch_add(1);
    s.discontinuities.fetch_add(1);
  }
  s.producer_sequence = sequence;
  s.has_sequence = true;
  if (written - s.released.load(std::memory_order_acquire) + frames > s.capacity) {
    s.restart.store(written);
    s.epoch.fetch_add(1);
    s.trimmed.fetch_add(frames);
    return false;
  }
  for (std::uint32_t f = 0; f < frames; ++f) {
    const auto at = static_cast<size_t>((written + f) % s.capacity) * s.channels;
    for (unsigned c = 0; c < s.channels; ++c) {
      const float value = samples[static_cast<size_t>(f) * s.channels + c];
      s.ring[at + c] = std::isfinite(value) ? value : 0;
    }
  }
  s.written.store(written + frames, std::memory_order_release);
  return true;
}

void PeerPlayback::mix(float* output, std::uint32_t frames) noexcept {
  auto& s = *state_;
  if (output == nullptr || s.kernel.empty()) return;
  const auto epoch = s.epoch.load();
  if (epoch != s.consumer_epoch) {
    s.consumer_epoch = epoch;
    s.position = s.start = static_cast<double>(s.restart.load());
    s.released.store(static_cast<std::uint64_t>(s.position), std::memory_order_release);
    s.playing = false;
    // Keep the last sample and fade it down while the new sequence primes.
    s.correction = 0;
    s.stable_frames = 0;
  }
  const auto written = s.written.load(std::memory_order_acquire);
  const double available = static_cast<double>(written) - s.position;
  const double target_frames = s.target_ms * s.rate / 1000;
  if (!s.playing && s.gain == 0 && available >= target_frames + 32) {
    s.playing = true;
    s.gain = 0;
    s.filtered_error = 0;
  }
  if (s.playing) {
    const double error = (available - target_frames) / s.rate;
    const double alpha = std::min(1.0, static_cast<double>(frames) / s.output_rate);
    s.filtered_error += alpha * (error - s.filtered_error);
    s.correction += std::clamp(s.filtered_error * 0.003, -0.000002, 0.000002);
    s.correction = std::clamp(s.correction, -0.001, 0.001);
    s.stable_frames += frames;
    if (s.stable_frames >= static_cast<std::uint64_t>(s.output_rate) * 60) {
      s.target_ms = std::max(15.0, s.target_ms - 1);
      s.stable_frames = 0;
    }
  }
  const double step = static_cast<double>(s.rate) / s.output_rate * (1 + s.correction);
  const double fade_step = 1.0 / std::max(1.0, s.output_rate * 0.003);
  double peak = 0, square = 0;
  for (std::uint32_t f = 0; f < frames; ++f) {
    std::array<float, kMaxChannels> input{};
    if (s.playing && s.position + 33 >= static_cast<double>(written)) {
      s.playing = false;
      s.underruns.fetch_add(1);
      s.target_ms = std::min(160.0, s.target_ms + 10);
      s.stable_frames = 0;
      s.correction = 0;
    }
    if (s.playing) {
      const auto whole = static_cast<std::uint64_t>(s.position);
      const double fraction = s.position - static_cast<double>(whole);
      const double phase = fraction * kSincPhases;
      const auto a = static_cast<unsigned>(phase);
      const float blend = static_cast<float>(phase - a);
      for (unsigned c = 0; c < s.channels; ++c) {
        if (s.rate == s.output_rate && fraction < 1e-10) {
          input[c] = s.ring[static_cast<size_t>(whole % s.capacity) * s.channels + c];
        } else {
          double value = 0;
          for (unsigned tap = 0; tap < kSincTaps; ++tap) {
            const double source = static_cast<double>(whole) + tap - 31;
            if (source < s.start) continue;
            const auto index = static_cast<std::uint64_t>(source);
            const float weight = s.kernel[a * kSincTaps + tap] * (1 - blend) +
                                 s.kernel[(a + 1) * kSincTaps + tap] * blend;
            value += s.ring[static_cast<size_t>(index % s.capacity) * s.channels + c] * weight;
          }
          input[c] = static_cast<float>(value);
        }
      }
      s.position += step;
      s.gain = std::min(1.0, s.gain + fade_step);
    } else {
      s.gain = std::max(0.0, s.gain - fade_step);
    }
    for (unsigned out = 0; out < s.output_channels; ++out) {
      float sample = 0;
      if (s.playing) {
        for (unsigned c = 0; c < s.channels; ++c) sample += input[c] * s.matrix[out][c];
        s.last[out] = sample;
      } else sample = s.last[out];
      sample *= static_cast<float>(s.gain);
      output[static_cast<size_t>(f) * s.output_channels + out] += sample;
      peak = std::max(peak, static_cast<double>(std::abs(sample)));
      square += static_cast<double>(sample) * sample;
    }
  }
  const double releasable = std::max(s.start, std::floor(s.position) - 32);
  s.released.store(static_cast<std::uint64_t>(releasable), std::memory_order_release);
  s.buffered.store(std::max(0.0, static_cast<double>(written) - s.position) * 1000 / s.rate);
  s.target.store(s.target_ms);
  s.ppm.store(s.correction * 1e6);
  s.peak.store(peak);
  s.rms.store(frames == 0 ? 0 : std::sqrt(square / (frames * s.output_channels)));
}
void PeerPlayback::reset() noexcept {
  state_->restart.store(state_->written.load());
  state_->epoch.fetch_add(1);
}
PlaybackStats PeerPlayback::stats() const noexcept {
  const auto& s = *state_;
  return {s.buffered.load(), s.target.load(), s.ppm.load(), s.peak.load(),
          s.rms.load(), s.underruns.load(), s.discontinuities.load(), s.trimmed.load()};
}
std::uint32_t PeerPlayback::source_rate() const noexcept { return state_->rate; }
std::uint16_t PeerPlayback::source_channels() const noexcept { return state_->channels; }
}
