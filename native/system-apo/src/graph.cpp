/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq_engine/graph.h"

#include <algorithm>
#include <cmath>
#include <cstddef>
#include <cstring>
#include <memory>
#include <string>
#include <utility>
#include <vector>

#include "curve_stage.h"
#include "dsp_chain.h"
#include "eq_phase.h"
#include "graph_stages.h"
#include "iir_cascade.h"
#include "input_history.h"
#include "output_guard.h"
#include "source_analysis.h"

namespace fluideq_engine {

namespace {

constexpr double kPi = 3.14159265358979323846;

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
             uint32_t max_frames, std::shared_ptr<FeqLevelingMemory> leveling,
             unsigned long channel_mask, const RoomHead* room_head,
             bool follows_processing, const Graph* rack_from,
             const SourceAnalysis* source_analysis)
    : sample_rate_(sample_rate),
      channels_(channels),
      max_frames_(max_frames),
      passthrough_(true),
      preamp_linear_(1.0),
      latency_frames_(0),
      leveling_(std::move(leveling)),
      dsp_values_(chain.dsp_values),
      source_identity_(source_analysis ? source_analysis->processing_identity() : std::string()),
      rack_low_latency_asked_(chain.low_latency),
      channel_mask_(channel_mask),
      rack_head_(room_head) {
  if (sample_rate_ == 0 || channels_ == 0 || max_frames_ == 0) {
    return;
  }
  if (source_analysis != nullptr) {
    source_report_.library = source_analysis->library;
    source_report_.engine_owner = source_analysis->engine_owner;
    source_report_.source = source_analysis->source;
    source_report_.epoch = source_analysis->epoch;
    source_report_.revision = source_analysis->revision;
  }
  // For the graph this one may yet cross over from (`start_crossing`):
  // the audio thread may not allocate them when it does.
  source_buffers_.assign(channels_, std::vector<float>(max_frames_, 0.0f));
  source_planes_.assign(channels_, nullptr);

  /**
   * The rack first, and outside the `matched` guard below.
   *
   * `matched` says whether the Equalizer APO configuration names THIS
   * endpoint. Its own rack file is resolved independently of that tree, so
   * an output can have DSP before its first curve creates a `Device:` block.
   */
  if (!reuse_rack(rack_from, chain, room_head)) {
    RackBuild rack = build_rack(chain.dsp_values, sample_rate_, channels_,
                                max_frames_, warnings_, leveling_.get(),
                                channel_mask, room_head, chain.low_latency,
                                source_analysis);
    rack_ = std::shared_ptr<FeqChain>(std::move(rack.chain));
    rack_channels_ = rack.channels;
    rack_latency_ = rack.latency;
    parts_.rack = rack.parts;
    rack_active_ = feq_chain_active_stages(rack_.get());
    // Game mode, from the rack's own value or the EQ side's directive: the
    // stages below give up their comfort delay on the same word.
    low_latency_ = rack.low_latency;
    room_note_ = rack.room_note;
    room_state_ = rack.room_state;
    rack_failed_ = rack.failed;
    rack_without_head_ = rack.room_without_head;
    source_report_.ready = rack.source_ready;
    source_report_.voice_ready = rack.voice_ready;
    source_report_.warm_handover = rack.warm_handover;
  }
  rack_planes_.assign(rack_channels_, nullptr);
  latency_frames_ += rack_latency_;
  const char* const names[] = {"leveler", "restoration", "exciter", "bassForge",
      "linearEq", "bassPunch", "room", "dimension", "maximizer",
      "headroom", "master"};
  for (uint32_t stage = 0; stage < 11u; ++stage) {
    if ((rack_active_ & (1u << stage)) != 0u) active_stages_.emplace_back(names[stage]);
  }
  // The channels the rack does not cover, put back in step with the ones it
  // does: see `bypass_align_`. Allocated here because `process` may not.
  if (rack_ != nullptr && rack_channels_ < channels_ && rack_latency_ > 0) {
    const size_t untouched = channels_ - rack_channels_;
    bypass_align_lines_.assign(
        untouched, std::vector<float>(static_cast<size_t>(rack_latency_) + 1,
                                      0.0f));
    bypass_align_.assign(untouched, FeqDelayLine{});
    for (size_t at = 0; at < untouched; ++at) {
      feq_delay_line_init(&bypass_align_[at], bypass_align_lines_[at].data(),
                          rack_latency_ + 1, rack_latency_);
    }
  }
  if (rack_failed_) {
    problems_.push_back("dsp-rack");
  }
  if (rack_without_head_) {
    problems_.push_back("room-head");
  }

  // An unnamed endpoint gets no EQ. After processing, empty stages fade
  // the old bands out and the guard keeps its delay so music does not jump.
  if (!chain.matched) {
    if (!follows_processing) {
      passthrough_ = rack_ == nullptr;
      return;
    }
    plain_ = std::make_unique<IirCascade>(std::vector<IirBand>{}, sample_rate_,
                                          channels_, max_frames_);
    linear_phase_ = std::make_unique<EqPhaseStage>(std::vector<IirBand>{},
        true, sample_rate_, channels_, max_frames_);
    eq_phase_ = std::make_unique<EqPhaseStage>(std::vector<IirBand>{}, false,
        sample_rate_, channels_, max_frames_);
    curve_phase_ = std::make_unique<EqPhaseStage>(std::vector<IirBand>{}, false,
        sample_rate_, channels_, max_frames_);
    output_guard_ = std::make_unique<OutputGuard>(sample_rate_, channels_);
    latency_frames_ += output_guard_->latency();
    parts_.guard = output_guard_->latency();
    passthrough_ = false;
    return;
  }

  preamp_linear_ = std::pow(10.0, chain.preamp_db / 20.0);
  auto_preamp_ = chain.auto_preamp;
  curve_level_db_ = chain.auto_preamp_start_db;
  if (chain.output_guard) {
    output_guard_ = std::make_unique<OutputGuard>(sample_rate_, channels_);
    output_guard_->set_curve_level(curve_level_db_);
    latency_frames_ += output_guard_->latency();
    parts_.guard = output_guard_->latency();
    if (chain.auto_preamp) active_stages_.emplace_back("guard");
  }

  std::vector<IirBand> eq_bands;
  std::vector<IirBand> curve_bands;
  std::vector<IirBand> plain_bands;
  for (const Band& band : chain.bands) {
    auto& scoped = band.user_eq ? eq_bands
                   : band.curve_layer ? curve_bands
                                      : plain_bands;
    scoped.push_back(design_band(band, sample_rate_));
  }
  plain_ = std::make_unique<IirCascade>(std::move(plain_bands), sample_rate_,
                                        channels_, max_frames_);
  if (!plain_->empty()) active_stages_.emplace_back("filters");
  if (chain.preamp_db != 0.0) active_stages_.emplace_back("preamp");
  // Game mode runs every band minimum phase: linear phase is a kernel's half
  // length of delay — up to 181 ms — spent on a property nobody aims by.
  const bool eq_linear = !chain.minimum_eq_phase && !low_latency_;
  const bool curve_linear = !chain.minimum_curve_phase && !low_latency_;
  const bool has_eq_bands = !eq_bands.empty();
  const bool has_curve_bands = !curve_bands.empty();
  // Every band of a layer in linear phase goes into ONE FIR, whichever layer
  // it came from. Your EQ and the curves in linear phase used to be a FIR
  // each, in series, each its whole half length of delay: 704 ms at 48 kHz
  // with both linear, and a 32767-tap convolution per layer (Ivan,
  // 2026-09-23: "if using linear on both curves and EQ need to add up or can
  // use same lag ms"). One kernel holds the product of their magnitudes as
  // well, with one delay and one convolution, however many layers are in it.
  //
  // The layers left in minimum phase run as biquads after it, so the FIR
  // always hears the stream itself: a layer switching phase changes the
  // kernel, handed over like any edit (`feq_convolver_transfer`), and never
  // moves the FIR in the chain — which would have skipped the music forward
  // by the delay and then replayed it.
  std::vector<IirBand> linear_bands;
  if (eq_linear) {
    linear_bands.insert(linear_bands.end(), eq_bands.begin(), eq_bands.end());
    eq_bands.clear();
  }
  if (curve_linear) {
    linear_bands.insert(linear_bands.end(), curve_bands.begin(),
                        curve_bands.end());
    curve_bands.clear();
  }
  linear_phase_ = std::make_unique<EqPhaseStage>(std::move(linear_bands), true,
      sample_rate_, channels_, max_frames_);
  eq_phase_ = std::make_unique<EqPhaseStage>(std::move(eq_bands), false,
      sample_rate_, channels_, max_frames_);
  curve_phase_ = std::make_unique<EqPhaseStage>(std::move(curve_bands), false,
      sample_rate_, channels_, max_frames_);
  const bool linear_failed = linear_phase_->failed();
  if (!linear_phase_->empty()) {
    latency_frames_ += linear_phase_->latency();
    // Said once, under the first layer in it: the delay is shared.
    (eq_linear && has_eq_bands ? parts_.eq_phase : parts_.curve_phase) =
        linear_phase_->latency();
    if (linear_failed) problems_.push_back("eq-phase");
  }
  if (has_eq_bands && !(eq_linear && linear_failed)) {
    active_stages_.emplace_back("eqPhase");
  }
  if (has_curve_bands && !(curve_linear && linear_failed)) {
    active_stages_.emplace_back("curvePhase");
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
        parts_.convolution = feq_convolver_latency() * chain.convolution_passes;
        active_stages_.emplace_back("convolution");
        impulse_identity_ = kernel_identity(std::move(kernel));
      } else {
        warnings_.push_back("Convolution could not be prepared; skipped.");
      }
    }
  }

  // One stage for every curve at once, not one per curve: see
  // `Chain::graphic_curves`.
  //
  // `stable_graphic` keeps the stage in place with no curves at all, as a
  // plain copy, so that adding the first curve never moves the audio. With
  // every curve minimum phase that costs the convolver's one partition —
  // 512 frames, 11 ms at 48 kHz — where it used to be 2560, 53 ms, on every
  // output a curve could ever reach. Game mode will not pay even that: with
  // no curves there is no stage.
  if (!chain.graphic_curves.empty() ||
      (chain.stable_graphic && !low_latency_)) {
    GraphicDesign design =
        design_graphic(chain, sample_rate_, warnings_, low_latency_);
    // With no curve the stage is a delay of the same length (`CurveStage`),
    // so the design's kernel — one tap standing in for a copy — is not built.
    static const std::vector<float> kNoCurve;
    curves_ = std::make_unique<CurveStage>(
        chain.graphic_curves.empty() ? kNoCurve : design.samples,
        design.delay_frames, sample_rate_, channels_, max_frames_);
    if (curves_->failed()) {
      warnings_.push_back("Graphic EQ could not be prepared; skipped.");
      curves_.reset();
    } else {
      // The convolver's partition, plus the linear design's half length when
      // some curve is linear phase (`design_graphic`). The impulse-response
      // stage above adds no such term on purpose: an IR is causal, and
      // whatever delay it carries is the room it is reproducing rather than
      // a filter's phase response.
      latency_frames_ += curves_->latency();
      parts_.curves = curves_->latency();
      if (!chain.graphic_curves.empty()) active_stages_.emplace_back("curves");
    }
  }

  // Asked for and not running, whichever of the several ways it failed —
  // the warnings above say which, for the log; these say only what, for the
  // app to put in front of the user.
  if (!chain.convolution_path.empty() && impulse_.empty()) {
    problems_.push_back("convolution");
  }
  if (!chain.graphic_curves.empty() && !curves_) {
    problems_.push_back("graphic-eq");
  }

  passthrough_ = output_guard_ == nullptr && rack_ == nullptr &&
                 plain_->empty() && linear_phase_->empty() &&
                 eq_phase_->empty() && curve_phase_->empty() &&
                 impulse_.empty() && !curves_ && preamp_linear_ == 1.0;
}

