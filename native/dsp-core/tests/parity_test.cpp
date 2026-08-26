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
 * nothing, which is precisely the failure the positive control below exists to
 * make impossible.
 */

#include "fluideq/biquad.h"
#include "fluideq/dsp.h"
#include "fluideq/eq.h"

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

enum ProcessorId : uint32_t {
  kIdentity = 0,
  kBiquad = 1,
  kEqBands = 2
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
  const size_t length = ::strnlen(name, kNameBytes);
  out.name.assign(name, length);

  const size_t samples =
      static_cast<size_t>(out.channels) * static_cast<size_t>(out.frames);
  const size_t expected_size =
      kHeaderBytes + param_count * 8 + samples * 4 * 2;
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
  size_t worst_at = 0;
  bool non_finite = false;
};

/**
 * Both metrics, because either alone lies.
 *
 * A single sample wrong by a lot moves the max and barely moves the RMS; a
 * whole block wrong by a little does the opposite. A port can fail either way
 * and a suite that watches one of them will eventually let the other through.
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
    const double error =
        std::fabs(static_cast<double>(actual[at]) -
                  static_cast<double>(expected[at]));
    if (error > difference.max_abs) {
      difference.max_abs = error;
      difference.worst_at = at;
    }
    sum_squared += error * error;
  }
  difference.rms =
      expected.empty() ? 0.0
                       : std::sqrt(sum_squared /
                                   static_cast<double>(expected.size()));
  return difference;
}

/**
 * The biquad, driven exactly as the fixture generator drove the reference: a
 * fresh state per channel, one pass over the whole block.
 */
bool render_biquad(const Fixture& fixture, std::vector<float>& actual) {
  if (fixture.params.size() < 4) {
    return false;
  }
  const auto type = static_cast<FeqFilterType>(
      static_cast<int>(fixture.params[0]));
  const FeqBiquadCoefficients coefficients = feq_biquad_coefficients(
      type, fixture.params[1], fixture.params[2], fixture.params[3],
      static_cast<double>(fixture.sample_rate));

  actual = fixture.input;
  for (uint32_t channel = 0; channel < fixture.channels; ++channel) {
    FeqBiquadState state;
    feq_biquad_reset(&state);
    feq_biquad_process(&state,
                       actual.data() + static_cast<size_t>(channel) *
                                           fixture.frames,
                       fixture.frames, &coefficients);
  }
  return true;
}

/**
 * A whole rack. Params are `[engine, bandCount, (type, hz, gain, q) * count]`,
 * matching the layout the generator writes.
 */
bool render_eq(const Fixture& fixture, std::vector<float>& actual) {
  if (fixture.params.size() < 2) {
    return false;
  }
  const auto engine =
      static_cast<FeqEqEngine>(static_cast<int>(fixture.params[0]));
  const auto band_count = static_cast<uint32_t>(fixture.params[1]);
  if (fixture.params.size() != 2 + static_cast<size_t>(band_count) * 4) {
    return false;
  }

  std::vector<FeqBiquadCoefficients> coefficients(band_count);
  for (uint32_t band = 0; band < band_count; ++band) {
    const size_t base = 2 + static_cast<size_t>(band) * 4;
    coefficients[band] = feq_biquad_coefficients(
        static_cast<FeqFilterType>(static_cast<int>(fixture.params[base])),
        fixture.params[base + 1], fixture.params[base + 2],
        fixture.params[base + 3], static_cast<double>(fixture.sample_rate));
  }

  actual = fixture.input;
  std::vector<float> dry(fixture.frames);
  std::vector<float> wet(fixture.frames);
  for (uint32_t channel = 0; channel < fixture.channels; ++channel) {
    // Filter history is channel-local: a fresh set per channel, exactly as the
    // reference builds them.
    std::vector<FeqBiquadState> states(band_count);
    for (auto& state : states) {
      feq_biquad_reset(&state);
    }
    feq_eq_process_bands(
        states.data(), coefficients.data(), band_count,
        actual.data() + static_cast<size_t>(channel) * fixture.frames,
        fixture.frames, engine, dry.data(), wet.data());
  }
  return true;
}

/** Run one fixture through the native engine, or say it cannot be run yet. */
bool render(const Fixture& fixture, std::vector<float>& actual) {
  if (fixture.processor == kBiquad) {
    return render_biquad(fixture, actual);
  }
  if (fixture.processor == kEqBands) {
    return render_eq(fixture, actual);
  }
  if (fixture.processor != kIdentity) {
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
    const size_t offset = static_cast<size_t>(channel) * fixture.frames;
    inputs[channel] = actual.data() + offset;
    outputs[channel] = actual.data() + offset;
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

const char* processor_name(uint32_t processor) {
  switch (processor) {
    case kIdentity:
      return "identity";
    case kBiquad:
      return "biquad";
    default:
      return "unknown";
  }
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
    // that measures nothing. It is a failure, not a clean run.
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
      const Difference difference = compare(actual, tampered);
      Fixture strict = control;
      control_ok = !within_tolerance(strict, difference);
    }
  }
  std::printf("  positive control: %s\n",
              control_ok ? "a one-ULP change is detected"
                         : "NOT DETECTED — the comparison proves nothing");

  if (failed > 0 || unreadable > 0 || !control_ok) {
    std::printf("\nparity FAILED\n");
    return 1;
  }
  std::printf("\nparity passed (%zu still to port)\n", pending);
  return 0;
}
