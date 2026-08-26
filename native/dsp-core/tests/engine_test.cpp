/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * No test framework, on purpose.
 *
 * The cold build is the point of this project's CI, and every dependency it
 * fetches is another way for a clean checkout to stop building a year from
 * now. What these tests need is an assert and an exit code.
 */

#include "fluideq/dsp.h"
#include "fluideq/parameters.h"

#include <cmath>
#include <cstdio>
#include <cstring>
#include <limits>
#include <random>
#include <vector>

namespace {

int g_failures = 0;

void check(bool condition, const char* what) {
  if (!condition) {
    std::printf("  FAIL %s\n", what);
    ++g_failures;
  } else {
    std::printf("  ok   %s\n", what);
  }
}

/** Deterministic, because a test that fails once a fortnight teaches nothing. */
std::vector<float> noise(size_t count, uint32_t seed) {
  std::mt19937 engine(seed);
  std::uniform_real_distribution<float> spread(-1.0f, 1.0f);
  std::vector<float> samples(count);
  for (size_t at = 0; at < count; ++at) {
    samples[at] = spread(engine);
  }
  return samples;
}

/**
 * Does the engine reproduce its input exactly?
 *
 * Returned rather than asserted so the positive control below can call the
 * same comparison and demand the opposite answer.
 */
bool reproduces_input(const std::vector<float>& left,
                      const std::vector<float>& right,
                      const std::vector<float>& out_left,
                      const std::vector<float>& out_right) {
  for (size_t at = 0; at < left.size(); ++at) {
    if (out_left[at] != left[at] || out_right[at] != right[at]) {
      return false;
    }
  }
  return true;
}

void test_identity() {
  std::printf("identity\n");
  FeqEngine* engine = feq_engine_create(48000, 2, 512);
  check(engine != nullptr, "engine is created");
  if (engine == nullptr) {
    return;
  }

  const size_t frames = 512;
  std::vector<float> left = noise(frames, 1);
  std::vector<float> right = noise(frames, 2);
  std::vector<float> out_left(frames, 0.0f);
  std::vector<float> out_right(frames, 0.0f);

  const float* in[2] = {left.data(), right.data()};
  float* out[2] = {out_left.data(), out_right.data()};
  feq_engine_process_planar(engine, in, out, static_cast<uint32_t>(frames));

  check(reproduces_input(left, right, out_left, out_right),
        "every sample survives bit-exact");

  /**
   * The positive control.
   *
   * Without it, "found no difference" and "compared nothing" are the same
   * result — which is exactly how a separation bug once passed a perfect null
   * test by returning zero for every input. One sample is moved by the
   * smallest amount a float can hold, and the comparison must notice.
   */
  out_left[frames / 2] = std::nextafter(out_left[frames / 2], 2.0f);
  check(!reproduces_input(left, right, out_left, out_right),
        "positive control: a one-ULP change is detected");

  feq_engine_destroy(engine);
}

void test_in_place() {
  std::printf("in-place\n");
  FeqEngine* engine = feq_engine_create(48000, 2, 128);
  if (engine == nullptr) {
    check(false, "engine is created");
    return;
  }
  const size_t frames = 128;
  std::vector<float> left = noise(frames, 3);
  std::vector<float> right = noise(frames, 4);
  const std::vector<float> expected_left = left;
  const std::vector<float> expected_right = right;

  const float* in[2] = {left.data(), right.data()};
  float* out[2] = {left.data(), right.data()};
  feq_engine_process_planar(engine, in, out, static_cast<uint32_t>(frames));

  check(reproduces_input(expected_left, expected_right, left, right),
        "input and output may be the same buffers");
  feq_engine_destroy(engine);
}

void test_invalid_samples_are_repaired() {
  std::printf("invalid samples\n");
  FeqEngine* engine = feq_engine_create(48000, 2, 64);
  if (engine == nullptr) {
    check(false, "engine is created");
    return;
  }
  const size_t frames = 64;
  std::vector<float> left(frames, 0.25f);
  std::vector<float> right(frames, 0.25f);
  left[10] = std::numeric_limits<float>::quiet_NaN();
  left[20] = std::numeric_limits<float>::infinity();
  right[30] = -std::numeric_limits<float>::infinity();

  std::vector<float> out_left(frames, 9.0f);
  std::vector<float> out_right(frames, 9.0f);
  const float* in[2] = {left.data(), right.data()};
  float* out[2] = {out_left.data(), out_right.data()};
  feq_engine_process_planar(engine, in, out, static_cast<uint32_t>(frames));

  bool finite = true;
  for (size_t at = 0; at < frames; ++at) {
    finite = finite && std::isfinite(out_left[at]) && std::isfinite(out_right[at]);
  }
  check(finite, "no non-finite sample reaches the output");
  check(out_left[10] == 0.0f && out_left[20] == 0.0f && out_right[30] == 0.0f,
        "a bad sample becomes silence rather than a clamp");
  check(out_left[11] == 0.25f, "its neighbours are untouched");
  feq_engine_destroy(engine);
}

void test_parameters() {
  std::printf("parameters\n");
  FeqEngine* engine = feq_engine_create(48000, 2, 128);
  if (engine == nullptr) {
    check(false, "engine is created");
    return;
  }
  check(feq_engine_set_parameter(engine, FEQ_PARAM_MASTER_OUTPUT_TRIM_DB, -1,
                                 -3.0, 7) == FEQ_OK,
        "a known id is accepted");
  check(feq_engine_set_parameter(engine, FEQ_PARAM_EQ_BANDS_GAIN_DB, 4, 2.5,
                                 8) == FEQ_OK,
        "a banded id is accepted with its index");
  check(feq_engine_set_parameter(engine, 999999u, -1, 1.0, 9) ==
            FEQ_ERR_UNKNOWN_PARAMETER,
        "an unknown id is refused, not coerced to slot 0");
  check(feq_engine_set_parameter(engine, FEQ_PARAM_EQ_BANDS_GAIN_DB, 4096, 1.0,
                                 10) == FEQ_ERR_INVALID_ARGUMENT,
        "an index past the rack is refused");
  check(feq_engine_set_parameter(engine, FEQ_PARAM_MASTER_OUTPUT_TRIM_DB, -1,
                                 std::numeric_limits<double>::quiet_NaN(),
                                 11) == FEQ_ERR_INVALID_ARGUMENT,
        "a non-finite value never reaches the audio thread");
  feq_engine_destroy(engine);
}

void test_snapshot_commit() {
  std::printf("snapshots\n");
  FeqEngine* engine = feq_engine_create(48000, 2, 128);
  if (engine == nullptr) {
    check(false, "engine is created");
    return;
  }
  std::vector<double> values(FEQ_PARAMETER_COUNT, 0.0);
  FeqConfigV1 config{};
  config.abi_version = FEQ_ABI_VERSION;
  config.settings_revision = 42;
  config.parameter_count = FEQ_PARAMETER_COUNT;
  config.parameter_values = values.data();

  check(feq_engine_commit_prepared_config(engine) == FEQ_ERR_NOT_PREPARED,
        "committing nothing is refused");
  check(feq_engine_prepare_config(engine, &config) == FEQ_OK,
        "a full snapshot is prepared");
  check(feq_engine_commit_prepared_config(engine) == FEQ_OK,
        "the prepared snapshot commits");

  config.parameter_count = FEQ_PARAMETER_COUNT - 1;
  check(feq_engine_prepare_config(engine, &config) == FEQ_ERR_INVALID_ARGUMENT,
        "a short snapshot is refused rather than partly applied");

  config.parameter_count = FEQ_PARAMETER_COUNT;
  config.abi_version = FEQ_ABI_VERSION + 1;
  check(feq_engine_prepare_config(engine, &config) == FEQ_ERR_UNSUPPORTED,
        "a snapshot from another ABI is refused");

  const size_t frames = 128;
  std::vector<float> silence(frames, 0.0f);
  std::vector<float> out(frames, 0.0f);
  const float* in[2] = {silence.data(), silence.data()};
  float* outputs[2] = {out.data(), out.data()};
  feq_engine_process_planar(engine, in, outputs,
                            static_cast<uint32_t>(frames));

  FeqTelemetryV1 telemetry{};
  bool drained = false;
  for (int attempt = 0; attempt < 2000 && !drained; ++attempt) {
    feq_engine_process_planar(engine, in, outputs,
                              static_cast<uint32_t>(frames));
    drained = feq_engine_try_read_telemetry(engine, &telemetry);
  }
  check(drained, "telemetry reaches the consumer");
  check(telemetry.applied_revision == 42,
        "telemetry reports the committed revision");
  check(telemetry.frames_processed > 0, "telemetry counts frames");
  feq_engine_destroy(engine);
}

void test_rejects_impossible_engines() {
  std::printf("guards\n");
  check(feq_engine_create(0, 2, 128) == nullptr, "a zero sample rate is refused");
  check(feq_engine_create(48000, 0, 128) == nullptr, "zero channels is refused");
  check(feq_engine_create(48000, 9, 128) == nullptr,
        "more channels than the core handles is refused");
  check(feq_engine_create(48000, 2, 0) == nullptr, "a zero block is refused");
  check(feq_core_abi_version() == FEQ_ABI_VERSION,
        "the built core reports the ABI this test compiled against");
}

}  // namespace

int main() {
  std::printf("fluideq dsp-core, version %s, ABI %u\n", feq_core_version(),
              feq_core_abi_version());
  test_identity();
  test_in_place();
  test_invalid_samples_are_repaired();
  test_parameters();
  test_snapshot_commit();
  test_rejects_impossible_engines();
  if (g_failures == 0) {
    std::printf("\nall checks passed\n");
    return 0;
  }
  std::printf("\n%d check(s) failed\n", g_failures);
  return 1;
}