// Reverse member destruction frees convolvers before their kernels.
Graph::~Graph() = default;

bool Graph::reuse_rack(const Graph* rack_from, const Chain& chain,
                       const RoomHead* room_head) {
  // Everything `build_rack` is handed has to be the same: another rate or
  // channel count builds other buffers and kernels; `max_frames` sizes the
  // buffers, so a smaller block's chain would be written past; the Games
  // voicing asks game mode of an unchanged rack; the room folds through the
  // head, which the caller vouches for (`rack_from`) and which is caught
  // here only when it has gone or come.
  if (rack_from == nullptr || rack_from->rack_ == nullptr ||
      sample_rate_ != rack_from->sample_rate_ || channels_ != rack_from->channels_ ||
      max_frames_ != rack_from->max_frames_ || channel_mask_ != rack_from->channel_mask_ ||
      leveling_ != rack_from->leveling_ || room_head != rack_from->rack_head_ ||
      chain.low_latency != rack_from->rack_low_latency_asked_ ||
      source_identity_ != rack_from->source_identity_ ||
      chain.dsp_values != rack_from->dsp_values_) {
    return false;
  }
  // Constructor-only fields: `rack_from` may be running on the audio thread.
  rack_ = rack_from->rack_;
  rack_reused_ = true;
  rack_channels_ = rack_from->rack_channels_;
  rack_latency_ = rack_from->rack_latency_;
  parts_.rack = rack_from->parts_.rack;
  rack_active_ = rack_from->rack_active_;
  low_latency_ = rack_from->low_latency_;
  room_note_ = rack_from->room_note_;
  room_state_ = rack_from->room_state_;
  rack_failed_ = rack_from->rack_failed_;
  rack_without_head_ = rack_from->rack_without_head_;
  // The processing is unchanged, but this graph still acknowledges the new
  // transport metadata. Copying the whole report would echo an old revision.
  source_report_.ready = rack_from->source_report_.ready;
  source_report_.voice_ready = rack_from->source_report_.voice_ready;
  source_report_.warm_handover = rack_from->source_report_.warm_handover;
  return true;
}

