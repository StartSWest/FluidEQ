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

#include "fluideq/biquad.h"
#include "fluideq/dsp.h"
#include "fluideq/dynamics.h"
#include "fluideq/eq.h"
#include "fluideq/oversample.h"
#include "fluideq/primitives.h"
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
  kLinkedLimiter = 11
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

  feq_eq_process_bands_linked(states.data(), rack.coefficients.data(),
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
        states.data(), rack.coefficients.data(), rack.band_count,
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

/** Run one fixture through the native engine, or say it cannot be run yet. */
bool render(const Fixture& fixture, std::vector<float>& actual) {
  switch (fixture.processor) {
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

  if (failed > 0 || unreadable > 0 || !control_ok || !dynamic_covered) {
    std::printf("\nparity FAILED\n");
    return 1;
  }
  std::printf("\nparity passed (%zu still to port)\n", pending);
  return 0;
}
