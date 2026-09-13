/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq_engine/graph.h"

#include <cmath>
#include <cstddef>
#include <cstring>
#include <memory>
#include <string>
#include <utility>
#include <vector>

#include "dsp_chain.h"
#include "graph_stages.h"
#include "output_guard.h"
#include "eq_phase.h"

namespace fluideq_engine {

namespace {

/**
 * `FilterType` to the core's own enum, spelled out rather than cast.
 *
 * The two lists happen to agree today, but `biquad.h` says its order is the
 * host protocol's and append-only, while `config.h`'s follows Equalizer APO's
 * type aliases. A cast would keep compiling on the day one of them moves and
 * would silently apply the wrong shape to every band.
 */
FeqFilterType to_core_type(FilterType type) {
  switch (type) {
    case FilterType::NO:
      return FEQ_FILTER_NO;
    case FilterType::LSC:
      return FEQ_FILTER_LSC;
    case FilterType::HSC:
      return FEQ_FILTER_HSC;
    case FilterType::LPQ:
      return FEQ_FILTER_LPQ;
    case FilterType::HPQ:
      return FEQ_FILTER_HPQ;
    case FilterType::BP:
      return FEQ_FILTER_BP;
    case FilterType::PK:
      break;
  }
  return FEQ_FILTER_PK;
}

/** Whether every sample of the block is a real number. Audio thread. */
bool all_finite(float* const* planar, uint32_t channels,
                uint32_t frames) noexcept {
  for (uint32_t channel = 0; channel < channels; ++channel) {
    const float* buffer = planar[channel];
    if (buffer == nullptr) {
      continue;
    }
    for (uint32_t at = 0; at < frames; ++at) {
      if (!std::isfinite(buffer[at])) {
        return false;
      }
    }
  }
  return true;
}

}  // namespace

Graph::Graph(const Chain& chain, uint32_t sample_rate, uint32_t channels,
             uint32_t max_frames, std::shared_ptr<FeqLevelingMemory> leveling)
    : sample_rate_(sample_rate),
      channels_(channels),
      max_frames_(max_frames),
      passthrough_(true),
      preamp_linear_(1.0),
      latency_frames_(0),
      leveling_(std::move(leveling)) {
  if (sample_rate_ == 0 || channels_ == 0 || max_frames_ == 0) {
    return;
  }

  /**
   * The rack first, and outside the `matched` guard below.
   *
   * `matched` says whether the Equalizer APO configuration names THIS
   * endpoint. The rack is system-wide — one file, no `Device:` line — so it
   * applies to an output the user has never opened the EQ page for, which is
   * every output on a fresh install.
   */
  RackBuild rack = build_rack(chain.dsp_values, sample_rate_, channels_,
                              max_frames_, warnings_, leveling_.get());
  rack_ = std::shared_ptr<FeqChain>(std::move(rack.chain));
  dsp_values_ = chain.dsp_values;
  rack_channels_ = rack.channels;
  rack_planes_.assign(rack_channels_, nullptr);
  latency_frames_ += rack.latency;
  if (rack.failed) {
    problems_.push_back("dsp-rack");
  }

  // An endpoint the config never named gets no EQ at all, not even a
  // preamp of 0 dB: `matched` is the difference between "this config has
  // something to say about this device" and "it does not".
  if (!chain.matched) {
    passthrough_ = rack_ == nullptr;
    return;
  }

  preamp_linear_ = std::pow(10.0, chain.preamp_db / 20.0);
  auto_preamp_ = chain.auto_preamp;
  if (chain.output_guard) {
    output_guard_ = std::make_unique<OutputGuard>(sample_rate_, channels_);
    latency_frames_ += output_guard_->latency();
  }

  layout_.reserve(chain.bands.size());
  coefficients_.reserve(chain.bands.size());
  std::vector<FeqLinearPhaseBand> eq_bands;
  std::vector<FeqLinearPhaseBand> curve_bands;
  for (const Band& band : chain.bands) {
    if (band.user_eq || band.curve_layer) {
      auto& scoped = band.user_eq ? eq_bands : curve_bands;
      scoped.push_back({1, 0, to_core_type(band.type), band.frequency,
                        band.gain_db, band.quality});
      continue;
    }
    layout_.push_back(band.type);
    coefficients_.push_back(feq_biquad_coefficients(
        to_core_type(band.type), band.frequency, band.gain_db, band.quality,
        static_cast<double>(sample_rate_)));
  }
  states_.assign(static_cast<size_t>(channels_) * coefficients_.size(),
                 FeqBiquadState{});
  for (FeqBiquadState& state : states_) {
    feq_biquad_reset(&state);
  }
  if (!eq_bands.empty()) {
    eq_phase_ = std::make_unique<EqPhaseStage>(eq_bands, !chain.minimum_eq_phase,
        sample_rate_, channels_, max_frames_);
    latency_frames_ += eq_phase_->latency();
    if (eq_phase_->failed()) problems_.push_back("eq-phase");
  }
  if (!curve_bands.empty()) {
    curve_phase_ = std::make_unique<EqPhaseStage>(curve_bands, !chain.minimum_curve_phase,
        sample_rate_, channels_, max_frames_);
    latency_frames_ += curve_phase_->latency();
    if (curve_phase_->failed()) problems_.push_back("eq-phase");
  }

  if (!chain.convolution_path.empty()) {
    std::vector<float> kernel =
        load_impulse(chain.convolution_path, sample_rate_, warnings_);
    if (!kernel.empty()) {
      impulse_kernel_.reset(feq_convolver_kernel_create(
          kernel.data(), static_cast<uint32_t>(kernel.size())));
      if (impulse_kernel_ &&
          build_convolvers(impulse_kernel_.get(), channels_ * chain.convolution_passes, impulse_)) {
        latency_frames_ += feq_convolver_latency() * chain.convolution_passes;
        impulse_identity_ = kernel_identity(std::move(kernel));
      } else {
        warnings_.push_back("Convolution could not be prepared; skipped.");
      }
    }
  }

  // One stage for every curve at once, not one per curve: see
  // `Chain::graphic_curves`.
  if (!chain.graphic_curves.empty() || chain.stable_graphic) {
    GraphicDesign design = design_graphic(chain, sample_rate_, warnings_);
    std::vector<float>& kernel = design.samples;
    if (!kernel.empty()) {
      graphic_kernel_.reset(feq_convolver_kernel_create(
          kernel.data(), static_cast<uint32_t>(kernel.size())));
      if (graphic_kernel_ &&
          build_convolvers(graphic_kernel_.get(), channels_, graphic_)) {
        // Both comparison paths retain the original fixed FIR delay. The
        // minimum-phase curve adds frequency-dependent phase, not a second
        // bulk delay. Padding keeps convolver history transferable between
        // A and B without changing either path's reported latency.
        //
        // The impulse-response stage above adds no such term on purpose: an
        // IR is causal, and whatever delay it carries is the room it is
        // reproducing rather than a filter's phase response.
        latency_frames_ += feq_convolver_latency() +
                           design.delay_frames;
        graphic_identity_ = kernel_identity(std::move(kernel));
      } else {
        warnings_.push_back("Graphic EQ could not be prepared; skipped.");
      }
    }
  }

  // Asked for and not running, whichever of the several ways it failed —
  // the warnings above say which, for the log; these say only what, for the
  // app to put in front of the user.
  if (!chain.convolution_path.empty() && impulse_.empty()) {
    problems_.push_back("convolution");
  }
  if (!chain.graphic_curves.empty() && graphic_.empty()) {
    problems_.push_back("graphic-eq");
  }

  passthrough_ = output_guard_ == nullptr && rack_ == nullptr && coefficients_.empty() &&
                 eq_phase_ == nullptr && curve_phase_ == nullptr &&
                 impulse_.empty() && graphic_.empty() &&
                 preamp_linear_ == 1.0f;
}

// Every owning member is a `unique_ptr` (the kernels) or a vector of them
// (the per-channel convolvers), so the compiler-generated destruction order
// — reverse of declaration in `graph.h` — already tears down the convolvers
// before the kernels they point into. Nothing left to do by hand.
Graph::~Graph() = default;

void Graph::process(float* const* planar, uint32_t frames) noexcept {
  // A block larger than this graph was built for is passed through whole. The
  // alternative — processing the first `max_frames_` of it — would leave the
  // rest unfiltered and every filter's history one block behind the stream.
  if (passthrough_ || planar == nullptr || frames == 0 ||
      frames > max_frames_) {
    return;
  }

  /**
   * The rack, before the EQ and across the channels together.
   *
   * This order is the one the Library player already produces — the rack
   * inside the app, then Equalizer APO on the device — so the same settings
   * sound the same whether a track is played from the Library or from
   * anything else on the machine. It also has to be this way round for the
   * maximizer to mean anything: a ceiling followed by a preamp is a limiter
   * with a make-up gain after it, while a preamp followed by a ceiling is a
   * limiter working harder for the same result.
   *
   * All at once rather than per channel because the rack is stereo-linked:
   * the limiter, the dimension stage and the mid/side EQ all need both
   * channels of the same block in the same call.
   */
  if (rack_) {
    bool usable = true;
    for (uint32_t at = 0; at < rack_channels_; ++at) {
      rack_planes_[at] = planar[at];
      usable = usable && planar[at] != nullptr;
    }
    if (usable) {
      feq_chain_process(rack_.get(), rack_planes_.data(), frames);
    }
  }

  if (eq_phase_) eq_phase_->process(planar, frames);
  if (curve_phase_) curve_phase_->process(planar, frames);

  const size_t bands = coefficients_.size();
  const auto preamp = static_cast<float>(preamp_linear_);
  for (uint32_t channel = 0; channel < channels_; ++channel) {
    float* buffer = planar[channel];
    if (buffer == nullptr) {
      continue;
    }

    for (size_t stage = channel; stage < impulse_.size(); stage += channels_) {
      feq_convolve(impulse_[stage].get(), buffer, frames);
    }
    if (!graphic_.empty()) {
      feq_convolve(graphic_[channel].get(), buffer, frames);
    }

    FeqBiquadState* state =
        states_.data() + static_cast<size_t>(channel) * bands;
    for (size_t band = 0; band < bands; ++band) {
      feq_biquad_process(state + band, buffer, frames, &coefficients_[band]);
    }

    // Same test `passthrough_` uses (`preamp_linear_ == 1.0f`, computed once
    // in the constructor): this used to compare the casted `preamp` against
    // 1.0f while `passthrough_` compared `chain.preamp_db` against 0.0, so the
    // two could disagree at the edges of what a cast rounds to.
    if (preamp_linear_ != 1.0f) {
      for (uint32_t at = 0; at < frames; ++at) {
        buffer[at] *= preamp;
      }
    }
  }

  if (output_guard_) output_guard_->process(planar, frames, auto_preamp_);
  if (output_gain_) output_gain_->store(static_cast<float>(auto_preamp_gain_db()), std::memory_order_relaxed);
  if (output_enabled_) output_enabled_->store(auto_preamp_, std::memory_order_relaxed);

  // The last thing on the way out: nothing but real numbers leaves this
  // engine. A NaN or an infinity — from a program upstream that wrote one, or
  // any stage here that produced one — is played by Windows as silence or as
  // a full-scale burst, and inside a biquad it never leaves: the history
  // carries it into every block after, and `inherit_state` into the next graph
  // too. So the block is silenced and every biquad starts over; the next clean
  // block plays normally. The convolvers are left alone because a finite
  // impulse response forgets a bad block by itself, one kernel length later,
  // and nothing on this thread may rebuild one.
  if (!all_finite(planar, channels_, frames)) {
    for (uint32_t channel = 0; channel < channels_; ++channel) {
      if (planar[channel] != nullptr) {
        std::memset(planar[channel], 0,
                    static_cast<size_t>(frames) * sizeof(float));
      }
    }
    for (FeqBiquadState& state : states_) {
      feq_biquad_reset(&state);
    }
    silenced_blocks_.fetch_add(1, std::memory_order_relaxed);
    if (eq_phase_) eq_phase_->reset();
    if (curve_phase_) curve_phase_->reset();
  }
}

void Graph::adopt_state(Graph* previous) noexcept {
  if (!transfer_state_ || previous == nullptr || sample_rate_ != previous->sample_rate_ ||
      channels_ != previous->channels_ || max_frames_ != previous->max_frames_) {
    return;
  }
  inherit_state(*previous);
  const auto same_phase = [](const std::unique_ptr<EqPhaseStage>& current,
                             const std::unique_ptr<EqPhaseStage>& before) {
    return (!current && !before) ||
        (current && before && current->same_response(*before));
  };
  const bool same_eq_phase = same_phase(eq_phase_, previous->eq_phase_) &&
      same_phase(curve_phase_, previous->curve_phase_);
  if (eq_phase_ && previous->eq_phase_) eq_phase_->adopt(*previous->eq_phase_);
  if (curve_phase_ && previous->curve_phase_) curve_phase_->adopt(*previous->curve_phase_);
  if (output_guard_ && previous->output_guard_) {
    output_guard_.swap(previous->output_guard_);
    const bool same_bands = coefficients_.size() == previous->coefficients_.size() &&
        std::equal(coefficients_.begin(), coefficients_.end(), previous->coefficients_.begin(),
          [](const FeqBiquadCoefficients& current, const FeqBiquadCoefficients& before) {
            return current.b0 == before.b0 && current.b1 == before.b1 && current.b2 == before.b2 &&
                current.a1 == before.a1 && current.a2 == before.a2;
          });
    if (auto_preamp_ && (!same_bands || !same_eq_phase || preamp_linear_ != previous->preamp_linear_ ||
        graphic_identity_ != previous->graphic_identity_ ||
        impulse_identity_ != previous->impulse_identity_ || impulse_.size() != previous->impulse_.size())) {
      output_guard_->reassess(std::max(latency_frames_, previous->latency_frames_) + sample_rate_ / 20);
    }
  }
  if (impulse_identity_ != nullptr && impulse_identity_ == previous->impulse_identity_ &&
      impulse_.size() == previous->impulse_.size()) {
    impulse_kernel_.swap(previous->impulse_kernel_);
    impulse_.swap(previous->impulse_);
  }
  if (graphic_identity_ != nullptr && graphic_identity_ == previous->graphic_identity_) {
    graphic_kernel_.swap(previous->graphic_kernel_);
    graphic_.swap(previous->graphic_);
  } else if (graphic_.size() == previous->graphic_.size()) {
    for (size_t channel = 0; channel < graphic_.size(); ++channel) {
      feq_convolver_transfer(graphic_[channel].get(), previous->graphic_[channel].get(), sample_rate_ / 20);
    }
  }
  if (rack_ != nullptr && previous->rack_ != nullptr && rack_ != previous->rack_) {
    feq_chain_transfer_state(rack_.get(), previous->rack_.get());
  }
}

void Graph::inherit_state(const Graph& previous) noexcept {
  if (!has_same_band_layout(previous) || channels_ != previous.channels_ ||
      sample_rate_ != previous.sample_rate_) {
    return;
  }
  // Element-wise rather than assigning the vector: this runs on the handover
  // path, where a reallocation is the one thing that must not happen.
  const size_t count = states_.size() < previous.states_.size()
                           ? states_.size()
                           : previous.states_.size();
  for (size_t at = 0; at < count; ++at) {
    states_[at] = previous.states_[at];
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

bool Graph::has_same_band_layout(const Graph& other) const noexcept {
  return layout_ == other.layout_;
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

}  // namespace fluideq_engine
