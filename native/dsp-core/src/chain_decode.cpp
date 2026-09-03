/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * One flat array of doubles into a `FeqChainSettings`.
 *
 * This layout has exactly one writer: `encodeChainSettings` in
 * `src/common/dsp/chainWire.ts`. The fixture generator's `chainParams` is a
 * one-line alias to it rather than a second implementation, which is the point
 * — the fixtures push twenty-seven whole-chain cases through this decoder
 * against the real worklet, so the decoder the app depends on at runtime is the
 * decoder those fixtures exercise, and a field added to the encoder cannot
 * reach the app through a path the fixtures never saw.
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

  // Denoise, in the order `encodeChainSettings` writes it. Immediately before
  // the band count, which stays last.
  out->denoise.enabled = flag();
  out->denoise.isolate = flag();
  out->denoise.profile_source =
      static_cast<FeqDenoiseProfileSource>(static_cast<int>(next()));
  out->denoise.hiss.enabled = flag();
  out->denoise.hiss.amount = next();
  out->denoise.hiss.floor_db = next();
  out->denoise.hiss.sensitivity_db = next();
  out->denoise.hiss.smoothing = next();
  out->denoise.hum.enabled = flag();
  out->denoise.hum.mode =
      static_cast<FeqDenoiseHumMode>(static_cast<int>(next()));
  out->denoise.hum.harmonics = next();
  out->denoise.hum.depth_db = next();
  out->denoise.hum.quality = next();
  out->denoise.click.enabled = flag();
  out->denoise.click.sensitivity = next();
  out->denoise.click.max_repair_samples = next();
  out->denoise.voice.enabled = flag();
  out->denoise.voice.mode =
      static_cast<FeqDenoiseVoiceMode>(static_cast<int>(next()));
  out->denoise.voice.amount = next();

  // Before the band count and not after it, matching `encodeChainSettings`.
  // The band count is the slot the length check reads to size the band array,
  // so a stage appended behind it keeps every payload valid and shifts every
  // band by one field into something that still decodes.
  out->bass_forge.enabled = flag();
  out->bass_forge.isolate = flag();
  out->bass_forge.split_hz = next();
  out->bass_forge.drive_db = next();
  out->bass_forge.sub_amount = next();
  out->bass_forge.presence_amount = next();
  out->bass_forge.texture = next();
  out->bass_forge.mix = next();

  out->bass_punch.enabled = flag();
  out->bass_punch.isolate = flag();
  out->bass_punch.split_hz = next();
  out->bass_punch.attack = next();
  out->bass_punch.sustain = next();
  out->bass_punch.bloom_amount = next();
  out->bass_punch.bloom_decay_ms = next();
  out->bass_punch.duck = next();

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
