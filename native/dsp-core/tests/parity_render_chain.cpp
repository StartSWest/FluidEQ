/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** The whole chain, decoded from the layout the corpus was frozen with. */
#include "parity_fixture.h"

namespace feq_parity {

namespace {

/**
 * The lead the corpus was frozen with, which is not the wire's lead today.
 *
 * `FEQ_CHAIN_PARAM_LEAD` moves whenever a stage joins the rack; the corpus was
 * frozen at 929e5d397, when it was 112, and cannot move with it. Read from the
 * fixtures themselves: each of the twenty-seven is exactly
 * `112 + 7 * params[111]` doubles long, and no other lead accounts for any of
 * them. Keyed to the live constant, this reader turned every one away before a
 * single field was read, from the day the wire's lead first moved past it
 * (113, 2026-09-03).
 */
constexpr size_t kChainFrozenLead = 112;
constexpr size_t kChainFrozenBandParams = 7;
constexpr size_t kChainFrozenExciterBands = 3;
/** The compressor the frozen racks carried: a switch, two corners, three
 * bands of five. The stage is gone; its words are read past. */
constexpr size_t kChainFrozenCompressorWords = 18;
static_assert(FEQ_CHAIN_EXCITER_BANDS == kChainFrozenExciterBands,
              "the frozen chain fixtures carry three exciter bands; what they "
              "mean to a rack with another number is a decision, not "
              "something this reader can guess");

/**
 * Refuses a whole-chain fixture out loud: printed, and the run fails.
 *
 * Never a quiet `false`, which `render` counts as "pending — no native
 * implementation yet" and which never fails a run. The whole chain has had a
 * native implementation since the day it was ported, so a chain fixture that
 * is not run is a reader that has stopped matching the corpus.
 */
bool refuse_chain(const Fixture& fixture, const char* reason) {
  g_chain_layout_stale = true;
  std::printf("  CHAIN LAYOUT STALE %s: %s\n", fixture.name.c_str(), reason);
  return false;
}

}  // namespace

/**
 * The whole chain, decoded from the flat block `encodeChainSettings` wrote
 * when the corpus was frozen.
 *
 * Field for field and in that order, which is no longer the wire's. What the
 * rack gained since is not in the corpus and stays at
 * `feq_chain_settings_defaults`: the Room and the normalizer off, the surround
 * switch idle on a stereo chain, and Voice's mode and Punch's mix under stages
 * no frozen rack turns on. The variable-length part — the EQ's bands — is
 * last, so everything before it sits at a fixed offset.
 */
bool render_chain(const Fixture& fixture, std::vector<float>& actual) {
  if (fixture.params.size() < kChainFrozenLead) {
    return refuse_chain(fixture, "its block is shorter than the frozen lead");
  }
  const double bands = fixture.params[kChainFrozenLead - 1];
  if (!(bands >= 0.0 && bands <= FEQ_CHAIN_MAX_EQ_BANDS) ||
      std::floor(bands) != bands) {
    return refuse_chain(fixture,
                        "the frozen lead does not end in a band count");
  }
  const auto band_count = static_cast<uint32_t>(bands);
  if (fixture.params.size() !=
      kChainFrozenLead +
          static_cast<size_t>(band_count) * kChainFrozenBandParams) {
    return refuse_chain(
        fixture, "its block is not the frozen lead and that many bands");
  }

  FeqChainSettings settings;
  feq_chain_settings_defaults(&settings);
  size_t at = 0;
  const auto next = [&fixture, &at]() { return fixture.params[at++]; };
  const auto flag = [&next]() { return next() != 0.0 ? 1 : 0; };

  settings.enabled = flag();
  // The final guard's switch, still in the frozen layout; the guard is gone.
  flag();
  settings.exciter.enabled = flag();
  settings.exciter.isolate = flag();
  settings.exciter.stereo = static_cast<FeqStereoMode>(
      static_cast<int>(next()));
  settings.exciter.align_enabled = flag();
  settings.exciter.align_amount = next();
  settings.exciter.organic_enabled = flag();
  settings.exciter.organic_amount = next();
  settings.exciter.organic_focus_hz = next();
  settings.exciter.organic_range = next();
  for (size_t index = 0; index < kChainFrozenExciterBands; ++index) {
    auto& band = settings.exciter.bands[index];
    band.enabled = flag();
    band.freq_hz = next();
    band.range = next();
    band.drive = next();
    band.mix = next();
    band.texture = next();
  }

  settings.eq.enabled = flag();
  settings.eq.isolate = flag();
  settings.eq.model = static_cast<FeqEqModel>(static_cast<int>(next()));
  settings.eq.model_amount = next();
  settings.eq.engine = static_cast<FeqEqEngine>(static_cast<int>(next()));
  settings.eq.phase = static_cast<FeqPhaseMode>(static_cast<int>(next()));
  settings.eq.stereo = static_cast<FeqStereoMode>(static_cast<int>(next()));
  settings.eq.mono_below_hz = next();
  settings.eq.oversample = static_cast<uint32_t>(next());
  settings.eq.subsonic_hz = next();
  settings.eq.fuzz_amount = next();

  for (size_t word = 0; word < kChainFrozenCompressorWords; ++word) {
    next();
  }

  settings.dimension.enabled = flag();
  settings.dimension.low_width = next();
  settings.dimension.mid_width = next();
  settings.dimension.high_width = next();
  settings.dimension.low_hz = next();
  settings.dimension.high_hz = next();
  settings.dimension.decorrelation = next();
  settings.maximizer.enabled = flag();
  settings.maximizer.drive_db = next();
  settings.maximizer.ceiling_db = next();
  settings.maximizer.look_ahead_ms = next();
  settings.maximizer.release_ms = next();

  settings.master.enabled = flag();
  settings.master.output_trim_db = next();
  settings.master.loudness_maximize = flag();
  settings.master.loudness_target_lufs = next();
  settings.master.ceiling_db = next();
  settings.master.release_ms = next();
  settings.master.matched_bypass = flag();

  // Denoise, in the order it was frozen in.
  settings.denoise.enabled = flag();
  settings.denoise.isolate = flag();
  settings.denoise.profile_source =
      static_cast<FeqDenoiseProfileSource>(static_cast<int>(next()));
  settings.denoise.hiss.enabled = flag();
  settings.denoise.hiss.amount = next();
  settings.denoise.hiss.floor_db = next();
  settings.denoise.hiss.sensitivity_db = next();
  settings.denoise.hiss.smoothing = next();
  settings.denoise.hum.enabled = flag();
  settings.denoise.hum.mode =
      static_cast<FeqDenoiseHumMode>(static_cast<int>(next()));
  settings.denoise.hum.harmonics = next();
  settings.denoise.hum.depth_db = next();
  settings.denoise.hum.quality = next();
  settings.denoise.click.enabled = flag();
  settings.denoise.click.sensitivity = next();
  settings.denoise.click.max_repair_samples = next();
  settings.denoise.voice.enabled = flag();
  // Adjacent here, and not on today's wire: Voice's mode went between them
  // after the freeze. Brought in line with `chain_decode.cpp`, this reader
  // would read every field from here on one slot late.
  settings.denoise.voice.amount = next();

  settings.bass_forge.enabled = flag();
  settings.bass_forge.isolate = flag();
  settings.bass_forge.split_hz = next();
  settings.bass_forge.drive_db = next();
  settings.bass_forge.sub_amount = next();
  settings.bass_forge.presence_amount = next();
  settings.bass_forge.texture = next();
  settings.bass_forge.mix = next();

  settings.bass_punch.enabled = flag();
  settings.bass_punch.isolate = flag();
  settings.bass_punch.split_hz = next();
  settings.bass_punch.attack = next();
  settings.bass_punch.sustain = next();
  settings.bass_punch.bloom_amount = next();
  settings.bass_punch.bloom_decay_ms = next();
  settings.bass_punch.duck = next();
  // Punch's mix, the Room and the surround switch all came after the freeze,
  // so in this layout the band count follows `duck` directly.

  settings.eq.band_count = static_cast<uint32_t>(next());
  if (at != kChainFrozenLead) {
    /**
     * Asserted rather than assumed: a layout the corpus and the runner
     * disagree about would read a Q as a threshold and still sound plausible.
     *
     * Against the frozen lead and never the wire's, and out loud, because the
     * silent version of this has now hidden these fixtures twice. Falling out
     * of `render` counts a fixture as "pending", which never fails a run. The
     * first time, this reader stopped at 78 of the wire's 110 fields while the
     * corpus was still being generated from the TypeScript rack. The second,
     * the corpus had been frozen at 112 and the wire had moved on without it,
     * and the size checks above — keyed to the wire's lead — turned every
     * fixture away before this check could speak. Both times the suite went
     * on reporting "parity passed" over the only fixtures that test the
     * orchestration: stage order, the mid/side wrapper, the meter taps.
     */
    char reason[96];
    std::snprintf(reason, sizeof reason,
                  "this runner reads %zu of the %zu lead fields the corpus was "
                  "frozen with",
                  at, kChainFrozenLead);
    return refuse_chain(fixture, reason);
  }
  for (uint32_t band = 0; band < band_count; ++band) {
    settings.eq.bands[band].enabled = flag();
    settings.eq.bands[band].type =
        static_cast<FeqFilterType>(static_cast<int>(next()));
    settings.eq.bands[band].frequency = next();
    settings.eq.bands[band].gain_db = next();
    settings.eq.bands[band].quality = next();
    settings.eq.bands[band].dynamic = flag();
    settings.eq.bands[band].threshold_db = next();
  }

  /**
   * Fed in 128-frame render quanta, because that is what the reference sees.
   *
   * Handing the whole track over in one call would be a legitimate thing to
   * ask of the chain, and would not compare: every smoothing ramp in it is
   * per-block, so a block of 12288 reaches its target 96 times more slowly.
   * That difference is the orchestration, which is what this fixture is for.
   */
  FeqChain* chain = feq_chain_create(static_cast<double>(fixture.sample_rate),
                                     fixture.channels, 128);
  if (chain == nullptr) {
    return false;
  }
  feq_chain_configure(chain, &settings);

  /**
   * Compared late by the delay the chain has gained since the freeze, which
   * is Bass Punch's.
   *
   * Punch has kept its FIR's alignment under bypass since 2026-09-06, so every
   * rack of two or more channels leaves the chain 549 frames later at 48 kHz
   * than the frozen rack did, Punch on or off. The input is followed by that
   * much silence and the output read from that far in, so every frozen frame
   * is still compared, against the frame that carries it now.
   *
   * Punch's latency and not `feq_chain_latency_frames`, which is the chain's
   * delay for a deck's crossfade: the look-ahead of its final stages is in
   * every frozen output already, so a chain that counts it there too would be
   * compensated for it twice.
   */
  const uint32_t latency =
      fixture.channels >= 2 ? feq_bass_punch_latency_frames(
                                  static_cast<double>(fixture.sample_rate))
                            : 0u;
  const uint32_t total = fixture.frames + latency;
  std::vector<float> rendered(static_cast<size_t>(fixture.channels) * total,
                              0.0f);
  for (uint32_t channel = 0; channel < fixture.channels; ++channel) {
    const float* source = fixture.input.data() +
                          static_cast<size_t>(channel) * fixture.frames;
    std::copy(source, source + fixture.frames,
              channel_at(rendered, channel, total));
  }
  std::vector<float*> pointers(fixture.channels);
  for (uint32_t offset = 0; offset < total; offset += 128) {
    const uint32_t span = std::min(128u, total - offset);
    for (uint32_t channel = 0; channel < fixture.channels; ++channel) {
      pointers[channel] = channel_at(rendered, channel, total) + offset;
    }
    feq_chain_process(chain, pointers.data(), span);
  }
  feq_chain_destroy(chain);

  actual.resize(fixture.input.size());
  for (uint32_t channel = 0; channel < fixture.channels; ++channel) {
    const float* delayed = channel_at(rendered, channel, total) + latency;
    std::copy(delayed, delayed + fixture.frames,
              channel_at(actual, channel, fixture.frames));
  }
  return true;
}

}  // namespace feq_parity
