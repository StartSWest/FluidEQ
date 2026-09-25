/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Handing one graph's running state to the next, and the small accessors.
 * Split from `graph.cpp`, which builds a graph and runs it.
 *
 * Everything here runs on the audio thread at a block boundary (`adopt_state`)
 * or reads what the constructor settled: no allocation, no free, no lock.
 */

#include "fluideq_engine/graph.h"

#include <algorithm>
#include <cmath>
#include <memory>
#include <string>
#include <vector>

#include "curve_stage.h"
#include "eq_phase.h"
#include "iir_cascade.h"
#include "output_guard.h"

namespace fluideq_engine {

namespace {

constexpr double kPi = 3.14159265358979323846;

/**
 * The crossover's two times (`graph.h`). The settle is what a graph started
 * from silence needs, once its delay has filled, for the transient of the
 * music arriving to die out of its filters: a 30 Hz shelf's decays to a
 * hundredth in 35 ms. The fade is the rack's EQ fade and a half — the two
 * versions of the music it crosses between can be up to 20 ms apart, and a
 * longer cross spreads the comb that overlap makes more thinly.
 */
constexpr double kCrossingSettleSeconds = 0.04;
constexpr double kCrossingFadeSeconds = 0.03;

/** Either both absent, or both present with the same response. */
template <typename Stage>
bool same_stage(const std::unique_ptr<Stage>& current,
                const std::unique_ptr<Stage>& before) {
  return (!current && !before) ||
         (current && before && current->same_response(*before));
}

/**
 * The next stage takes up where the last one is; a stage with nothing before
 * it — FluidEQ switched on while playing — fades in from the untouched sound.
 */
template <typename Stage>
void carry_stage(std::unique_ptr<Stage>& current, std::unique_ptr<Stage>& before) {
  if (!current) {
    return;
  }
  if (before) {
    current->adopt(*before);
  } else {
    current->fade_in();
  }
}

}  // namespace

const std::vector<float>* Graph::curve_identity() const noexcept {
  return curves_ ? curves_->identity().get() : nullptr;
}

double Graph::current_preamp() const noexcept {
  if (preamp_fade_left_ == 0 || preamp_fade_total_ == 0) {
    return preamp_linear_;
  }
  const uint32_t done = preamp_fade_total_ - preamp_fade_left_;
  const double weight =
      0.5 - 0.5 * std::cos(kPi * static_cast<double>(done) /
                           static_cast<double>(preamp_fade_total_));
  return preamp_from_ + weight * (preamp_linear_ - preamp_from_);
}

bool Graph::start_crossing(Graph* previous) noexcept {
  if (passthrough_ || previous->passthrough_ ||
      source_buffers_.size() != channels_) {
    return false;
  }
  // A graph still filling, never yet heard, is passed over: the one it was
  // crossing from is what is playing, so that is what this crosses from.
  // A switch made while the arrows are held lands here, and so never plays
  // more than two graphs at once.
  Graph* source = previous;
  if (previous->source_ != nullptr &&
      previous->crossing_elapsed_ < previous->crossing_prime_) {
    source = previous->source_;
  }
  const bool shared = rack_ != nullptr && rack_ == source->rack_;
  // Sharing the rack, the graph before is played from after it, and a graph
  // itself mid-crossing cannot be played from there.
  if (shared && source->source_ != nullptr) {
    return false;
  }
  source_ = source;
  source_shares_rack_ = shared;
  crossing_hold_.store(source, std::memory_order_release);
  // Only this graph writes what the window reads from here on.
  source->history_ = nullptr;
  source->output_gain_ = nullptr;
  source->output_enabled_ = nullptr;
  source->output_active_ = nullptr;
  source->meter_activity_ = nullptr;
  if (!shared && source->rack_ != nullptr) {
    feq_chain_set_meters(source->rack_.get(), nullptr);
  }
  crossing_elapsed_ = 0;
  crossing_prime_ =
      latency_frames_ +
      static_cast<uint64_t>(std::lround(kCrossingSettleSeconds * sample_rate_));
  crossing_fade_ = std::max<uint32_t>(
      1u, static_cast<uint32_t>(std::lround(kCrossingFadeSeconds * sample_rate_)));

  // The level Auto normalize is holding comes across; its delay line starts
  // empty with the rest of this graph.
  if (output_guard_ && source->output_guard_) {
    output_guard_->take_level(*source->output_guard_);
    const uint32_t settling =
        std::max(latency_frames_, source->latency_frames_) + sample_rate_ / 20;
    if (auto_preamp_ && level_basis_ != nullptr && level_basis_ == previous) {
      output_guard_->shift_level(level_shift_db_, curve_level_db_, settling);
    } else {
      output_guard_->set_curve_level(curve_level_db_);
      if (auto_preamp_) {
        output_guard_->reassess(settling);
      }
    }
  }
  return true;
}

void Graph::mix_crossing(float* const* planar, uint32_t frames) noexcept {
  const uint64_t fade_from = crossing_prime_;
  const uint64_t fade_until = crossing_prime_ + crossing_fade_;
  for (uint32_t channel = 0; channel < channels_; ++channel) {
    float* own = planar[channel];
    const float* before = source_planes_[channel];
    if (own == nullptr || before == nullptr) {
      continue;
    }
    for (uint32_t at = 0; at < frames; ++at) {
      const uint64_t position = crossing_elapsed_ + at;
      double weight = 1.0;
      if (position < fade_from) {
        weight = 0.0;
      } else if (position < fade_until) {
        weight = 0.5 - 0.5 * std::cos(kPi * static_cast<double>(position - fade_from) /
                                      static_cast<double>(crossing_fade_));
      }
      own[at] = static_cast<float>(static_cast<double>(before[at]) +
                                   weight * (static_cast<double>(own[at]) -
                                             static_cast<double>(before[at])));
    }
  }
  crossing_elapsed_ += frames;
  if (crossing_elapsed_ >= fade_until) {
    // After the last block that touched it, and with release: the watcher
    // may free it the moment it reads this.
    source_ = nullptr;
    crossing_hold_.store(nullptr, std::memory_order_release);
  }
}

void Graph::adopt_state(Graph* previous) noexcept {
  if (!transfer_state_ || previous == nullptr || sample_rate_ != previous->sample_rate_ ||
      channels_ != previous->channels_ || max_frames_ != previous->max_frames_) {
    return;
  }
  // A graph that moves the sound in time crosses over instead of taking the
  // state: see `graph.h`. So does one replacing a graph still crossing over,
  // whatever its delay: what is heard there is not that graph's alone, and
  // taking its state would jump from what is heard to what it holds.
  if ((latency_frames_ != previous->latency_frames_ || previous->source_ != nullptr) &&
      start_crossing(previous)) {
    return;
  }
  const bool same_bands = same_stage(plain_, previous->plain_);
  const bool same_eq_phase =
      same_stage(linear_phase_, previous->linear_phase_) &&
      same_stage(eq_phase_, previous->eq_phase_) &&
      same_stage(curve_phase_, previous->curve_phase_);
  carry_stage(plain_, previous->plain_);
  carry_stage(linear_phase_, previous->linear_phase_);
  carry_stage(eq_phase_, previous->eq_phase_);
  carry_stage(curve_phase_, previous->curve_phase_);

  // The preamp slides with the bands rather than stepping under them.
  const double preamp_before = previous->current_preamp();
  if (preamp_before != preamp_linear_) {
    preamp_from_ = preamp_before;
    preamp_fade_total_ = std::max<uint32_t>(
        1u, static_cast<uint32_t>(std::lround(IirCascade::kFadeSeconds * sample_rate_)));
    preamp_fade_left_ = preamp_fade_total_;
  }

  if (output_guard_ && previous->output_guard_) {
    output_guard_.swap(previous->output_guard_);
    const bool sound_changed =
        auto_preamp_ &&
        (!same_bands || !same_eq_phase ||
         preamp_linear_ != previous->preamp_linear_ ||
         curve_identity() != previous->curve_identity() ||
         impulse_identity_ != previous->impulse_identity_ ||
         impulse_.size() != previous->impulse_.size());
    const uint32_t settling =
        std::max(latency_frames_, previous->latency_frames_) + sample_rate_ / 20;
    if (sound_changed && level_basis_ != nullptr && level_basis_ == previous) {
      // The level this EQ needs on the music just heard, at once.
      output_guard_->shift_level(level_shift_db_, curve_level_db_, settling);
    } else {
      // Nothing heard to judge by: down by the curve's worst case, then back
      // up as the music shows how much of it was needed.
      output_guard_->set_curve_level(curve_level_db_);
      if (sound_changed) {
        output_guard_->reassess(settling);
      }
    }
  }
  if (impulse_identity_ != nullptr && impulse_identity_ == previous->impulse_identity_ &&
      impulse_.size() == previous->impulse_.size()) {
    impulse_kernel_.swap(previous->impulse_kernel_);
    impulse_.swap(previous->impulse_);
  }
  if (curves_ && previous->curves_) curves_->adopt(*previous->curves_);
  if (rack_ != nullptr && previous->rack_ != nullptr && rack_ != previous->rack_) {
    feq_chain_transfer_state(rack_.get(), previous->rack_.get());
  }
  // The untouched channels' alignment is audio in flight like any other
  // delay line: a fresh one at a settings change would put its own length of
  // silence into every channel the rack does not run on. Only where the shape
  // and the delay match, and element-wise, because this runs on the handover.
  if (bypass_align_.size() == previous->bypass_align_.size()) {
    for (size_t at = 0; at < bypass_align_.size(); ++at) {
      std::vector<float>& line = bypass_align_lines_[at];
      const std::vector<float>& before = previous->bypass_align_lines_[at];
      if (line.size() != before.size()) {
        continue;
      }
      for (size_t frame = 0; frame < line.size(); ++frame) {
        line[frame] = before[frame];
      }
      bypass_align_[at].cursor = previous->bypass_align_[at].cursor;
    }
  }
}

void Graph::inherit_rack(const Graph& previous) noexcept {
  // Every one of these has to hold. `dsp_values_` alone is not enough: the
  // same array at a different sample rate or channel count builds a chain
  // with different buffer sizes and a different kernel, and running the old
  // one on the new stream would be the wrong filter at the wrong rate.
  // `max_frames_` is checked too: `build_rack` sizes the chain's internal
  // buffers to it, so a chain built for one block size handed to a graph
  // that accepted a larger one would have `feq_chain_process` write past
  // buffers it never sized for that many frames.
  if (rack_ == nullptr || previous.rack_ == nullptr ||
      sample_rate_ != previous.sample_rate_ ||
      channels_ != previous.channels_ ||
      max_frames_ != previous.max_frames_ ||
      rack_channels_ != previous.rack_channels_ ||
      dsp_values_ != previous.dsp_values_) {
    return;
  }
  // The chain this graph built is released here, on the watcher thread, and
  // was never reachable from the audio thread — this graph has not been
  // published yet.
  rack_ = previous.rack_;
}

bool Graph::rack_is_shared_with(const Graph& other) const noexcept {
  return rack_ != nullptr && rack_ == other.rack_;
}

bool Graph::is_passthrough() const noexcept { return passthrough_; }

uint32_t Graph::latency_frames() const noexcept { return latency_frames_; }
double Graph::auto_preamp_gain_db() const noexcept {
  return output_guard_ ? output_guard_->gain_db() : 0.0;
}

const std::vector<std::string>& Graph::warnings() const noexcept {
  return warnings_;
}

const std::vector<std::string>& Graph::problems() const noexcept {
  return problems_;
}

const std::string& Graph::room_note() const noexcept { return room_note_; }

const std::string& Graph::room_state() const noexcept { return room_state_; }

}  // namespace fluideq_engine
