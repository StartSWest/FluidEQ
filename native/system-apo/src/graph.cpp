/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq_engine/graph.h"

#include <cmath>
#include <cstddef>
#include <memory>
#include <optional>
#include <string>
#include <utility>
#include <vector>

#include "fluideq/resampler.h"
#include "dsp_chain.h"
#include "graphic_eq.h"
#include "wav.h"

namespace fluideq_engine {

namespace {

// The longest kernel this engine hands to the convolver, for the
// `Convolution:` file and the graphic FIR alike: 128 partitions of
// frequency-domain multiply per block, past which a longer response stops
// buying anything either source can express and starts putting the
// audiodg.exe callback at risk.
//
// It bites on both, for different reasons. An impulse response reaches it
// often — a two-second reverb at 48 kHz is 96000 samples — and is truncated
// with a warning rather than refused, because half a reverb tail is still the
// room the user chose and silence is not. The FIR's tap count is derived from
// the stream's sample rate, which arrives from Windows in a mix format this
// code did not write: a rate it would be wrong to trust becomes an allocation
// sized by it, on a load path that has nowhere to report a failure.
constexpr uint32_t kMaxKernelTaps = 65536;

// The graphic-EQ FIR's tap count is specified at 48 kHz and scaled with the
// stream, so its resolution in Hz per tap — and therefore how closely it
// tracks a curve down at 20 Hz — is the same on every device.
constexpr uint32_t kGraphicTapsAt48k = 4097;
constexpr double kGraphicReferenceRate = 48000.0;

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

/**
 * A path, flattened to ASCII for one warning line.
 *
 * Lossy on purpose: this string is only ever printed to a log, never opened,
 * and a faithful UTF-8 conversion would mean `WideCharToMultiByte` and a
 * Windows header in a translation unit that has no other reason for one.
 */
std::string narrow(const std::wstring& text) {
  std::string out;
  out.reserve(text.size());
  for (const wchar_t character : text) {
    const bool printable = character >= 0x20 && character < 0x7f;
    out.push_back(printable ? static_cast<char>(character) : '?');
  }
  return out;
}

/**
 * Converts a mono kernel to another rate, once, at construction.
 *
 * `feq_resample` returns short whenever the input runs out mid-call, so the
 * loop is driven by how much input has been consumed rather than by one call
 * being enough; the flush afterwards is the half window the converter still
 * holds when the file ends, which for an impulse response is real tail.
 */
std::vector<float> resample_mono(const std::vector<float>& input,
                                 double from_rate, double to_rate) {
  FeqResampler* state = feq_resampler_create(from_rate, to_rate, 1);
  if (state == nullptr) {
    return {};
  }

  const double scaled =
      std::ceil(static_cast<double>(input.size()) * to_rate / from_rate);
  std::vector<float> output(static_cast<size_t>(scaled) + FEQ_RESAMPLER_TAPS,
                            0.0f);

  size_t taken = 0;
  size_t written = 0;
  while (taken < input.size() && written < output.size()) {
    const float* const in_planar[1] = {input.data() + taken};
    float* const out_planar[1] = {output.data() + written};
    uint32_t consumed = 0;
    const uint32_t produced = feq_resample(
        state, in_planar, static_cast<uint32_t>(input.size() - taken),
        out_planar, static_cast<uint32_t>(output.size() - written), &consumed);
    if (produced == 0 && consumed == 0) {
      break;  // Neither side moved; looping again would never terminate.
    }
    taken += consumed;
    written += produced;
  }
  while (written < output.size()) {
    float* const out_planar[1] = {output.data() + written};
    const uint32_t produced = feq_resampler_flush(
        state, out_planar, static_cast<uint32_t>(output.size() - written));
    if (produced == 0) {
      break;
    }
    written += produced;
  }

  feq_resampler_destroy(state);
  output.resize(written);
  return output;
}

/** The `Convolution:` file, at the stream's rate. Empty when unusable. */
std::vector<float> load_impulse(const std::wstring& path, uint32_t sample_rate,
                                std::vector<std::string>& warnings) {
  const std::optional<WavData> wav = read_wav(path);
  if (!wav || wav->mono.empty()) {
    // The size cap is named here because it is the one refusal a user can act
    // on: the others (missing, damaged, a compressed format) are all "this is
    // not a WAVE this engine can read", but "too large" is a file they can
    // trim. `read_wav` cannot say which of the two it hit without growing a
    // reason type for one caller, so the line names both.
    warnings.push_back("Convolution file could not be read — missing, not a "
                       "supported WAVE, or larger than " +
                       std::to_string(kMaxWavBytes / (1024u * 1024u)) +
                       " MiB: " + narrow(path));
    return {};
  }

  const size_t source_taps = wav->mono.size();
  bool truncated = false;

  std::vector<float> kernel = wav->mono;
  if (wav->sample_rate != sample_rate) {
    // Truncated BEFORE the conversion rather than after it. A six-minute file
    // at 44.1 kHz is sixteen million samples; converting all of them means an
    // allocation that size and the converter's work on every one, and then
    // all but the first 65536 are thrown away. Only the input that can still
    // land inside `kMaxKernelTaps` at the stream's rate is converted, plus
    // one resampler window so the last kept tap is produced from a full
    // window rather than from an input that stops underneath it.
    const double source_needed =
        std::ceil(static_cast<double>(kMaxKernelTaps) *
                  static_cast<double>(wav->sample_rate) /
                  static_cast<double>(sample_rate)) +
        static_cast<double>(FEQ_RESAMPLER_TAPS);
    if (source_needed < static_cast<double>(kernel.size())) {
      kernel.resize(static_cast<size_t>(source_needed));
      truncated = true;
    }
    kernel = resample_mono(kernel, static_cast<double>(wav->sample_rate),
                           static_cast<double>(sample_rate));
    // Checked, and the failure warning pushed, BEFORE the success warning
    // below: a resample that produced nothing must not be logged as having
    // resampled the file, which is what happened when the two lines were the
    // other way round.
    if (kernel.empty()) {
      warnings.push_back("Convolution file could not be resampled: " +
                         narrow(path));
      return {};
    }
    warnings.push_back("Convolution file is " +
                       std::to_string(wav->sample_rate) + " Hz; resampled to " +
                       std::to_string(sample_rate) + " Hz.");
  }
  if (kernel.size() > kMaxKernelTaps) {
    kernel.resize(kMaxKernelTaps);
    truncated = true;
  }
  // The file's own length, not the converted one: after a pre-resample
  // truncation the converted vector is a number this engine chose, and
  // reporting it would tell the user their file was the size of our limit.
  if (truncated) {
    warnings.push_back("Convolution file is " + std::to_string(source_taps) +
                       " samples at " + std::to_string(wav->sample_rate) +
                       " Hz; only the first " +
                       std::to_string(kMaxKernelTaps) + " are used.");
  }
  return kernel;
}

/** The `GraphicEQ:` curve as a linear-phase FIR at the stream's rate. */
std::vector<float> design_graphic(const std::vector<GraphicPoint>& points,
                                  uint32_t sample_rate,
                                  std::vector<std::string>& warnings) {
  const double scaled = static_cast<double>(kGraphicTapsAt48k) *
                        static_cast<double>(sample_rate) /
                        kGraphicReferenceRate;
  // Compared as a double BEFORE any narrowing. `sample_rate` arrives from a
  // mix format this code did not write, and at rates the cap is meant to
  // guard against, `scaled` can be far past what `std::lround` (into a 32-bit
  // `long`) or a `uint32_t` can round-trip; narrowing first let that
  // wraparound land back under `kMaxKernelTaps` and skip the cap entirely.
  uint32_t taps;
  if (scaled > static_cast<double>(kMaxKernelTaps)) {
    taps = (kMaxKernelTaps - 1u) | 1u;
    warnings.push_back("Graphic EQ needs " + std::to_string(std::llround(scaled)) +
                       " taps at " + std::to_string(sample_rate) +
                       " Hz; designed with " + std::to_string(taps) +
                       " instead.");
  } else {
    taps = static_cast<uint32_t>(std::lround(scaled)) | 1u;
  }
  return design_graphic_kernel(points, sample_rate, taps);
}

using ConvolverPtr = std::unique_ptr<FeqConvolver, detail::ConvolverDeleter>;

/**
 * One convolver per channel, all or nothing.
 *
 * A stage that ran on some channels and not others would delay them by
 * different amounts, which collapses the stereo image — worse than the same
 * config running with no convolution at all. Failing partway needs no manual
 * unwind: `out` holds `unique_ptr`s, so clearing it destroys whatever had
 * already been built.
 */
bool build_convolvers(const FeqConvolverKernel* kernel, uint32_t channels,
                      std::vector<ConvolverPtr>& out) {
  out.clear();
  out.reserve(channels);
  for (uint32_t at = 0; at < channels; ++at) {
    ConvolverPtr convolver(feq_convolver_create(kernel));
    if (!convolver) {
      out.clear();
      return false;
    }
    out.push_back(std::move(convolver));
  }
  return true;
}

}  // namespace

Graph::Graph(const Chain& chain, uint32_t sample_rate, uint32_t channels,
             uint32_t max_frames)
    : sample_rate_(sample_rate),
      channels_(channels),
      max_frames_(max_frames),
      passthrough_(true),
      preamp_linear_(1.0),
      latency_frames_(0) {
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
                              max_frames_, warnings_);
  rack_ = std::shared_ptr<FeqChain>(std::move(rack.chain));
  dsp_values_ = chain.dsp_values;
  rack_channels_ = rack.channels;
  rack_planes_.assign(rack_channels_, nullptr);
  latency_frames_ += rack.latency;

