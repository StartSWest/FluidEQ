/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * One flat array of doubles into a `FeqChainSettings`.
 *
 * This layout has exactly one writer: `encodeChainSettings` in
 * `src/common/dsp/chainWire.ts`. A layout the two sides disagree about does
 * not fail — it decodes a Q as a threshold and still sounds like music — so
 * this decoder is held to the encoder's own output, never to a hand-written
 * line. `dsp_chain_test.cpp` in system-apo decodes a line frozen from the
 * encoder and checks where its fields landed; `preset_safety_test.cpp`
 * decodes the whole factory catalogue as the encoder writes it before the
 * suite runs, and fails on any rack that does not decode.
 *
 * The whole-chain parity fixtures never reach this decoder: they were frozen
 * in the layout of 929e5d397, which this one has outgrown, and
 * `parity_test.cpp` reads them with its own reader of that layout.
 *
 * The variable-length part, the EQ's bands, is last on purpose: everything
 * before it sits at a fixed offset, so adding a scalar cannot silently
 * re-point sixty-four bands.
 */

#include "fluideq/chain.h"
#include <cmath>

namespace {

/**
 * Where the De-esser's words start: after the master switch and the retired
 * guard (2), the Exciter (9 and three bands of 6), the EQ's eleven, and the
 * compressor's old switch.
 */
constexpr uint32_t kDeEsserSlot = 2 + 9 + 18 + 11 + 1;
constexpr uint32_t kDeEsserModeSlot = kDeEsserSlot + 7;
constexpr uint32_t kDeEsserSignatureSlot = kDeEsserSlot + FEQ_CHAIN_DEESSER_FIELDS;

/** Whether the line's De-esser words are the De-esser's (`chain.h`). */
bool signs_deesser(const double* values) {
  return values[kDeEsserSignatureSlot] == FEQ_CHAIN_DEESSER_SIGNATURE &&
         values[kDeEsserSignatureSlot + 1] == FEQ_CHAIN_DEESSER_FIELDS;
}

}  // namespace

