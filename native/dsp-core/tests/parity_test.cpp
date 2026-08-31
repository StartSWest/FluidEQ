/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Hold the native engine to what the TypeScript engine already does.
 *
 * The fixtures are written by `.erb/scripts/generate-parity-fixtures.ts` from
 * the TypeScript modules themselves, so this is not a test of agreed constants
 * — it is a test that the port produces the same numbers as the thing it is
 * replacing, on signals chosen because each one is somewhere a DSP port has
 * historically gone wrong.
 *
 * A processor the native side has not implemented yet is reported as PENDING
 * and counted, never skipped quietly. A suite that silently passes over what
 * it cannot check is a suite that reports green for an engine that does
 * nothing, which is what the positive control at the end exists to prevent.
 */

#include "fluideq/analog_diode.h"
#include "fluideq/biquad.h"
#include "fluideq/dsp.h"
#include "fluideq/dynamics.h"
#include "fluideq/eq.h"
#include "fluideq/exciter.h"
#include "fluideq/exciter_guard.h"
#include "fluideq/organic.h"
#include "fluideq/organic_stage.h"
#include "fluideq/oversample.h"
#include "fluideq/phase_align.h"
#include "fluideq/primitives.h"
#include "fluideq/compressor.h"
#include "fluideq/convolver.h"
#include "fluideq/linear_phase.h"
#include "fluideq/chain.h"
#include "fluideq/crossfade.h"
#include "fluideq/loudness.h"
#include "fluideq/output_safety.h"
#include "fluideq/post_filter_normalizer.h"
#include "fluideq/limiter.h"
#include "fluideq/saturate.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <filesystem>
#include <fstream>
#include <string>
#include <vector>

