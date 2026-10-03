/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "split_reader.h"

#include <algorithm>
#include <cmath>

#include "channel_layout.h"
// Share Audio's own kernel, so both of FluidEQ's players that follow another
// device's clock interpolate the same way.
#include "sinc_kernel.h"

namespace fluideq_engine {

namespace {

using feq::remote::kSincPhases;
using feq::remote::kSincTaps;

/** The kernel reads 31 frames behind a position and 32 past it. */
constexpr double kLead = 31;
constexpr double kTail = 33;

constexpr double kMarginStart = 0.002;
constexpr double kMarginStep = 0.001;
constexpr double kMarginMost = 0.040;
constexpr double kMarginGiveBack = 0.0005;
constexpr double kSteadySeconds = 30;
/**
 * How long a distance error takes to be played out. Slow enough that the
 * pitch change is far under anything heard — 1 ms of error moves the rate
 * by 0.05% — and fast enough to follow any clock a device keeps.
 */
constexpr double kHoldSeconds = 2.0;
/**
 * And how long the steady part of the trim — the two clocks' own difference
 * — takes to be learned. Without it the distance settles off its target by
 * the drift times `kHoldSeconds`: 0.4 ms at 200 ppm, measured. Five times
 * `kHoldSeconds` is past the four that settle without overshoot, leaving room
 * for the half second the distance is averaged over.
 */
constexpr double kLearnSeconds = 10.0;
constexpr double kMostTrim = 0.005;
/** The distance read each block is averaged over this long before it steers. */
constexpr double kLagSeconds = 0.5;
/** Further behind than the distance plus this is a stall: start again. */
constexpr double kTooFarSeconds = 0.050;
/**
 * A writer that writes again within this many of its blocks of when its
 * sound was missed was late; one gone longer had stopped.
 */
constexpr double kLateBlocks = 3.0;
constexpr double kFadeSeconds = 0.005;
constexpr double kVolumeSeconds = 0.020;

constexpr float kHalfPower = 0.70710678f;

}  // namespace

SplitKernel::SplitKernel(uint32_t source_rate, uint32_t target_rate)
    : source_rate_(source_rate),
      table_(feq::remote::sinc_kernel(static_cast<double>(target_rate) /
                                      static_cast<double>(source_rate))) {}

SplitReader::SplitReader(uint32_t rate, uint32_t channels,
                         unsigned long mask) noexcept
    : rate_(rate),
      channels_(std::min<uint32_t>(channels, SplitRing::kStride)),
      mask_(mask) {
  restart();
}

void SplitReader::restart() noexcept {
  have_clock_ = false;
  generation_ = 0;
  synced_ = false;
  state_ = SplitState::off;
  wanted_rate_ = 0;
  late_pending_ = false;
  late_from_ = 0;
  position_ = 0;
  margin_ = kMarginStart;
  lag_ = 0;
  drift_ = 0;
  steady_frames_ = 0;
  fade_ = 0;
  last_ = {};
  matrix_ = {};
}

bool SplitReader::become(SplitState state, SplitStats& stats) noexcept {
  if (state == state_) {
    return false;
  }
  state_ = state;
  stats.state.store(static_cast<uint32_t>(state), std::memory_order_relaxed);
  return true;
}

void SplitReader::build_matrix(const SplitRing::Clock& clock) noexcept {
  matrix_ = {};
  const auto in = static_cast<unsigned short>(clock.channels);
  const auto out = static_cast<unsigned short>(channels_);
  if (in == out && clock.mask == mask_) {
    for (unsigned channel = 0; channel < out; ++channel) {
      matrix_[channel][channel] = 1.0f;
    }
    return;
  }
  // The second output's channel for each of the room's speakers, or -1.
  std::array<int, kRoomSpeakers> to{};
  to.fill(-1);
  for (unsigned channel = 0; channel < out; ++channel) {
    const int speaker = speaker_of_channel(mask_, out, channel);
    if (speaker >= 0 && to[speaker] < 0) {
      to[speaker] = static_cast<int>(channel);
    }
  }
  const auto route = [&](unsigned from, int speaker, float weight) {
    if (speaker >= 0 && to[speaker] >= 0) {
      matrix_[to[speaker]][from] += weight;
      return true;
    }
    return false;
  };
  if (out == 1) {
    // A mono output: the fronts at half each, the centre at half power and
    // the surrounds at 0.35, which keeps a 5.1 mix's balance in one speaker.
    for (unsigned channel = 0; channel < in; ++channel) {
      const int speaker = speaker_of_channel(clock.mask, in, channel);
      matrix_[0][channel] = in == 1          ? 1.0f
                            : speaker <= 1   ? (speaker < 0 ? 0.0f : 0.5f)
                            : speaker == 2   ? kHalfPower
                                             : 0.35f;
    }
    return;
  }
  const int lfe = lfe_channel_of(clock.mask, in);
  for (unsigned channel = 0; channel < in; ++channel) {
    if (static_cast<int>(channel) == lfe) {
      continue;  // Its bass is in the main channels already, as in any fold.
    }
    const int speaker = in == 1 ? -2 : speaker_of_channel(clock.mask, in, channel);
    if (speaker == -2) {
      // Mono: both fronts, at half power each.
      route(channel, 0, kHalfPower);
      route(channel, 1, kHalfPower);
      continue;
    }
    if (speaker < 0) {
      // A position the layout has no name for keeps its place, if it can.
      if (channel < out && speaker_of_channel(mask_, out, channel) < 0) {
        matrix_[channel][channel] = 1.0f;
      }
      continue;
    }
    if (route(channel, speaker, 1.0f)) {
      continue;
    }
    // The second output has no such speaker: the nearest one it has.
    const bool left = speaker == 0 || speaker == 3 || speaker == 5;
    switch (speaker) {
      case 2:
        route(channel, 0, kHalfPower);
        route(channel, 1, kHalfPower);
        break;
      case 3:
      case 4:
        if (!route(channel, speaker + 2, 1.0f)) {
          route(channel, left ? 0 : 1, kHalfPower);
        }
        break;
      case 5:
      case 6:
        if (!route(channel, speaker - 2, 1.0f)) {
          route(channel, left ? 0 : 1, kHalfPower);
        }
        break;
      default:
        route(channel, 2, kHalfPower);
        break;
    }
  }
}

void SplitReader::fade_out(float* const* planes, uint32_t frames) noexcept {
  const float step = static_cast<float>(1.0 / (kFadeSeconds * rate_));
  for (uint32_t frame = 0; frame < frames && fade_ > 0.0f; ++frame) {
    fade_ = std::max(0.0f, fade_ - step);
    for (uint32_t channel = 0; channel < channels_; ++channel) {
      planes[channel][frame] += last_[channel] * gain_ * fade_;
    }
  }
}

bool SplitReader::idle(float* const* planes, uint32_t frames,
                       SplitStats& stats) noexcept {
  synced_ = false;
  fade_out(planes, frames);
  return become(SplitState::waiting, stats);
}

bool SplitReader::mix(const SplitRing& ring, const SplitKernel* kernel,
                      float volume, float* const* planes, uint32_t frames,
                      int64_t now, int64_t ticks_per_second,
                      SplitStats& stats) noexcept {
  SplitRing::Clock read;
  if (ring.clock(&read)) {
    clock_ = read;
    have_clock_ = true;
  }
  if (!have_clock_ || clock_.rate == 0 || clock_.channels == 0 ||
      clock_.channels > SplitRing::kStride || ticks_per_second <= 0 ||
      rate_ == 0 || channels_ == 0) {
    synced_ = false;
    fade_out(planes, frames);
    return become(SplitState::waiting, stats);
  }
  if (kernel == nullptr || kernel->source_rate() != clock_.rate) {
    const bool asked = wanted_rate_ != clock_.rate;
    wanted_rate_ = clock_.rate;
    synced_ = false;
    fade_out(planes, frames);
    return become(SplitState::waiting, stats) || asked;
  }
  wanted_rate_ = 0;
  if (clock_.generation != generation_) {
    generation_ = clock_.generation;
    build_matrix(clock_);
    synced_ = false;
  }

  const double source_rate = clock_.rate;
  const double since =
      static_cast<double>(now - clock_.ticks) / static_cast<double>(ticks_per_second);
  const double block =
      static_cast<double>(clock_.end - clock_.block_start) / source_rate;
  bool changed = false;
  // The writer's sound was not there in time, and now it has written again:
  // only now can a late block be told from a stopped stream. A block that
  // came within a few of its periods was late, and the margin grows; a
  // longer gap was the main output stopping — a song paused, its stream
  // closed — which is no fault of the margin's and costs it nothing.
  if (late_pending_ && clock_.ticks != late_from_) {
    late_pending_ = false;
    const double gap = static_cast<double>(clock_.ticks - late_from_) /
                       static_cast<double>(ticks_per_second);
    if (gap < kLateBlocks * block) {
      margin_ = std::min(kMarginMost, margin_ + kMarginStep);
      stats.underruns.fetch_add(1, std::memory_order_relaxed);
      changed = true;
    }
  }
  // Nothing written for a block's length and as long again: the main output
  // has stopped — its last stream closed, or Windows paused its engine — and
  // what is in the ring is the past, not something to play again.
  if (since > 2.0 * block + kMarginStart || since < -block) {
    synced_ = false;
    fade_out(planes, frames);
    return become(SplitState::waiting, stats) || changed;
  }
  const double writer_at =
      static_cast<double>(clock_.block_start) + since * source_rate;
  const double ratio = source_rate / rate_;
  const double span = frames * ratio * (1.0 + kMostTrim) + kTail;
  const auto sync = [&] {
    position_ = writer_at - (span + margin_ * source_rate);
    lag_ = writer_at - position_;
    steady_frames_ = 0;
    synced_ = true;
  };
  if (!synced_) {
    if (fade_ > 0.0f) {
      // A clock/rate change or stall affects only this receiver. Finish the
      // old signal's fade before moving its read position, then fade back in.
      fade_out(planes, frames);
      return become(SplitState::waiting, stats) || changed;
    }
    sync();
  }
  // The oldest frame the kernel may reach back to: still in the ring, and
  // written at all — a writer that has only just started has less than one
  // read's worth behind it.
  const double oldest = std::max(
      0.0, static_cast<double>(clock_.end) - SplitRing::kFrames) + kLead;
  const auto unreadable = [&] {
    return position_ + span > static_cast<double>(clock_.end) ||
           position_ < oldest;
  };
  const bool late = position_ + span > static_cast<double>(clock_.end);
  if (unreadable() ||
      writer_at - position_ > span + (margin_ + kTooFarSeconds) * source_rate) {
    if (late && state_ == SplitState::playing && !late_pending_) {
      late_pending_ = true;
      late_from_ = clock_.ticks;
    }
    changed = true;
    synced_ = false;
    if (fade_ > 0.0f) {
      fade_out(planes, frames);
      return become(SplitState::waiting, stats) || changed;
    }
    sync();
    if (unreadable()) {
      // Still not there: a writer later than the margin allows, or one that
      // has only just begun. The next block looks again.
      synced_ = false;
      fade_out(planes, frames);
      return become(SplitState::waiting, stats) || changed;
    }
  }

  lag_ += (writer_at - position_ - lag_) *
          std::min(1.0, frames / (kLagSeconds * rate_));
  const double target = span + margin_ * source_rate;
  const double error = (lag_ - target) / (source_rate * kHoldSeconds);
  drift_ = std::clamp(drift_ + error * frames / (kLearnSeconds * rate_),
                      -kMostTrim, kMostTrim);
  const double trim = std::clamp(error + drift_, -kMostTrim, kMostTrim);
  const double step = ratio * (1.0 + trim);

  const float* const table = kernel->table();
  const float fade_step = static_cast<float>(1.0 / (kFadeSeconds * rate_));
  const float volume_step = static_cast<float>(1.0 / (kVolumeSeconds * rate_));
  const double first = position_;
  std::array<float, kSincTaps> weights{};
  std::array<float, SplitRing::kStride> input{};
  for (uint32_t frame = 0; frame < frames; ++frame) {
    const double whole = std::floor(position_);
    const double phase = (position_ - whole) * kSincPhases;
    const auto lower = static_cast<unsigned>(phase);
    const float blend = static_cast<float>(phase - lower);
    const float* const a = table + static_cast<size_t>(lower) * kSincTaps;
    const float* const b = a + kSincTaps;
    for (unsigned tap = 0; tap < kSincTaps; ++tap) {
      weights[tap] = a[tap] + (b[tap] - a[tap]) * blend;
    }
    const auto origin = static_cast<uint64_t>(whole) - 31;
    for (uint32_t channel = 0; channel < clock_.channels; ++channel) {
      float value = 0.0f;
      for (unsigned tap = 0; tap < kSincTaps; ++tap) {
        value += ring.at(origin + tap, channel) * weights[tap];
      }
      input[channel] = value;
    }
    fade_ = std::min(1.0f, fade_ + fade_step);
    gain_ = gain_ < volume ? std::min(volume, gain_ + volume_step)
                           : std::max(volume, gain_ - volume_step);
    for (uint32_t out = 0; out < channels_; ++out) {
      float sample = 0.0f;
      for (uint32_t channel = 0; channel < clock_.channels; ++channel) {
        sample += matrix_[out][channel] * input[channel];
      }
      last_[out] = sample;
      planes[out][frame] += sample * gain_ * fade_;
    }
    position_ += step;
  }
  // A reader so far behind that the writer came round the ring while it read
  // has played what it overwrote; it starts again from the writer.
  if (static_cast<double>(ring.end()) - SplitRing::kFrames + kLead > first) {
    synced_ = false;
  }

  steady_frames_ += frames;
  if (steady_frames_ >= static_cast<uint64_t>(rate_ * kSteadySeconds)) {
    steady_frames_ = 0;
    if (margin_ > kMarginStart) {
      margin_ = std::max(kMarginStart, margin_ - kMarginGiveBack);
    }
  }
  // The processing delay configured by the reader: its block, resampler
  // tail and safety margin. The receiver's DSP is reported separately by
  // the graph, just as it is for main; neither term measures the device.
  const auto lag_us = static_cast<uint32_t>(
      std::lround((span + margin_ * source_rate) / source_rate * 1e6));
  const uint32_t told = stats.lag_us.load(std::memory_order_relaxed);
  if (lag_us > told + 250 || told > lag_us + 250) {
    stats.lag_us.store(lag_us, std::memory_order_relaxed);
    changed = true;
  }
  return become(SplitState::playing, stats) || changed;
}

}  // namespace fluideq_engine