extern "C" {

int feq_chain_settings_decode(const double* values,
                              uint32_t count,
                              FeqChainSettings* out) {
  if (values == nullptr || out == nullptr || count < FEQ_CHAIN_PARAM_LEAD) {
    return 0;
  }
  const double bands = values[FEQ_CHAIN_PARAM_LEAD - 1];
  if (!std::isfinite(bands) || bands < 0 || bands > FEQ_CHAIN_MAX_EQ_BANDS ||
      std::floor(bands) != bands) {
    return 0;
  }
  const auto band_count = static_cast<uint32_t>(bands);
  // Asserted rather than assumed: a layout the two sides disagree about would
  // read a Q as a threshold and still sound plausible.
  const uint32_t legacy_count = FEQ_CHAIN_PARAM_LEAD +
                   static_cast<uint32_t>(band_count) * FEQ_CHAIN_BAND_PARAMS;
  // Validate before writing out: a refused snapshot leaves the live rack alone.
  for (uint32_t index = 0; index < count; ++index) {
    if (!std::isfinite(values[index])) return 0;
  }

  // A trailer leaves every existing band offset intact. Older saved snapshots
  // still decode with the normalizer off instead of shifting their EQ bands.
  // After the normalizer's three comes game mode's one — written only when it
  // is on, or when a tagged trailer follows it — then the Room's trailer and
  // the tone's, each recognised by its tag and each only where the one before
  // it may stand. Anything else is a line this engine does not know.
  const uint32_t tail = count - legacy_count;
  if (count < legacy_count || tail == 1 || tail == 2) {
    return 0;
  }
  const bool has_normalizer = tail >= 3;
  const bool has_low_latency = tail >= 4;
  uint32_t trailer_at = legacy_count + 4;
  const bool extended_room =
      has_low_latency && count > trailer_at &&
      values[trailer_at] == FEQ_CHAIN_ROOM_TAG;
  if (extended_room) {
    if (count < trailer_at + FEQ_CHAIN_ROOM_TRAILER) return 0;
    trailer_at += FEQ_CHAIN_ROOM_TRAILER;
  }
  const bool has_tone = has_low_latency && count > trailer_at;
  uint32_t tone_bands = 0;
  if (has_tone) {
    const double* tone = values + trailer_at;
    if (count < trailer_at + FEQ_CHAIN_TONE_HEADER ||
        tone[0] != FEQ_CHAIN_TONE_TAG || tone[1] != FEQ_CHAIN_TONE_SCHEMA ||
        tone[2] < 1 || tone[2] > FEQ_CHAIN_MAX_TONE_BANDS ||
        std::floor(tone[2]) != tone[2] || (tone[3] != 0 && tone[3] != 1)) {
      return 0;
    }
    tone_bands = static_cast<uint32_t>(tone[2]);
    if (count != trailer_at + FEQ_CHAIN_TONE_HEADER +
                     tone_bands * FEQ_CHAIN_TONE_BAND_PARAMS) {
      return 0;
    }
    // Bells and shelves only, the bands with an inverse, at values a curve
    // can hold.
    for (uint32_t band = 0; band < tone_bands; ++band) {
      const double* read =
          tone + FEQ_CHAIN_TONE_HEADER + band * FEQ_CHAIN_TONE_BAND_PARAMS;
      const bool bell_or_shelf =
          read[0] == static_cast<double>(FEQ_FILTER_PK) ||
          read[0] == static_cast<double>(FEQ_FILTER_LSC) ||
          read[0] == static_cast<double>(FEQ_FILTER_HSC);
      if (!bell_or_shelf || read[1] < 10 || read[1] > 40000 ||
          read[2] < -30 || read[2] > 30 || read[3] < 0.05 || read[3] > 40) {
        return 0;
      }
    }
  }
  if (has_low_latency) {
    const double low_latency = values[legacy_count + 3];
    if (low_latency != 0.0 && low_latency != 1.0) return 0;
  }
  if (has_normalizer) {
    const double mode = values[legacy_count];
    const double ceiling = values[legacy_count + 1];
    const double target = values[legacy_count + 2];
    if (mode < 0 || mode > 2 || std::floor(mode) != mode ||
        ceiling < -12 || ceiling > -0.1 || target < -24 || target > -5) {
      return 0;
    }
  }
  if (extended_room) {
    const double* room = values + legacy_count + 4;
    if (room[1] != FEQ_CHAIN_ROOM_SCHEMA || room[2] != FEQ_CHAIN_ROOM_FIELDS ||
        (room[3] != 1 && room[3] != 2) || room[4] < -60 || room[4] > 0 ||
        room[5] < 0 || room[5] > 1 || room[6] < 0.1 || room[6] > 1.8 ||
        room[7] < 1000 || room[7] > 12000) {
      return 0;
    }
    for (uint32_t index = 8; index < FEQ_CHAIN_ROOM_TRAILER; ++index) {
      if (room[index] != 0 && room[index] != 1) return 0;
    }
  }

  // The De-esser's mode is an index; in a line that signs its De-esser words,
  // anything but its three is a line this engine does not know. Checked
  // before `out` is touched, like the rest.
  const bool has_deesser = signs_deesser(values);
  if (has_deesser) {
    const double mode = values[kDeEsserModeSlot];
    if (mode != 0.0 && mode != 1.0 && mode != 2.0) {
      return 0;
    }
  }

  feq_chain_settings_defaults(out);
  uint32_t at = 0;
  const auto next = [values, &at]() { return values[at++]; };
  const auto flag = [&next]() { return next() != 0.0 ? 1 : 0; };

  out->enabled = flag();
  // The second word was the final guard's switch until 2026-09-22, when the
  // guard was removed. The slot stays so no band moves; the app writes a 0
  // there, which also keeps an older engine's guard off.
  next();

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

  // The multiband compressor's eighteen words — switch, two corners, three
  // bands of five — until it was removed on 2026-09-22. The layout keeps
  // them, so no band moves. The first is still the compressor's switch,
  // written 0 for the engines from before it went; the De-esser's twelve
  // follow, which every engine since reads and ignores; the last five are
  // zeros but for the signature pair (`chainWire.ts`). A line without the
  // pair keeps the De-esser at its defaults, which are off: it was written
  // before the stage, and its words there are a compressor's.
  next();
  if (has_deesser) {
    out->deesser.enabled = flag();
    out->deesser.isolate = flag();
    out->deesser.sensitivity = next();
    out->deesser.low_hz = next();
    out->deesser.high_hz = next();
    out->deesser.range_db = next();
    out->deesser.width_oct = next();
    out->deesser.mode = static_cast<int>(next());
    out->deesser.attack_ms = next();
    out->deesser.release_ms = next();
    out->deesser.centre_only = flag();
    out->deesser.keep_cymbals = next();
    at += 5;
  } else {
    at += 17;
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
  out->bass_punch.mix = next();

  out->room.enabled = flag();
  out->room.preset = static_cast<int>(next());
  out->room.size_m = next();
  out->room.walls = next();
  out->room.distance_m = next();
  out->room.centre_db = next();
  out->room.sub_db = next();
  out->room.head = static_cast<int>(next());
  // The Room's retired headphone slot, which carries the EQ's Treble choice
  // since 1.16 (`FeqChainEqSettings::matched`).
  out->eq.matched = flag();
  for (int speaker = 0; speaker < FEQ_ROOM_SPEAKERS; ++speaker) {
    out->room.angle_deg[speaker] = next();
  }
  for (int speaker = 0; speaker < FEQ_ROOM_SPEAKERS; ++speaker) {
    out->room.level_db[speaker] = next();
  }
  out->room.bass_management = flag();
  out->room.crossover_hz = next();
  out->room.music_upmix = flag();
  out->room.upmix_amount = next();
  for (int speaker = 0; speaker < FEQ_ROOM_SPEAKERS; ++speaker) {
    out->room.speaker_distance_m[speaker] = next();
  }
  for (int slot = 0; slot < FEQ_ROOM_SPEAKERS + 1; ++slot) {
    // Not a flag: `FEQ_ROOM_MUTED` and `FEQ_ROOM_HUSHED` both ride here.
    // Anything else is a wire this engine does not know, read as the plain
    // mute every engine before this made of any value but 0.
    const double value = next();
    out->room.mute[slot] = value == 0.0   ? 0
                           : value == 2.0 ? FEQ_ROOM_HUSHED
                           : value == 3.0 ? FEQ_ROOM_MUTED | FEQ_ROOM_HUSHED
                                          : FEQ_ROOM_MUTED;
  }

  out->surround_all_channels = flag();

  // What the Master's loudness target may spend on limiting. Last before the
  // band count, where a new scalar goes: see `chainWire.ts`.
  out->master.peak_limiting_db = next();

  out->eq.band_count = static_cast<uint32_t>(next());
  if (at != FEQ_CHAIN_PARAM_LEAD) {
    return 0;
  }
  for (uint32_t band = 0; band < out->eq.band_count; ++band) {
    // The switch word carries the ear (`FeqChainEqBand::ear`): 1 both, 2
    // left, 3 right. Any other non-zero word is on, on both ears, which is
    // what every engine before the ear made of it.
    const double on = next();
    out->eq.bands[band].enabled = on != 0.0 ? 1 : 0;
    out->eq.bands[band].ear = on == 2.0 ? 1 : (on == 3.0 ? 2 : 0);
    out->eq.bands[band].type =
        static_cast<FeqFilterType>(static_cast<int>(next()));
    out->eq.bands[band].frequency = next();
    out->eq.bands[band].gain_db = next();
    out->eq.bands[band].quality = next();
    out->eq.bands[band].dynamic = flag();
    out->eq.bands[band].threshold_db = next();
  }
  if (has_normalizer) {
    const double mode = next();
    const double ceiling = next();
    const double target = next();
    out->normalizer.mode = static_cast<int>(mode);
    out->normalizer.ceiling_db = ceiling;
    out->normalizer.target_lufs = target;
  }
  if (has_low_latency) {
    out->low_latency = flag();
  }
  if (extended_room) {
    at += 3; // validated tag, schema and payload length
    out->room.renderer_version = static_cast<int>(next());
    out->room.early_reflection_db = next();
    out->room.ambience_mix = next();
    out->room.ambience_decay_s = next();
    out->room.ambience_damping_hz = next();
    out->room.preserve_position = flag();
    out->room.compare_original = flag();
    out->room.source_already_spatial = flag();
  }
  if (has_tone) {
    at += 3; // validated tag, schema and band count
    out->tone.band_count = tone_bands;
    out->tone.matched = flag();
    for (uint32_t band = 0; band < tone_bands; ++band) {
      out->tone.bands[band].type =
          static_cast<FeqFilterType>(static_cast<int>(next()));
      out->tone.bands[band].frequency = next();
      out->tone.bands[band].gain_db = next();
      out->tone.bands[band].quality = next();
    }
  }
  return at == count ? 1 : 0;
}

}  // extern "C"