namespace {

constexpr uint32_t kMagic = 0x46514546; /* FEQF */
constexpr uint32_t kVersion = 1;
constexpr size_t kHeaderBytes = 112;
constexpr size_t kNameBytes = 64;
/** Fields per band in a rack's parameter block. */
constexpr size_t kBandParams = 6;

enum ProcessorId : uint32_t {
  kIdentity = 0,
  kBiquad = 1,
  kEqBands = 2,
  kEqLinked = 3,
  kEqOversampled = 4,
  kEqOversampledLinked = 5,
  kDelayLine = 6,
  kCrossover = 7,
  kTruePeak = 8,
  kSaturate = 9,
  kLimiter = 10,
  kLinkedLimiter = 11,
  kCompressor = 12,
  kCompressorLinked = 13,
  kOutputSafety = 14,
  kAutoHeadroom = 15,
  kExciterTransient = 16,
  /* 17 was kAnalogDiode, whose shaper nothing calls any more. */
  kPhaseAlign = 18,
  kExciterGuard = 19,
  kOrganic = 20,
  kOrganicPath = 21,
  kExciter = 22,
  kConvolver = 23,
  kLinearPhase = 24,
  kLoudness = 25,
  kCrossfade = 26,
  kChain = 27
};

struct Fixture {
  std::string name;
  uint32_t processor = 0;
  uint32_t sample_rate = 0;
  uint32_t channels = 0;
  uint32_t frames = 0;
  double max_abs_tolerance = 0.0;
  double rms_tolerance = 0.0;
  std::vector<double> params;
  /** Planar: channel 0's frames, then channel 1's. */
  std::vector<float> input;
  std::vector<float> expected;
};

template <typename T>
T read_at(const std::vector<char>& bytes, size_t offset) {
  T value{};
  std::memcpy(&value, bytes.data() + offset, sizeof(T));
  return value;
}

bool load(const std::filesystem::path& file, Fixture& out) {
  std::ifstream stream(file, std::ios::binary);
  if (!stream) {
    return false;
  }
  std::vector<char> bytes((std::istreambuf_iterator<char>(stream)),
                          std::istreambuf_iterator<char>());
  if (bytes.size() < kHeaderBytes) {
    return false;
  }
  if (read_at<uint32_t>(bytes, 0) != kMagic ||
      read_at<uint32_t>(bytes, 4) != kVersion) {
    return false;
  }
  out.processor = read_at<uint32_t>(bytes, 8);
  out.sample_rate = read_at<uint32_t>(bytes, 12);
  out.channels = read_at<uint32_t>(bytes, 16);
  out.frames = read_at<uint32_t>(bytes, 20);
  const uint32_t param_count = read_at<uint32_t>(bytes, 24);
  out.max_abs_tolerance = read_at<double>(bytes, 32);
  out.rms_tolerance = read_at<double>(bytes, 40);

  const char* name = bytes.data() + 48;
  out.name.assign(name, ::strnlen(name, kNameBytes));

  const size_t samples =
      static_cast<size_t>(out.channels) * static_cast<size_t>(out.frames);
  const size_t expected_size = kHeaderBytes + param_count * 8 + samples * 4 * 2;
  if (bytes.size() != expected_size || out.channels == 0 || out.frames == 0) {
    return false;
  }

  size_t at = kHeaderBytes;
  out.params.resize(param_count);
  for (uint32_t index = 0; index < param_count; ++index) {
    out.params[index] = read_at<double>(bytes, at);
    at += 8;
  }
  out.input.resize(samples);
  std::memcpy(out.input.data(), bytes.data() + at, samples * 4);
  at += samples * 4;
  out.expected.resize(samples);
  std::memcpy(out.expected.data(), bytes.data() + at, samples * 4);
  return true;
}

struct Difference {
  double max_abs = 0.0;
  double rms = 0.0;
  bool non_finite = false;
};

/**
 * Both metrics, because either alone lies.
 *
 * A single sample wrong by a lot moves the max and barely moves the RMS; a
 * whole block wrong by a little does the opposite. A port can fail either way
 * and a suite watching one of them will eventually let the other through.
 */
Difference compare(const std::vector<float>& actual,
                   const std::vector<float>& expected) {
  Difference difference;
  double sum_squared = 0.0;
  for (size_t at = 0; at < expected.size(); ++at) {
    if (!std::isfinite(actual[at])) {
      difference.non_finite = true;
      continue;
    }
    const double error = std::fabs(static_cast<double>(actual[at]) -
                                   static_cast<double>(expected[at]));
    difference.max_abs = std::max(difference.max_abs, error);
    sum_squared += error * error;
  }
  difference.rms =
      expected.empty()
          ? 0.0
          : std::sqrt(sum_squared / static_cast<double>(expected.size()));
  return difference;
}

/**
 * Coverage, not correctness — and the two are different failures.
 *
 * A dynamic band whose threshold the corpus never crosses produces exactly the
 * same output as a static one, matches the reference perfectly, and tests only
 * the branch that returns zero. These count how often a detector actually
 * opened, so a rack that quietly stopped engaging shows up as a coverage
 * collapse rather than as a still-green suite.
 */
size_t g_dynamic_fixtures = 0;
size_t g_dynamic_engaged = 0;

/** Set by `render_chain` when its field list has fallen behind the wire's. */
bool g_chain_layout_stale = false;

/**
 * One rack, parsed from `[engine, bandCount, (band) * count]` at `offset`.
 *
 * `coefficient_rate` is the rate the FILTERS run at, which is the block rate
 * multiplied by the oversampling factor. Handing an oversampled pass the
 * ordinary set would place every band an octave low — a bug rather than a
 * mode, and one that produces perfectly plausible audio.
 */
struct Rack {
  FeqEqEngine engine = FEQ_EQ_SERIAL;
  uint32_t band_count = 0;
  bool has_dynamic = false;
  std::vector<FeqBiquadCoefficients> coefficients;
  std::vector<double> gain_db;
  std::vector<int> dynamic;
  std::vector<double> threshold_db;
};

bool parse_rack(const Fixture& fixture,
                size_t offset,
                double coefficient_rate,
                Rack& out) {
  if (fixture.params.size() < offset + 2) {
    return false;
  }
  out.engine =
      static_cast<FeqEqEngine>(static_cast<int>(fixture.params[offset]));
  out.band_count = static_cast<uint32_t>(fixture.params[offset + 1]);
  // Asserted rather than assumed: a layout the generator and the runner
  // disagree about would read a threshold as a Q and still sound plausible.
  if (fixture.params.size() !=
      offset + 2 + static_cast<size_t>(out.band_count) * kBandParams) {
    return false;
  }

  out.coefficients.resize(out.band_count);
  out.gain_db.resize(out.band_count);
  out.dynamic.resize(out.band_count);
  out.threshold_db.resize(out.band_count);
  for (uint32_t band = 0; band < out.band_count; ++band) {
    const size_t base = offset + 2 + static_cast<size_t>(band) * kBandParams;
    out.coefficients[band] = feq_biquad_coefficients(
        static_cast<FeqFilterType>(static_cast<int>(fixture.params[base])),
        fixture.params[base + 1], fixture.params[base + 2],
        fixture.params[base + 3], coefficient_rate);
    out.gain_db[band] = fixture.params[base + 2];
    out.dynamic[band] = fixture.params[base + 4] != 0.0 ? 1 : 0;
    out.threshold_db[band] = fixture.params[base + 5];
    out.has_dynamic = out.has_dynamic || out.dynamic[band] != 0;
  }
  return true;
}

std::vector<FeqBandDynamics> build_dynamics(const Rack& rack, double rate) {
  std::vector<FeqBandDynamics> dynamics(rack.band_count);
  for (uint32_t band = 0; band < rack.band_count; ++band) {
    feq_band_dynamics_init(&dynamics[band]);
    feq_band_dynamics_refresh(&dynamics[band], 1, 1, rack.dynamic[band],
                              rack.gain_db[band], rack.threshold_db[band],
                              rate);
  }
  return dynamics;
}

std::vector<FeqBiquadState> fresh_states(uint32_t count) {
  std::vector<FeqBiquadState> states(count);
  for (auto& state : states) {
    feq_biquad_reset(&state);
  }
  return states;
}

bool engaged_in(const std::vector<FeqBandDynamics>& dynamics) {
  for (const auto& dynamic : dynamics) {
    if (dynamic.active != 0 && dynamic.amount > 0.0) {
      return true;
    }
  }
  return false;
}

void note_coverage(bool has_dynamic, bool engaged) {
  if (!has_dynamic) {
    return;
  }
  ++g_dynamic_fixtures;
  if (engaged) {
    ++g_dynamic_engaged;
  }
}

float* channel_at(std::vector<float>& block, uint32_t channel,
                  uint32_t frames) {
  return block.data() + static_cast<size_t>(channel) * frames;
}

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
  FeqLimiterOptions options;
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