void Graph::process(float* const* planar, uint32_t frames) noexcept {
  // A block larger than this graph was built for is passed through whole. The
  // alternative — processing the first `max_frames_` of it — would leave the
  // rest unfiltered and every filter's history one block behind the stream.
  if (planar == nullptr || frames == 0 ||
      frames > max_frames_) {
    return;
  }
  if (passthrough_) {
    return;
  }
  if (source_ == nullptr) {
    run_rack(planar, frames);
    run_tail(planar, frames);
    return;
  }
  // Crossing over (`graph.h`): the graph before goes on playing this block
  // too, on a copy of it as it arrived — or, sharing this one's rack, on
  // what that rack made of it, the rack being run once.
  const auto copy_in = [&]() {
    for (uint32_t channel = 0; channel < channels_; ++channel) {
      source_planes_[channel] =
          planar[channel] != nullptr ? source_buffers_[channel].data() : nullptr;
      if (planar[channel] != nullptr) {
        std::copy(planar[channel], planar[channel] + frames,
                  source_buffers_[channel].data());
      }
    }
  };
  if (source_shares_rack_) {
    run_rack(planar, frames);
    copy_in();
    source_->run_tail(source_planes_.data(), frames);
  } else {
    copy_in();
    source_->process(source_planes_.data(), frames);
    run_rack(planar, frames);
  }
  run_tail(planar, frames);
  mix_crossing(planar, frames);
}

