/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** A renderer for every processor the corpus holds, and the dispatch to them. */
#include "parity_fixture.h"

namespace feq_parity {

namespace {

bool render_biquad(const Fixture& fixture, std::vector<float>& actual) {
  if (fixture.params.size() < 4) {
    return false;
  }
  const FeqBiquadCoefficients coefficients = feq_biquad_coefficients(
      static_cast<FeqFilterType>(static_cast<int>(fixture.params[0])),
      fixture.params[1], fixture.params[2], fixture.params[3],
      static_cast<double>(fixture.sample_rate));

  actual = fixture.input;
  for (uint32_t channel = 0; channel < fixture.channels; ++channel) {
    FeqBiquadState state;
    feq_biquad_reset(&state);
    feq_biquad_process(&state, channel_at(actual, channel, fixture.frames),
                       fixture.frames, &coefficients);
  }
  return true;
}

/** Per-channel racks: filter history AND detector are channel-local. */
bool render_eq(const Fixture& fixture, std::vector<float>& actual) {
  Rack rack;
  if (!parse_rack(fixture, 0, static_cast<double>(fixture.sample_rate), rack)) {
    return false;
  }
  actual = fixture.input;
  std::vector<float> dry(fixture.frames);
  std::vector<float> wet(fixture.frames);
  bool engaged = false;
  for (uint32_t channel = 0; channel < fixture.channels; ++channel) {
    auto states = fresh_states(rack.band_count);
    auto dynamics =
        build_dynamics(rack, static_cast<double>(fixture.sample_rate));
    feq_eq_process_bands(states.data(), rack.coefficients.data(),
                         rack.band_count,
                         channel_at(actual, channel, fixture.frames),
                         fixture.frames, rack.engine, dry.data(), wet.data(),
                         dynamics.data());
    engaged = engaged || engaged_in(dynamics);
  }
  note_coverage(rack.has_dynamic, engaged);
  return true;
}

/** One detector for every channel; histories still channel-local. */
bool render_eq_linked(const Fixture& fixture, std::vector<float>& actual) {
  Rack rack;
  if (!parse_rack(fixture, 0, static_cast<double>(fixture.sample_rate), rack)) {
    return false;
  }
  actual = fixture.input;
  const uint32_t channels = fixture.channels;
  auto states = fresh_states(channels * rack.band_count);
  auto dynamics = build_dynamics(rack, static_cast<double>(fixture.sample_rate));

  std::vector<std::vector<float>> dry(channels,
                                      std::vector<float>(fixture.frames));
  std::vector<std::vector<float>> wet(channels,
                                      std::vector<float>(fixture.frames));
  std::vector<float*> targets(channels);
  std::vector<float*> dry_pointers(channels);
  std::vector<float*> wet_pointers(channels);
  for (uint32_t channel = 0; channel < channels; ++channel) {
    targets[channel] = channel_at(actual, channel, fixture.frames);
    dry_pointers[channel] = dry[channel].data();
    wet_pointers[channel] = wet[channel].data();
  }

  feq_eq_process_bands_linked(states.data(), rack.band_count, rack.coefficients.data(),
                              rack.band_count, targets.data(), channels,
                              fixture.frames, rack.engine, dry_pointers.data(),
                              wet_pointers.data(), dynamics.data());
  note_coverage(rack.has_dynamic, engaged_in(dynamics));
  return true;
}

bool render_eq_oversampled(const Fixture& fixture, std::vector<float>& actual,
                           bool linked) {
  if (fixture.params.empty()) {
    return false;
  }
  const auto factor = static_cast<uint32_t>(fixture.params[0]);
  if (factor != 2 && factor != 4) {
    return false;
  }
  const double filter_rate =
      static_cast<double>(fixture.sample_rate) * static_cast<double>(factor);
  Rack rack;
  if (!parse_rack(fixture, 1, filter_rate, rack)) {
    return false;
  }

  actual = fixture.input;
  const uint32_t channels = fixture.channels;
  const uint32_t doubled_frames = fixture.frames * factor;

  std::vector<FeqOversampler> oversamplers(channels);
  for (auto& oversampler : oversamplers) {
    feq_oversampler_reset(&oversampler);
  }
  std::vector<std::vector<float>> doubled(
      channels, std::vector<float>(doubled_frames));
  std::vector<std::vector<float>> dry(channels,
                                      std::vector<float>(doubled_frames));
  std::vector<std::vector<float>> wet(channels,
                                      std::vector<float>(doubled_frames));
  // The 4x path needs an intermediate at twice the block; the reference
  // allocates it lazily and the port refuses to, so it is supplied here.
  std::vector<std::vector<float>> middle(channels,
                                         std::vector<float>(doubled_frames));

  std::vector<float*> targets(channels);
  std::vector<float*> doubled_pointers(channels);
  std::vector<float*> dry_pointers(channels);
  std::vector<float*> wet_pointers(channels);
  std::vector<float*> middle_pointers(channels);
  for (uint32_t channel = 0; channel < channels; ++channel) {
    targets[channel] = channel_at(actual, channel, fixture.frames);
    doubled_pointers[channel] = doubled[channel].data();
    dry_pointers[channel] = dry[channel].data();
    wet_pointers[channel] = wet[channel].data();
    middle_pointers[channel] = middle[channel].data();
  }

  if (linked) {
    auto states = fresh_states(channels * rack.band_count);
    auto dynamics = build_dynamics(rack, filter_rate);
    feq_eq_process_oversampled_linked(
        states.data(), rack.band_count, rack.coefficients.data(),
        rack.band_count,
        targets.data(), channels, fixture.frames, rack.engine,
        oversamplers.data(), factor, doubled_pointers.data(),
        dry_pointers.data(), wet_pointers.data(), middle_pointers.data(),
        dynamics.data());
    note_coverage(rack.has_dynamic, engaged_in(dynamics));
    return true;
  }

  bool engaged = false;
  for (uint32_t channel = 0; channel < channels; ++channel) {
    auto states = fresh_states(rack.band_count);
    auto dynamics = build_dynamics(rack, filter_rate);
    feq_eq_process_oversampled(
        states.data(), rack.coefficients.data(), rack.band_count,
        targets[channel], fixture.frames, rack.engine, &oversamplers[channel],
        factor, doubled_pointers[channel], dry_pointers[channel],
        wet_pointers[channel], middle_pointers[channel], dynamics.data());
    engaged = engaged || engaged_in(dynamics);
  }
  note_coverage(rack.has_dynamic, engaged);
  return true;
}

bool render_delay(const Fixture& fixture, std::vector<float>& actual) {
  if (fixture.params.empty()) {
    return false;
  }
  const auto delay = static_cast<uint32_t>(fixture.params[0]);
  actual = fixture.input;
  for (uint32_t channel = 0; channel < fixture.channels; ++channel) {
    std::vector<float> line(delay + 1);
    FeqDelayLine state;
    feq_delay_line_init(&state, line.data(), delay + 1, delay);
    feq_delay_line_process(&state, channel_at(actual, channel, fixture.frames),
                           fixture.frames);
  }
  return true;
}

bool render_crossover(const Fixture& fixture, std::vector<float>& actual) {
  if (fixture.params.size() < 3) {
    return false;
  }
  const auto band = static_cast<int>(fixture.params[0]);
  actual.assign(fixture.input.size(), 0.0f);
  std::vector<float> low(fixture.frames);
  std::vector<float> mid(fixture.frames);
  std::vector<float> high(fixture.frames);
  for (uint32_t channel = 0; channel < fixture.channels; ++channel) {
    FeqCrossover state;
    feq_crossover_reset(&state);
    feq_crossover_split(
        &state,
        fixture.input.data() + static_cast<size_t>(channel) * fixture.frames,
        low.data(), mid.data(), high.data(), fixture.frames,
        fixture.params[1], fixture.params[2],
        static_cast<double>(fixture.sample_rate));
    const std::vector<float>& chosen = band == 0 ? low : (band == 1 ? mid : high);
    std::copy(chosen.begin(), chosen.end(),
              actual.begin() + static_cast<size_t>(channel) * fixture.frames);
  }
  return true;
}

bool render_true_peak(const Fixture& fixture, std::vector<float>& actual) {
  if (fixture.params.empty()) {
    return false;
  }
  const auto factor = static_cast<uint32_t>(fixture.params[0]);
  actual.assign(fixture.input.size(), 0.0f);
  for (uint32_t channel = 0; channel < fixture.channels; ++channel) {
    FeqTruePeak state;
    feq_true_peak_init(&state, factor);
    const size_t base = static_cast<size_t>(channel) * fixture.frames;
    for (uint32_t at = 0; at < fixture.frames; ++at) {
      actual[base + at] = static_cast<float>(feq_true_peak_sample(
          &state, static_cast<double>(fixture.input[base + at])));
    }
  }
  return true;
}

bool render_saturate(const Fixture& fixture, std::vector<float>& actual) {
  if (fixture.params.size() < 2) {
    return false;
  }
  actual = fixture.input;
  std::vector<float> oversampled(static_cast<size_t>(fixture.frames) *
                                 FEQ_SATURATE_MAX_OVERSAMPLE);
  std::vector<float> middle(static_cast<size_t>(fixture.frames) * 2);
  for (uint32_t channel = 0; channel < fixture.channels; ++channel) {
    FeqSaturator state;
    feq_saturator_reset(&state);
    feq_saturate_block(&state, channel_at(actual, channel, fixture.frames),
                       fixture.frames, fixture.params[0], fixture.params[1],
                       static_cast<double>(fixture.sample_rate),
                       oversampled.data(), middle.data());
  }
  return true;
}

/** `[lookAhead, ceiling, release, limitingRelease, kneeDb, activation]`. */
bool render_limiter(const Fixture& fixture, std::vector<float>& actual) {
  if (fixture.params.size() < 6) {
    return false;
  }
  /**
   * `max(1, lookAhead) + 1`, which is what `createLimiterState` computes.
   *
   * Not `lookAhead + 1`. At a look-ahead of zero the reference still allocates
   * two slots, so its effective look-ahead is one sample and the emitted value
   * comes from the delay rather than straight from the input. Written the
   * obvious way this port took the other branch entirely, and every
   * zero-look-ahead fixture failed by up to full scale — which is exactly the
   * branch a corpus without a zero case would never have exercised.
   */
  const auto requested = static_cast<uint32_t>(fixture.params[0]);
  const uint32_t capacity = (requested < 1 ? 1 : requested) + 1;
  FeqLimiterOptions options{};
  options.ceiling = fixture.params[1];
  options.release_coefficient = fixture.params[2];
  options.limiting_release_coefficient = fixture.params[3];
  options.knee_db = fixture.params[4];
  options.activation_threshold = fixture.params[5];

  actual = fixture.input;
  for (uint32_t channel = 0; channel < fixture.channels; ++channel) {
    std::vector<float> delay(capacity);
    std::vector<float> magnitude(capacity);
    std::vector<int64_t> window(capacity);
    FeqLimiter state;
    feq_limiter_init(&state, delay.data(), magnitude.data(), window.data(),
                     capacity, FEQ_TRUE_PEAK_FACTOR);
    float* channel_data = channel_at(actual, channel, fixture.frames);
    feq_limiter_process(&state, channel_data, channel_data, fixture.frames,
                        &options);
  }
  return true;
}

/**
 * `[lookAhead, ceiling, release, limitingRelease, kneeDb, activation,
 *   releaseHold, attackSlewDbPerSecond, snapRatio, sampleRate]`.
 */
bool render_linked_limiter(const Fixture& fixture, std::vector<float>& actual) {
  if (fixture.params.size() < 10) {
    return false;
  }
  const auto requested = static_cast<uint32_t>(fixture.params[0]);
  const uint32_t capacity = (requested < 1 ? 1 : requested) + 1;

  FeqLimiterOptions options{};
  options.ceiling = fixture.params[1];
  options.release_coefficient = fixture.params[2];
  options.limiting_release_coefficient = fixture.params[3];
  options.knee_db = fixture.params[4];
  options.activation_threshold = fixture.params[5];
  options.release_hold_samples = fixture.params[6];
  options.attack_slew_db_per_second = fixture.params[7];
  options.release_snap_ratio = fixture.params[8];
  options.sample_rate = fixture.params[9];

  actual = fixture.input;
  const uint32_t channels = fixture.channels;
  std::vector<FeqTruePeak> detectors(channels);
  std::vector<std::vector<float>> lines(channels, std::vector<float>(capacity));
  std::vector<float*> line_pointers(channels);
  std::vector<float*> targets(channels);
  for (uint32_t channel = 0; channel < channels; ++channel) {
    line_pointers[channel] = lines[channel].data();
    targets[channel] = channel_at(actual, channel, fixture.frames);
  }
  std::vector<float> reduction(capacity);

  FeqLinkedLimiter state;
  feq_linked_limiter_init(&state, detectors.data(), line_pointers.data(),
                          reduction.data(), channels, capacity,
                          FEQ_TRUE_PEAK_FACTOR);
  feq_linked_limiter_process(&state, targets.data(), fixture.frames, &options);
  return true;
}

/**
 * `[thresholdDb, ratio, attackMs, releaseMs, makeupDb]`.
 *
 * The multiband compressor is gone (`kSuperseded`), and where it stood the
 * chain now leaves the audio as it came: rendered as that, so its fixtures
 * still run and still say so.
 */
bool render_compressor(const Fixture& fixture, std::vector<float>& actual) {
  if (fixture.params.size() < 5) {
    return false;
  }
  actual = fixture.input;
  return true;
}

/**
 * `[limiterEnabled, ceiling, activation, releaseCoefficient, kneeDb, hold]`.
 *
 * The stage these fixtures were frozen from is gone (`kSuperseded`), and
 * what stands where it stood leaves every finite sample as it came and puts
 * silence where a sample was not a number (the chain's tail): rendered as
 * that, so the fixtures still run and still say so.
 */
bool render_output_safety(const Fixture& fixture, std::vector<float>& actual) {
  if (fixture.params.size() < 6) {
    return false;
  }
  actual = fixture.input;
  for (float& sample : actual) {
    if (!std::isfinite(sample)) {
      sample = 0.0f;
    }
  }
  return true;
}

/** `[enabled, outputCeilingDb, followingGainDb, releaseMs, truePeakFactor]`. */
bool render_auto_headroom(const Fixture& fixture, std::vector<float>& actual) {
  if (fixture.params.size() < 5) {
    return false;
  }
  FeqPostFilterNormalizerOptions options{};
  options.enabled = fixture.params[0] != 0.0 ? 1 : 0;
  options.output_ceiling_db = fixture.params[1];
  options.following_gain_db = fixture.params[2];
  options.release_ms = fixture.params[3];
  options.sample_rate = static_cast<double>(fixture.sample_rate);

  const uint32_t capacity =
      feq_post_filter_normalizer_look_ahead(options.sample_rate) + 1;
  const uint32_t channels = fixture.channels;

  actual = fixture.input;
  std::vector<FeqTruePeak> detectors(channels);
  std::vector<std::vector<float>> lines(channels, std::vector<float>(capacity));
  std::vector<float*> line_pointers(channels);
  std::vector<float*> targets(channels);
  for (uint32_t channel = 0; channel < channels; ++channel) {
    line_pointers[channel] = lines[channel].data();
    targets[channel] = channel_at(actual, channel, fixture.frames);
  }
  std::vector<float> reduction(capacity);

  FeqPostFilterNormalizer state;
  feq_post_filter_normalizer_init(
      &state, detectors.data(), line_pointers.data(), reduction.data(),
      channels, capacity, static_cast<uint32_t>(fixture.params[4]));
  feq_post_filter_normalizer_process(&state, targets.data(), fixture.frames,
                                     &options);
  return true;
}

/** The discriminator's amount per sample, written out as a signal. */
bool render_exciter_transient(const Fixture& fixture,
                              std::vector<float>& actual) {
  actual.assign(fixture.input.size(), 0.0f);
  for (uint32_t channel = 0; channel < fixture.channels; ++channel) {
    FeqExciterTransient state;
    feq_exciter_transient_init(&state);
    const size_t base = static_cast<size_t>(channel) * fixture.frames;
    for (uint32_t at = 0; at < fixture.frames; ++at) {
      actual[base + at] = static_cast<float>(feq_exciter_transient_sample(
          &state, static_cast<double>(fixture.input[base + at]),
          static_cast<double>(fixture.sample_rate)));
    }
  }
  return true;
}

/** `[amount]`. */
bool render_phase_align(const Fixture& fixture, std::vector<float>& actual) {
  if (fixture.params.empty()) {
    return false;
  }
  const double rate = static_cast<double>(fixture.sample_rate);

  actual = fixture.input;
  for (uint32_t channel = 0; channel < fixture.channels; ++channel) {
    FeqPhaseAlign state;
    feq_phase_align_init(&state);
    feq_phase_align_process(&state, channel_at(actual, channel, fixture.frames),
                            fixture.frames, fixture.params[0], rate);
  }
  return true;
}

/** `[amount]`. */
bool render_exciter_guard(const Fixture& fixture, std::vector<float>& actual) {
  if (fixture.params.empty()) {
    return false;
  }
  actual = fixture.input;
  for (uint32_t channel = 0; channel < fixture.channels; ++channel) {
    std::vector<float> filtered(fixture.frames);
    FeqExciterGuard state;
    feq_exciter_guard_init(&state, filtered.data());
    feq_exciter_guard_process(
        &state, channel_at(actual, channel, fixture.frames), fixture.frames,
        static_cast<double>(fixture.sample_rate), fixture.params[0]);
  }
  return true;
}

/** `[amount]`. */
bool render_organic(const Fixture& fixture, std::vector<float>& actual) {
  if (fixture.params.empty()) {
    return false;
  }
  const size_t wide = static_cast<size_t>(fixture.frames) *
                      FEQ_ORGANIC_MAX_OVERSAMPLE;
  actual = fixture.input;
  for (uint32_t channel = 0; channel < fixture.channels; ++channel) {
    std::vector<float> scratch(wide);
    std::vector<float> dry(wide);
    std::vector<float> middle(static_cast<size_t>(fixture.frames) * 2);
    FeqOrganic state;
    feq_organic_init(&state, scratch.data(), dry.data());
    feq_organic_block(&state, channel_at(actual, channel, fixture.frames),
                      fixture.frames, fixture.params[0],
                      static_cast<double>(fixture.sample_rate),
                      middle.data());
  }
  return true;
}

/** `[focusHz, range, amount]`. */
bool render_organic_path(const Fixture& fixture, std::vector<float>& actual) {
  if (fixture.params.size() < 3) {
    return false;
  }
  const size_t wide =
      static_cast<size_t>(fixture.frames) * FEQ_ORGANIC_MAX_OVERSAMPLE;
  actual.assign(fixture.input.size(), 0.0f);
  for (uint32_t channel = 0; channel < fixture.channels; ++channel) {
    std::vector<float> band(fixture.frames);
    std::vector<float> foundation(fixture.frames);
    std::vector<float> scratch(wide);
    std::vector<float> dry(wide);
    std::vector<float> guard(fixture.frames);
    std::vector<float> middle(static_cast<size_t>(fixture.frames) * 2);
    FeqOrganicPath state;
    feq_organic_path_init(&state, band.data(), foundation.data(),
                          scratch.data(), dry.data(), guard.data());
    const size_t base = static_cast<size_t>(channel) * fixture.frames;
    feq_organic_path_process(&state, fixture.input.data() + base,
                             fixture.frames, fixture.params[0],
                             fixture.params[1], fixture.params[2],
                             static_cast<double>(fixture.sample_rate),
                             middle.data());
    std::copy(band.begin(), band.end(), actual.begin() + base);
  }
  return true;
}

/** `[enabled, isolate, (enabled, hz, range, drive, mix, texture) * 3]`. */
bool render_exciter(const Fixture& fixture, std::vector<float>& actual) {
  constexpr size_t kSetupFields = 6;
  if (fixture.params.size() != 2 + FEQ_EXCITER_BANDS * kSetupFields) {
    return false;
  }
  FeqExciterSettings settings{};
  settings.enabled = fixture.params[0] != 0.0 ? 1 : 0;
  settings.isolate = fixture.params[1] != 0.0 ? 1 : 0;
  for (uint32_t band = 0; band < FEQ_EXCITER_BANDS; ++band) {
    const size_t base = 2 + static_cast<size_t>(band) * kSetupFields;
    settings.bands[band].enabled = fixture.params[base] != 0.0 ? 1 : 0;
    settings.bands[band].freq_hz = fixture.params[base + 1];
    settings.bands[band].range = fixture.params[base + 2];
    settings.bands[band].drive = fixture.params[base + 3];
    settings.bands[band].mix = fixture.params[base + 4];
    settings.bands[band].texture = fixture.params[base + 5];
  }

  const size_t wide =
      static_cast<size_t>(fixture.frames) * FEQ_EXCITER_MAX_OVERSAMPLE;
  actual = fixture.input;
  for (uint32_t channel = 0; channel < fixture.channels; ++channel) {
    std::vector<std::vector<float>> bands(
        FEQ_EXCITER_BANDS, std::vector<float>(fixture.frames));
    std::vector<float> wet(fixture.frames);
    std::vector<float> scratch(wide);
    std::vector<float> dry_wide(wide);
    std::vector<float> middle(static_cast<size_t>(fixture.frames) * 2);
    std::vector<float> dry(fixture.frames);
    std::vector<float> guard(fixture.frames);
    FeqExciterChannel state;
    feq_exciter_channel_init(&state, bands[0].data(), bands[1].data(),
                             bands[2].data(), wet.data(), scratch.data(),
                             dry_wide.data(), middle.data(), dry.data(),
                             guard.data());
    double report[FEQ_EXCITER_BANDS] = {0.0, 0.0, 0.0};
    feq_exciter_channel_process(
        &state, channel_at(actual, channel, fixture.frames), fixture.frames,
        &settings, static_cast<double>(fixture.sample_rate), report);
  }
  return true;
}

/**
 * `[kernelLength, seed]`, with the kernel rebuilt from the seed on both sides.
 *
 * The kernel travels as a recipe rather than as data because a 16k impulse
 * response would be 64 kB per fixture, and the point is to compare the
 * convolution rather than to ship a table twice.
 */
bool render_convolver(const Fixture& fixture, std::vector<float>& actual) {
  if (fixture.params.size() < 2) {
    return false;
  }
  const auto length = static_cast<uint32_t>(fixture.params[0]);
  auto seed = static_cast<uint32_t>(fixture.params[1]);
  std::vector<float> kernel(length);
  for (uint32_t at = 0; at < length; ++at) {
    seed = seed * 1664525u + 1013904223u;
    const double unit = static_cast<double>(seed >> 8) / 16777216.0;
    // A decaying noise burst: broadband, finite, and nothing like an impulse,
    // so every partition carries real content.
    kernel[at] = static_cast<float>((unit * 2.0 - 1.0) *
                                    std::exp(-3.0 * at / length));
  }

  FeqConvolverKernel* prepared =
      feq_convolver_kernel_create(kernel.data(), length);
  if (prepared == nullptr) {
    return false;
  }
  actual = fixture.input;
  for (uint32_t channel = 0; channel < fixture.channels; ++channel) {
    FeqConvolver* convolver = feq_convolver_create(prepared);
    if (convolver == nullptr) {
      feq_convolver_kernel_destroy(prepared);
      return false;
    }
    feq_convolve(convolver, channel_at(actual, channel, fixture.frames),
                 fixture.frames);
    feq_convolver_destroy(convolver);
  }
  feq_convolver_kernel_destroy(prepared);
  return true;
}

/**
 * The linear-phase kernel, compared as a signal.
 *
 * Nothing is filtered here: the fixture's expectation IS the kernel, one
 * channel of `FEQ_LINEAR_PHASE_KERNEL_SIZE` samples, and the input block is
 * ignored. It is the only fixture whose subject is a design rather than a
 * render, and it is worth having in this shape because the failure it guards
 * against is a silent one — a kernel that is a few dB shallow, or rotated by
 * the wrong half, still sounds like an equaliser.
 *
 * Layout: engine, model, model amount, subsonic Hz, band count, then one
 * six-wide block per band matching `parse_rack`'s.
 */
bool render_linear_phase(const Fixture& fixture, std::vector<float>& actual) {
  constexpr size_t kLead = 5;
  if (fixture.params.size() < kLead) {
    return false;
  }
  const auto band_count = static_cast<uint32_t>(fixture.params[4]);
  if (fixture.params.size() !=
      kLead + static_cast<size_t>(band_count) * kBandParams) {
    return false;
  }
  if (fixture.channels != 1 ||
      fixture.frames != FEQ_LINEAR_PHASE_KERNEL_SIZE) {
    return false;
  }

  std::vector<FeqLinearPhaseBand> bands(band_count);
  for (uint32_t band = 0; band < band_count; ++band) {
    const size_t base = kLead + static_cast<size_t>(band) * kBandParams;
    bands[band].enabled = 1;
    bands[band].dynamic = fixture.params[base + 4] != 0.0 ? 1 : 0;
    bands[band].type =
        static_cast<FeqFilterType>(static_cast<int>(fixture.params[base]));
    bands[band].frequency = fixture.params[base + 1];
    bands[band].gain_db = fixture.params[base + 2];
    bands[band].quality = fixture.params[base + 3];
  }

  FeqLinearPhaseRack rack;
  rack.bands = bands.data();
  rack.band_count = band_count;
  rack.engine =
      static_cast<FeqEqEngine>(static_cast<int>(fixture.params[0]));
  rack.model = static_cast<FeqEqModel>(static_cast<int>(fixture.params[1]));
  rack.model_amount = fixture.params[2];
  // Frozen from the TypeScript rack, which had only the cookbook.
  rack.matched = 0;
  rack.subsonic_hz = fixture.params[3];

  actual.assign(FEQ_LINEAR_PHASE_KERNEL_SIZE, 0.0f);
  feq_build_linear_phase_kernel(&rack, static_cast<double>(fixture.sample_rate),
                                actual.data());
  return true;
}

/**
 * Whole-track loudness, compared as two numbers rather than as a signal.
 *
 * The analyser consumes audio and produces two dB values, so there is no
 * output to line up sample for sample. They go in the first two samples of
 * channel zero and everything else stays silent, which means the comparator's
 * max-abs check is doing the work here and the RMS check is nearly free.
 *
 * Fed in one call. Feeding it in chunks would be bit-identical — all the state
 * lives in the analyser — but a single call is the shape the decoder will use.
 */
bool render_loudness(const Fixture& fixture, std::vector<float>& actual) {
  if (fixture.channels == 0 || fixture.frames < 2) {
    return false;
  }
  FeqLoudnessAnalyzer* analyzer = feq_loudness_create(
      static_cast<double>(fixture.sample_rate), fixture.channels);
  if (analyzer == nullptr) {
    return false;
  }
  std::vector<const float*> inputs(fixture.channels);
  for (uint32_t channel = 0; channel < fixture.channels; ++channel) {
    inputs[channel] = fixture.input.data() +
                      static_cast<size_t>(channel) * fixture.frames;
  }
  feq_loudness_feed(analyzer, inputs.data(), fixture.frames);
  const FeqLoudnessResult result = feq_loudness_finish(analyzer);
  feq_loudness_destroy(analyzer);

  actual.assign(fixture.input.size(), 0.0f);
  actual[0] = static_cast<float>(result.integrated_lufs);
  actual[1] = static_cast<float>(result.true_peak_dbtp);
  return true;
}

/**
 * The crossfade curve, evaluated at whatever progress the fixture carries.
 *
 * The input is not audio: each sample is a point on the fade, deliberately
 * running past both ends so the clamp is covered on both sides.
 */
bool render_crossfade(const Fixture& fixture, std::vector<float>& actual) {
  if (fixture.params.size() < 2 || fixture.channels != 1) {
    return false;
  }
  const auto curve = static_cast<FeqCrossfadeCurve>(
      static_cast<int>(fixture.params[0]));
  const int incoming = fixture.params[1] != 0.0 ? 1 : 0;

  /**
   * Custom carries its shape in the fixture, as the same 2x64 table the wire
   * sends. Reading it through `feq_crossfade_table_gain` is the point of the
   * fixture: the TypeScript side interpolates those same points, so a curve
   * that agrees here agrees in the app.
   */
  FeqCrossfadeTable table;
  const bool custom = curve == FEQ_CROSSFADE_CUSTOM;
  if (custom) {
    if (fixture.params.size() <
        2 + static_cast<size_t>(FEQ_CROSSFADE_TABLE_POINTS) * 2) {
      return false;
    }
    for (int at = 0; at < FEQ_CROSSFADE_TABLE_POINTS; ++at) {
      table.outgoing[at] = static_cast<float>(fixture.params[2 + at]);
      table.incoming[at] = static_cast<float>(
          fixture.params[2 + FEQ_CROSSFADE_TABLE_POINTS + at]);
    }
  }

  actual.resize(fixture.input.size());
  for (size_t at = 0; at < fixture.input.size(); ++at) {
    const double progress = static_cast<double>(fixture.input[at]);
    actual[at] = static_cast<float>(
        custom ? feq_crossfade_table_gain(&table, progress, incoming)
               : feq_crossfade_gain(curve, progress, incoming));
  }
  return true;
}

}  // namespace

/** Run one fixture through the native engine, or say it cannot be run yet. */
bool render(const Fixture& fixture, std::vector<float>& actual) {
  switch (fixture.processor) {
    case kChain:
      return render_chain(fixture, actual);
    case kCrossfade:
      return render_crossfade(fixture, actual);
    case kLoudness:
      return render_loudness(fixture, actual);
    case kLinearPhase:
      return render_linear_phase(fixture, actual);
    case kConvolver:
      return render_convolver(fixture, actual);
    case kExciter:
      return render_exciter(fixture, actual);
    case kOrganicPath:
      return render_organic_path(fixture, actual);
    case kOrganic:
      return render_organic(fixture, actual);
    case kExciterGuard:
      return render_exciter_guard(fixture, actual);
    case kPhaseAlign:
      return render_phase_align(fixture, actual);
    case kExciterTransient:
      return render_exciter_transient(fixture, actual);
    case kAutoHeadroom:
      return render_auto_headroom(fixture, actual);
    case kOutputSafety:
      return render_output_safety(fixture, actual);
    case kCompressor:
    case kCompressorLinked:
      return render_compressor(fixture, actual);
    case kLinkedLimiter:
      return render_linked_limiter(fixture, actual);
    case kLimiter:
      return render_limiter(fixture, actual);
    case kSaturate:
      return render_saturate(fixture, actual);
    case kDelayLine:
      return render_delay(fixture, actual);
    case kCrossover:
      return render_crossover(fixture, actual);
    case kTruePeak:
      return render_true_peak(fixture, actual);
    case kBiquad:
      return render_biquad(fixture, actual);
    case kEqBands:
      return render_eq(fixture, actual);
    case kEqLinked:
      return render_eq_linked(fixture, actual);
    case kEqOversampled:
      return render_eq_oversampled(fixture, actual, false);
    case kEqOversampledLinked:
      return render_eq_oversampled(fixture, actual, true);
    case kIdentity:
      break;
    default:
      return false;
  }

  FeqEngine* engine = feq_engine_create(fixture.sample_rate, fixture.channels,
                                        fixture.frames);
  if (engine == nullptr) {
    return false;
  }
  actual = fixture.input;
  std::vector<const float*> inputs(fixture.channels);
  std::vector<float*> outputs(fixture.channels);
  for (uint32_t channel = 0; channel < fixture.channels; ++channel) {
    inputs[channel] = channel_at(actual, channel, fixture.frames);
    outputs[channel] = channel_at(actual, channel, fixture.frames);
  }
  feq_engine_process_planar(engine, inputs.data(), outputs.data(),
                            fixture.frames);
  feq_engine_destroy(engine);
  return true;
}

}  // namespace feq_parity
