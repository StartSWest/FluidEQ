/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * One flat array of doubles into a `FeqChainSettings`.
 *
 * This layout is written by `chainParams` in `generate-parity-fixtures.ts` and
 * by `encodeChainSettings` in `src/main/dspHost/wire.ts`, and it is deliberately
 * the same one for both. The fixtures already push twenty-seven whole-chain
 * cases through it against the real worklet, so the decoder the app depends on
 * at runtime is the decoder those fixtures exercise — rather than a second one
 * that agrees with the first until a field is added to one of them.
 *
 * The variable-length part, the EQ's bands, is last on purpose: everything
 * before it sits at a fixed offset, so adding a scalar cannot silently
 * re-point sixty-four bands.
 */

#include "fluideq/chain.h"

extern "C" {

int feq_chain_settings_decode(const double* values,
                              uint32_t count,
                              FeqChainSettings* out) {
  if (values == nullptr || out == nullptr || count < FEQ_CHAIN_PARAM_LEAD) {
    return 0;
  }
  const auto band_count =
      static_cast<uint32_t>(values[FEQ_CHAIN_PARAM_LEAD - 1]);
  if (band_count > FEQ_CHAIN_MAX_EQ_BANDS) {
    return 0;
  }
  // Asserted rather than assumed: a layout the two sides disagree about would
  // read a Q as a threshold and still sound plausible.
  if (count != FEQ_CHAIN_PARAM_LEAD +
                   static_cast<uint32_t>(band_count) * FEQ_CHAIN_BAND_PARAMS) {
    return 0;
  }

  feq_chain_settings_defaults(out);
  uint32_t at = 0;
  const auto next = [values, &at]() { return values[at++]; };
  const auto flag = [&next]() { return next() != 0.0 ? 1 : 0; };

  out->enabled = flag();
  out->output_safety_enabled = flag();

  out->exciter.enabled = flag();
  out->exciter.isolate = flag();
  out->exciter.stereo = static_cast<FeqStereoMode>(static_cast<int>(next()));
  out->exciter.align_enabled = flag();
  out->exciter.align_amount = next();
  out->exciter.organic_enabled = flag();
  out->exciter.organic_amount = next();
  out->exciter.organic_focus_hz = next();
  out->exciter.organic_range = next();
  for (auto& band : out->exciter.bands) {
    band.enabled = flag();
    band.freq_hz = next();
    band.range = next();
    band.drive = next();
    band.mix = next();
    band.texture = next();
  }

  out->eq.enabled = flag();
  out->eq.isolate = flag();
  out->eq.model = static_cast<FeqEqModel>(static_cast<int>(next()));
  out->eq.model_amount = next();
  out->eq.engine = static_cast<FeqEqEngine>(static_cast<int>(next()));
  out->eq.phase = static_cast<FeqPhaseMode>(static_cast<int>(next()));
  out->eq.stereo = static_cast<FeqStereoMode>(static_cast<int>(next()));
  out->eq.mono_below_hz = next();
  out->eq.oversample = static_cast<uint32_t>(next());
  out->eq.subsonic_hz = next();
  out->eq.fuzz_amount = next();

  out->compressor.enabled = flag();
  out->compressor.crossover_hz[0] = next();
  out->compressor.crossover_hz[1] = next();
  for (auto& band : out->compressor.bands) {
    band.threshold_db = next();
    band.ratio = next();
    band.attack_ms = next();
    band.release_ms = next();
    band.makeup_db = next();
  }

  out->dimension.enabled = flag();
  out->dimension.low_width = next();
  out->dimension.mid_width = next();
  out->dimension.high_width = next();
  out->dimension.low_hz = next();
  out->dimension.high_hz = next();
  out->dimension.decorrelation = next();
  out->maximizer.enabled = flag();
  out->maximizer.drive_db = next();
  out->maximizer.ceiling_db = next();
  out->maximizer.look_ahead_ms = next();
  out->maximizer.release_ms = next();

  out->master.enabled = flag();
  out->master.output_trim_db = next();
  out->master.loudness_maximize = flag();
  out->master.loudness_target_lufs = next();
  out->master.ceiling_db = next();
  out->master.release_ms = next();
  out->master.matched_bypass = flag();

  out->eq.band_count = static_cast<uint32_t>(next());
  if (at != FEQ_CHAIN_PARAM_LEAD) {
    return 0;
  }
  for (uint32_t band = 0; band < out->eq.band_count; ++band) {
    out->eq.bands[band].enabled = flag();
    out->eq.bands[band].type =
        static_cast<FeqFilterType>(static_cast<int>(next()));
    out->eq.bands[band].frequency = next();
    out->eq.bands[band].gain_db = next();
    out->eq.bands[band].quality = next();
    out->eq.bands[band].dynamic = flag();
    out->eq.bands[band].threshold_db = next();
  }
  return 1;
}

}  // extern "C"