void Graph::run_rack(float* const* planar, uint32_t frames) noexcept {
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
      // In the same block the rack ran, never on one it skipped: a channel
      // held back while the pair beside it was not would be the very fault
      // this prevents, with the sign reversed.
      for (size_t at = 0; at < bypass_align_.size(); ++at) {
        float* buffer = planar[rack_channels_ + at];
        if (buffer != nullptr) {
          feq_delay_line_process(&bypass_align_[at], buffer, frames);
        }
      }
    }
  }
}

void Graph::run_tail(float* const* planar, uint32_t frames) noexcept {
  // The music as it reaches the EQ, for Auto normalize to replay through the
  // next edit's EQ as it starts to play (`level_prediction.h`).
  if (history_ != nullptr) history_->record(planar, frames);

  // The shared linear FIR first, on the stream itself; the layers in minimum
  // phase after it.
  if (linear_phase_) linear_phase_->process(planar, frames);
  if (eq_phase_) eq_phase_->process(planar, frames);
  if (curve_phase_) curve_phase_->process(planar, frames);

  for (uint32_t channel = 0; channel < channels_; ++channel) {
    float* buffer = planar[channel];
    if (buffer == nullptr) {
      continue;
    }
    for (size_t stage = channel; stage < impulse_.size(); stage += channels_) {
      feq_convolve(impulse_[stage].get(), buffer, frames);
    }
  }
  if (curves_) curves_->process(planar, frames);
  if (plain_) plain_->process(planar, frames);

  if (preamp_fade_left_ > 0) {
    const uint32_t done = preamp_fade_total_ - preamp_fade_left_;
    for (uint32_t channel = 0; channel < channels_; ++channel) {
      float* buffer = planar[channel];
      if (buffer == nullptr) {
        continue;
      }
      for (uint32_t at = 0; at < frames; ++at) {
        double gain = preamp_linear_;
        if (done + at < preamp_fade_total_) {
          const double weight =
              0.5 - 0.5 * std::cos(kPi * static_cast<double>(done + at) /
                                   static_cast<double>(preamp_fade_total_));
          gain = preamp_from_ + weight * (preamp_linear_ - preamp_from_);
        }
        buffer[at] = static_cast<float>(buffer[at] * gain);
      }
    }
    preamp_fade_left_ -= std::min(preamp_fade_left_, frames);
  } else if (preamp_linear_ != 1.0) {
    // Same test `passthrough_` uses, on the same double, so the two cannot
    // disagree at the edges of what a cast rounds to.
    const auto preamp = static_cast<float>(preamp_linear_);
    for (uint32_t channel = 0; channel < channels_; ++channel) {
      float* buffer = planar[channel];
      if (buffer == nullptr) {
        continue;
      }
      for (uint32_t at = 0; at < frames; ++at) {
        buffer[at] *= preamp;
      }
    }
  }

  if (level_pending_) take_arrived_level();
  if (output_guard_) output_guard_->process(planar, frames, auto_preamp_);
  if (output_guard_ && history_ != nullptr) {
    history_->record_peak(static_cast<float>(output_guard_->last_input_peak()));
  }
  if (output_gain_) output_gain_->store(static_cast<float>(auto_preamp_gain_db()), std::memory_order_relaxed);
  if (output_enabled_) output_enabled_->store(auto_preamp_, std::memory_order_relaxed);

  // The last thing on the way out: nothing but real numbers leaves this
  // engine. A NaN or an infinity — from a program upstream that wrote one, or
  // any stage here that produced one — is played by Windows as silence or as
  // a full-scale burst, and inside a biquad it never leaves: the history
  // carries it into every block after, and `adopt_state` into the next graph
  // too. So the block is silenced and every biquad starts over; the next clean
  // block plays normally. The graphic and impulse convolvers are left alone
  // because a finite impulse response forgets a bad block by itself, one
  // kernel length later, and nothing on this thread may rebuild one.
  if (!all_finite(planar, channels_, frames)) {
    for (uint32_t channel = 0; channel < channels_; ++channel) {
      if (planar[channel] != nullptr) {
        std::memset(planar[channel], 0,
                    static_cast<size_t>(frames) * sizeof(float));
      }
    }
    if (plain_) plain_->reset();
    silenced_blocks_.fetch_add(1, std::memory_order_relaxed);
    if (linear_phase_) linear_phase_->reset();
    if (eq_phase_) eq_phase_->reset();
    if (curve_phase_) curve_phase_->reset();
  }
}

}  // namespace fluideq_engine
