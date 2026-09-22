/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A run of biquads over every channel, and the fade that carries it through
 * an edit.
 *
 * Every settings change builds a new graph, and the new graph used to take
 * the old one's filter histories only when every band in a stage had the
 * same type in the same place — so adding one band, removing one, or picking
 * a preset or a Smart EQ with a different number of bands started the whole
 * stage from silence, with no fade. Measured on the engine: a 0.5 dB band
 * added at 3 kHz left a tick 25 dB under a ballad's peaks, and on a 60 Hz
 * tone the bass dipped for 35 ms with a click 53 dB louder than a clean
 * change. Equalizer APO fades its whole chain over 10 ms, but its new filters
 * start from silence too.
 *
 * Here a band that is still there keeps its history — found again by its
 * type and frequency, or by its place when only its frequency moved — and the
 * cascade as it was keeps running beside the new one for `kFadeSeconds` while
 * the sound slides across on an equal-gain raised cosine: the two outputs are
 * nearly the same signal, and an equal-power fade would bump correlated audio
 * 3 dB at its middle. Measured against the same cases: the tone's click
 * 104 dB down, the ballad's 68 dB down.
 *
 * Everything the fade needs is allocated here, on the thread that builds a
 * graph; `adopt` and `process` only copy and multiply.
 */
#ifndef FLUIDEQ_ENGINE_IIR_CASCADE_H
#define FLUIDEQ_ENGINE_IIR_CASCADE_H

#include <cstddef>
#include <cstdint>
#include <vector>

#include "fluideq/biquad.h"
#include "fluideq_engine/config.h"

namespace fluideq_engine {

/** One band as a cascade runs it, and what finds it again after an edit. */
struct IirBand {
  FeqFilterType type;
  double frequency;
  double quality;
  FeqBiquadCoefficients coefficients;
};

/** `band` at `sample_rate`, from the cookbook or matched as the band asks. */
IirBand design_band(const Band& band, uint32_t sample_rate);

/** `FilterType` to the core's own enum, spelled out rather than cast. */
FeqFilterType to_core_type(FilterType type);

class IirCascade {
 public:
  /** How long an edit takes to cross over, in seconds. */
  static constexpr double kFadeSeconds = 0.02;
  /**
   * The most bands a cascade can fade out from. Every curve layer shares one
   * stage — a correction, a preset and a Smart EQ come to 45 bands — and a
   * cascade past this is swapped without a fade, as every one was before.
   */
  static constexpr size_t kMaxFadeBands = 128;

  IirCascade(std::vector<IirBand> bands, uint32_t sample_rate,
             uint32_t channels, uint32_t max_frames);

  /**
   * Audio thread, at the swap: take up where `previous` is. No allocation.
   *
   * A cascade that was itself still fading hands on the sound it was fading
   * from, at the point it had reached, so a drag that lands a write every
   * few milliseconds slides through its steps rather than restarting a fade
   * on each.
   */
  void adopt(const IirCascade& previous) noexcept;

  /**
   * Audio thread, at the swap, when nothing ran before this: fade in from the
   * untouched sound, so a layer switched on while music plays does not start
   * its filters from silence in the middle of a waveform.
   */
  void fade_in() noexcept;

  void process(float* const* planar, uint32_t frames) noexcept;

  /** Every history back to silence, and no fade. */
  void reset() noexcept;

  bool empty() const noexcept { return bands_.empty(); }
  bool fading() const noexcept { return fade_left_ > 0; }
  bool same_response(const IirCascade& other) const noexcept;
  const std::vector<IirBand>& bands() const noexcept { return bands_; }

 private:
  std::vector<IirBand> bands_;
  /** `channels_ * bands_.size()`, channel-major. */
  std::vector<FeqBiquadState> states_;
  /** The cascade being faded out, `outgoing_count_` of `kMaxFadeBands`. */
  std::vector<FeqBiquadCoefficients> outgoing_;
  /** `channels_ * kMaxFadeBands`, channel-major. */
  std::vector<FeqBiquadState> outgoing_states_;
  size_t outgoing_count_ = 0;
  /** One channel of the outgoing sound, `max_frames_` long. */
  std::vector<float> scratch_;
  uint32_t channels_;
  uint32_t max_frames_;
  uint32_t fade_frames_;
  uint32_t fade_total_ = 0;
  uint32_t fade_left_ = 0;
};

}  // namespace fluideq_engine

#endif  // FLUIDEQ_ENGINE_IIR_CASCADE_H