  // An endpoint the config never named gets no EQ at all, not even a
  // preamp of 0 dB: `matched` is the difference between "this config has
  // something to say about this device" and "it does not".
  if (!chain.matched) {
    passthrough_ = rack_ == nullptr;
    return;
  }

  preamp_linear_ = std::pow(10.0, chain.preamp_db / 20.0);

  layout_.reserve(chain.bands.size());
  coefficients_.reserve(chain.bands.size());
  for (const Band& band : chain.bands) {
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

  if (!chain.convolution_path.empty()) {
    const std::vector<float> kernel =
        load_impulse(chain.convolution_path, sample_rate_, warnings_);
    if (!kernel.empty()) {
      impulse_kernel_.reset(feq_convolver_kernel_create(
          kernel.data(), static_cast<uint32_t>(kernel.size())));
      if (impulse_kernel_ &&
          build_convolvers(impulse_kernel_.get(), channels_, impulse_)) {
        latency_frames_ += feq_convolver_latency();
      } else {
        warnings_.push_back("Convolution could not be prepared; skipped.");
      }
    }
  }

  if (!chain.graphic.empty()) {
    const std::vector<float> kernel =
        design_graphic(chain.graphic, sample_rate_, warnings_);
    if (!kernel.empty()) {
      graphic_kernel_.reset(feq_convolver_kernel_create(
          kernel.data(), static_cast<uint32_t>(kernel.size())));
      if (graphic_kernel_ &&
          build_convolvers(graphic_kernel_.get(), channels_, graphic_)) {
        // Two terms, not one. The convolver's block-pipeline latency, plus
        // the FIR's own group delay: this kernel is designed linear-phase and
        // therefore centred, so its energy sits at tap n/2 and the signal
        // comes out that many frames later. Reporting only the first term
        // told Windows a smaller number than the audio was actually delayed
        // by on every endpoint with a `GraphicEQ:` line, which is what
        // delay compensation uses to line this output up against the others.
        //
        // The impulse-response stage above adds no such term on purpose: an
        // IR is causal, and whatever delay it carries is the room it is
        // reproducing rather than a filter's phase response.
        latency_frames_ += feq_convolver_latency() +
                           static_cast<uint32_t>(kernel.size() / 2);
      } else {
        warnings_.push_back("Graphic EQ could not be prepared; skipped.");
      }
    }
  }

  passthrough_ = rack_ == nullptr && coefficients_.empty() &&
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

  const size_t bands = coefficients_.size();
  const auto preamp = static_cast<float>(preamp_linear_);
  for (uint32_t channel = 0; channel < channels_; ++channel) {
    float* buffer = planar[channel];
    if (buffer == nullptr) {
      continue;
    }

    if (!impulse_.empty()) {
      feq_convolve(impulse_[channel].get(), buffer, frames);
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
}

void Graph::inherit_state(const Graph& previous) noexcept {
  if (!has_same_band_layout(previous) || channels_ != previous.channels_) {
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

const std::vector<std::string>& Graph::warnings() const noexcept {
  return warnings_;
}

}  // namespace fluideq_engine