  FeqLimiterOptions options;
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

/** `[thresholdDb, ratio, attackMs, releaseMs, makeupDb]`. */
bool render_compressor(const Fixture& fixture, std::vector<float>& actual,
                       bool linked) {
  if (fixture.params.size() < 5) {
    return false;
  }
  FeqCompressorBand band;
  band.threshold_db = fixture.params[0];
  band.ratio = fixture.params[1];
  band.attack_ms = fixture.params[2];
  band.release_ms = fixture.params[3];
  band.makeup_db = fixture.params[4];

  actual = fixture.input;
  const double rate = static_cast<double>(fixture.sample_rate);
  if (linked) {
    std::vector<float*> targets(fixture.channels);
    for (uint32_t channel = 0; channel < fixture.channels; ++channel) {
      targets[channel] = channel_at(actual, channel, fixture.frames);
    }
    FeqCompressor state;
    feq_compressor_reset(&state);
    feq_compressor_process_linked(&state, targets.data(), fixture.channels,
                                  fixture.frames, &band, rate);
    return true;
  }
  for (uint32_t channel = 0; channel < fixture.channels; ++channel) {
    FeqCompressor state;
    feq_compressor_reset(&state);
    feq_compressor_process(&state, channel_at(actual, channel, fixture.frames),
                           fixture.frames, &band, rate);
  }
  return true;
}

/** `[limiterEnabled, ceiling, activation, releaseCoefficient, kneeDb, hold]`. */
bool render_output_safety(const Fixture& fixture, std::vector<float>& actual) {
  if (fixture.params.size() < 6) {
    return false;
  }
  FeqOutputSafetyOptions options{};
  options.limiter_enabled = fixture.params[0] != 0.0 ? 1 : 0;
  options.ceiling = fixture.params[1];
  options.activation_threshold = fixture.params[2];
  options.release_coefficient = fixture.params[3];
  options.knee_db = fixture.params[4];
  options.release_hold_samples = fixture.params[5];

  const double rate = static_cast<double>(fixture.sample_rate);
  const uint32_t look_ahead = feq_output_safety_look_ahead(rate);
  const uint32_t capacity = look_ahead + 1;
  const uint32_t channels = fixture.channels;

  actual = fixture.input;
  std::vector<FeqDcBlock> dc(channels);
  std::vector<FeqTruePeak> detectors(channels);
  std::vector<std::vector<float>> lines(channels, std::vector<float>(capacity));
  std::vector<float*> line_pointers(channels);
  std::vector<float*> targets(channels);
  for (uint32_t channel = 0; channel < channels; ++channel) {
    line_pointers[channel] = lines[channel].data();
    targets[channel] = channel_at(actual, channel, fixture.frames);
  }
  std::vector<float> reduction(capacity);

  FeqOutputSafety state;
  feq_output_safety_init(&state, dc.data(), detectors.data(),
                         line_pointers.data(), reduction.data(), channels,
                         capacity, rate);
  feq_output_safety_process(&state, targets.data(), fixture.frames, &options);
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
  const uint32_t low_capacity = feq_phase_align_low_capacity(rate);
  const uint32_t mid_capacity = feq_phase_align_mid_capacity(rate);

  actual = fixture.input;
  for (uint32_t channel = 0; channel < fixture.channels; ++channel) {
    std::vector<float> low(fixture.frames);
    std::vector<float> mid(fixture.frames);
    std::vector<float> high(fixture.frames);
    std::vector<float> low_line(low_capacity);
    std::vector<float> mid_line(mid_capacity);
    FeqPhaseAlign state;
    feq_phase_align_init(&state, low.data(), mid.data(), high.data(),
                         low_line.data(), low_capacity, mid_line.data(),
                         mid_capacity);
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

/**
 * The whole chain, decoded from the flat block `chainParams` writes.
 *
 * Field for field and in the same order. The variable-length part — the EQ's
 * bands — is last, so everything before it sits at a fixed offset and adding a
 * scalar cannot silently re-point sixty-four bands.
 */
constexpr size_t kChainParamLead = FEQ_CHAIN_PARAM_LEAD;
constexpr size_t kChainBandParams = 7;

bool render_chain(const Fixture& fixture, std::vector<float>& actual) {
  if (fixture.params.size() < kChainParamLead || fixture.channels == 0) {
    return false;
  }
  const auto band_count =
      static_cast<uint32_t>(fixture.params[kChainParamLead - 1]);
  if (fixture.params.size() !=
      kChainParamLead + static_cast<size_t>(band_count) * kChainBandParams) {
    return false;
  }

  FeqChainSettings settings;
  feq_chain_settings_defaults(&settings);
  size_t at = 0;
  const auto next = [&fixture, &at]() { return fixture.params[at++]; };
  const auto flag = [&next]() { return next() != 0.0 ? 1 : 0; };

  settings.enabled = flag();
  settings.output_safety_enabled = flag();
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
  for (auto& band : settings.exciter.bands) {
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

  settings.compressor.enabled = flag();
  settings.compressor.crossover_hz[0] = next();
  settings.compressor.crossover_hz[1] = next();
  for (auto& band : settings.compressor.bands) {
    band.threshold_db = next();
    band.ratio = next();
    band.attack_ms = next();
    band.release_ms = next();
    band.makeup_db = next();
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

  // Denoise, in the order `encodeChainSettings` writes it.
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
  settings.denoise.voice.amount = next();

  settings.bass_forge.enabled = flag();
  settings.bass_forge.split_hz = next();
  settings.bass_forge.drive_db = next();
  settings.bass_forge.sub_amount = next();
  settings.bass_forge.presence_amount = next();
  settings.bass_forge.texture = next();
  settings.bass_forge.mix = next();

  settings.bass_punch.enabled = flag();
  settings.bass_punch.split_hz = next();
  settings.bass_punch.attack = next();
  settings.bass_punch.sustain = next();
  settings.bass_punch.bloom_amount = next();
  settings.bass_punch.bloom_decay_ms = next();
  settings.bass_punch.duck = next();

  settings.eq.band_count = static_cast<uint32_t>(next());
  if (at != kChainParamLead) {
    /**
     * Asserted rather than assumed: a layout the generator and the runner
     * disagree about would read a Q as a threshold and still sound plausible.
     *
     * It is printed, and `g_chain_layout_stale` makes the run FAIL, because the
     * silent version of this was worse than the bug it guarded against. Falling
     * out of `render` counts a fixture as "pending — no native implementation
     * yet", and the whole chain has had one since the first day it was ported;
     * so when Denoise added eighteen scalars to the lead and the bass stages
     * added seven each, this reader stopped at 78 of 110, every one of the
     * twenty-seven whole-chain fixtures quietly became pending, and the suite
     * kept reporting "parity passed". Those are the only fixtures that test the
     * orchestration — stage order, the mid/side wrapper, the meter taps — and
     * for three stages nothing had run them.
     */
    g_chain_layout_stale = true;
    std::printf(
        "  CHAIN LAYOUT STALE: this runner reads %zu of the %zu lead fields "
        "`encodeChainSettings` writes\n",
        at, kChainParamLead);
    return false;
  }
  for (uint32_t band = 0; band < settings.eq.band_count &&
                          band < FEQ_CHAIN_MAX_EQ_BANDS;
       ++band) {
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

  actual = fixture.input;
  std::vector<float*> pointers(fixture.channels);
  for (uint32_t offset = 0; offset < fixture.frames; offset += 128) {
    const uint32_t span = std::min(128u, fixture.frames - offset);
    for (uint32_t channel = 0; channel < fixture.channels; ++channel) {
      pointers[channel] =
          channel_at(actual, channel, fixture.frames) + offset;
    }
    feq_chain_process(chain, pointers.data(), span);
  }
  feq_chain_destroy(chain);
  return true;
}

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
      return render_compressor(fixture, actual, false);
    case kCompressorLinked:
      return render_compressor(fixture, actual, true);
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

bool within_tolerance(const Fixture& fixture, const Difference& difference) {
  return !difference.non_finite &&
         difference.max_abs <= fixture.max_abs_tolerance &&
         difference.rms <= fixture.rms_tolerance;
}

}  // namespace

int main(int argc, char** argv) {
  if (argc < 2) {
    std::printf("parity: no fixture directory given\n");
    return 2;
  }
  const std::filesystem::path directory(argv[1]);
  if (!std::filesystem::is_directory(directory)) {
    std::printf("parity: %s is not a directory\n", argv[1]);
    return 2;
  }

  std::vector<std::filesystem::path> files;
  for (const auto& entry : std::filesystem::directory_iterator(directory)) {
    if (entry.is_regular_file() && entry.path().extension() == ".feqfix") {
      files.push_back(entry.path());
    }
  }
  std::sort(files.begin(), files.end());

  if (files.empty()) {
    // An empty corpus passing every check is the exact shape of a null test
    // that measures nothing. A failure, not a clean run.
    std::printf("parity: no fixtures found in %s\n", argv[1]);
    return 1;
  }

  size_t verified = 0;
  size_t failed = 0;
  size_t pending = 0;
  size_t unreadable = 0;
  Fixture control;
  bool have_control = false;

  for (const auto& file : files) {
    Fixture fixture;
    if (!load(file, fixture)) {
      std::printf("  UNREADABLE %s\n", file.filename().string().c_str());
      ++unreadable;
      continue;
    }
    std::vector<float> actual;
    if (!render(fixture, actual)) {
      ++pending;
      continue;
    }
    const Difference difference = compare(actual, fixture.expected);
    if (within_tolerance(fixture, difference)) {
      ++verified;
      if (!have_control) {
        control = fixture;
        have_control = true;
      }
      continue;
    }
    ++failed;
    std::printf(
        "  FAIL %s  max|e|=%.3e (limit %.3e) rms=%.3e (limit %.3e)%s\n",
        fixture.name.c_str(), difference.max_abs, fixture.max_abs_tolerance,
        difference.rms, fixture.rms_tolerance,
        difference.non_finite ? " NON-FINITE OUTPUT" : "");
  }

  std::printf("parity: %zu fixtures\n", files.size());
  std::printf("  verified  %zu\n", verified);
  std::printf("  failed    %zu\n", failed);
  std::printf("  pending   %zu (no native implementation yet)\n", pending);
  if (unreadable > 0) {
    std::printf("  unreadable %zu\n", unreadable);
  }
  if (g_dynamic_fixtures > 0) {
    std::printf("  dynamic detectors engaged in %zu of %zu fixtures\n",
                g_dynamic_engaged, g_dynamic_fixtures);
  }

  /**
   * The positive control, and the reason any of the above means anything.
   *
   * A comparator that returns zero for every input passes a corpus of any size
   * perfectly. So one fixture that has just been verified is deliberately
   * broken by a single float ULP and re-compared, and the run fails if that
   * goes unnoticed. "Found no difference" and "compared nothing" have to be
   * distinguishable, and this is the only thing that distinguishes them.
   */
  bool control_ok = false;
  if (have_control && !control.expected.empty()) {
    std::vector<float> actual;
    if (render(control, actual)) {
      std::vector<float> tampered = control.expected;
      const size_t at = tampered.size() / 2;
      tampered[at] = std::nextafter(tampered[at], 2.0f);
      control_ok = !within_tolerance(control, compare(actual, tampered));
    }
  }
  std::printf("  positive control: %s\n",
              control_ok ? "a one-ULP change is detected"
                         : "NOT DETECTED — the comparison proves nothing");

  // A corpus full of dynamic bands that never open is a corpus testing the
  // static path twice under a different name.
  const bool dynamic_covered = g_dynamic_fixtures == 0 || g_dynamic_engaged > 0;
  if (!dynamic_covered) {
    std::printf(
        "  dynamic coverage: NOT ENGAGED — the detector never crossed its "
        "threshold, so these fixtures prove only the static path\n");
  }

  if (g_chain_layout_stale) {
    std::printf(
        "  chain coverage: NONE — the runner's field list is behind "
        "`encodeChainSettings`, so every whole-chain fixture was skipped\n");
  }

  if (failed > 0 || unreadable > 0 || !control_ok || !dynamic_covered ||
      g_chain_layout_stale) {
    std::printf("\nparity FAILED\n");
    return 1;
  }
  std::printf("\nparity passed (%zu still to port)\n", pending);
  return 0;
}
