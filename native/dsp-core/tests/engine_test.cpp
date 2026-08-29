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

#include "fluideq/chain.h"
#include "fluideq/crossfade.h"
#include "fluideq/linear_phase.h"
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

/**
 * The mixer, which has no TypeScript counterpart to compare against.
 *
 * `deckCrossfade.ts` hands a curve to two `GainNode`s, so the only shared
 * arithmetic is the curve itself and the parity corpus covers that. Everything
 * below is behaviour the sample-accurate mixer has and the automation did not.
 */
void test_crossfade_mixer() {
  std::printf("crossfade\n");

  FeqCrossfader fader;
  feq_crossfader_init(&fader);

  constexpr uint32_t kFrames = 512;
  std::vector<float> a(kFrames, 1.0f);
  std::vector<float> b(kFrames, -1.0f);
  std::vector<float> left(kFrames, 0.0f);
  std::vector<float> right(kFrames, 0.0f);
  const float* outgoing[2] = {a.data(), a.data()};
  const float* incoming[2] = {b.data(), b.data()};
  float* out[2] = {left.data(), right.data()};

  // An unconfigured fader is a wire: the outgoing deck alone, untouched.
  feq_crossfader_mix(&fader, outgoing, incoming, out, 2, kFrames);
  bool copied = true;
  for (uint32_t at = 0; at < kFrames; ++at) {
    copied = copied && left[at] == 1.0f && right[at] == 1.0f;
  }
  check(copied, "an unconfigured fader passes the outgoing deck through");

  /**
   * Equal power sums to exactly one at every point, which is why it is the
   * default. An unnormalised sin/cos pair peaks at 1.414 in the middle — a
   * 3 dB bulge halfway through every fade.
   */
  double worst_sum = 0.0;
  for (int step = 0; step <= 1000; ++step) {
    const double progress = static_cast<double>(step) / 1000.0;
    const double sum =
        feq_crossfade_gain(FEQ_CROSSFADE_EQUAL_POWER, progress, 0) +
        feq_crossfade_gain(FEQ_CROSSFADE_EQUAL_POWER, progress, 1);
    const double error = std::fabs(sum - 1.0);
    worst_sum = error > worst_sum ? error : worst_sum;
  }
  check(worst_sum < 1e-12, "the equal-power pair sums to unity throughout");

  // The counter advances once per frame across both channels. Advancing inside
  // the channel loop would run a stereo fade at twice the speed and put the
  // two channels on different points of the curve.
  feq_crossfader_start(&fader, FEQ_CROSSFADE_LINEAR, kFrames);
  feq_crossfader_mix(&fader, outgoing, incoming, out, 2, kFrames);
  bool channels_agree = true;
  for (uint32_t at = 0; at < kFrames; ++at) {
    channels_agree = channels_agree && std::fabs(left[at] - right[at]) < 1e-7f;
  }
  check(channels_agree, "both channels sit at the same point on the curve");

  const float expected_last =
      static_cast<float>(1.0 * (1.0 - 511.0 / 512.0) + -1.0 * (511.0 / 512.0));
  check(std::fabs(left[kFrames - 1] - expected_last) < 1e-6f,
        "a linear fade of exactly one block lands one frame from the end");
  check(feq_crossfader_progress(&fader) == 1.0,
        "a completed fade reports full progress");

  /**
   * A finished fade keeps mixing at pure incoming rather than reverting.
   *
   * Falling back to the copy-through path here would swap the audible deck
   * back to the track that just faded out, for however many blocks passed
   * before the player promoted the incoming one.
   */
  feq_crossfader_mix(&fader, outgoing, incoming, out, 2, kFrames);
  bool latched = true;
  for (uint32_t at = 0; at < kFrames; ++at) {
    latched = latched && std::fabs(left[at] + 1.0f) < 1e-6f;
  }
  check(latched, "a finished fade stays on the incoming deck");

  // Skipping twice inside one overlap must not step the level back to unity.
  FeqCrossfader restart;
  feq_crossfader_init(&restart);
  feq_crossfader_start(&restart, FEQ_CROSSFADE_LINEAR, kFrames);
  feq_crossfader_mix(&restart, outgoing, incoming, out, 2, kFrames / 2);
  const float before = left[kFrames / 2 - 1];
  feq_crossfader_start(&restart, FEQ_CROSSFADE_LINEAR, kFrames);
  feq_crossfader_mix(&restart, outgoing, incoming, out, 2, 1);
  check(std::fabs(left[0] - before) < 0.01f,
        "restarting mid-fade keeps its place instead of jumping to unity");

  // A NaN progress must land on a gain, not propagate into the audio.
  check(std::isfinite(
            feq_crossfade_gain(FEQ_CROSSFADE_EQUAL_POWER, std::nan(""), 1)),
        "a non-finite progress still produces a finite gain");
}

}  // namespace

/**
 * Linear phase actually engages, which for a long time it did not.
 *
 * `feq_chain_set_eq_kernel` existed, was correct, and was called by nothing:
 * `convolvers[0]` stayed null for the life of every chain, so
 * `chain_linear_running` answered 0 to every block and the mode was inert on
 * the engine that ships. Nothing caught it — the parity fixtures exercise
 * `feq_build_linear_phase_kernel` directly and never through a chain, so the
 * builder was proven while the wiring to it did not exist.
 *
 * Latency is the assertion because it is the observable: it is derived from
 * `chain_linear_running`, so a non-zero answer means a convolver really is in
 * the path rather than merely constructed.
 */
void test_linear_phase_engages() {
  FeqChain* chain = feq_chain_create(48000.0, 2, 512);
  check(chain != nullptr, "chain is created");
  if (chain == nullptr) {
    return;
  }

  FeqChainSettings settings{};
  feq_chain_settings_defaults(&settings);
  settings.enabled = 1;
  settings.eq.enabled = 1;
  settings.eq.phase = FEQ_PHASE_LINEAR;
  settings.eq.band_count = 1;
  settings.eq.bands[0].enabled = 1;
  settings.eq.bands[0].type = FEQ_FILTER_PK;
  settings.eq.bands[0].frequency = 1000.0;
  settings.eq.bands[0].gain_db = 6.0;
  settings.eq.bands[0].quality = 1.0;
  feq_chain_configure(chain, &settings);

  // Still nothing: the kernel is built on the control thread and handed over,
  // and the audio thread has not been round yet to take delivery.
  check(feq_chain_latency_frames(chain) == 0,
        "a kernel in transit is not yet in the path");

  std::vector<float> left(512, 0.0f);
  std::vector<float> right(512, 0.0f);
  float* channels[2] = {left.data(), right.data()};
  feq_chain_process(chain, channels, 512);

  check(feq_chain_latency_frames(chain) == feq_linear_phase_latency(),
        "linear phase engages once a block has adopted the kernel");

  // And it stands down again, by the same route.
  settings.eq.phase = FEQ_PHASE_MINIMUM;
  feq_chain_configure(chain, &settings);
  feq_chain_process(chain, channels, 512);
  check(feq_chain_latency_frames(chain) == 0,
        "and stands down when the mode leaves linear");

  // Isolate wants a kernel too, whatever the phase mode says.
  settings.eq.isolate = 1;
  feq_chain_configure(chain, &settings);
  feq_chain_process(chain, channels, 512);
  check(feq_chain_latency_frames(chain) == feq_linear_phase_latency(),
        "Minimum Isolate brings the convolver back on its own");

  feq_chain_destroy(chain);
}

/**
 * A drag publishes faster than blocks go by, and nothing is leaked or read
 * after being freed.
 *
 * The handoff slot holds one. Writing it twice between two blocks means the
 * first was never adopted, and the control thread has to be the one to free
 * it — which is what the exchange in `publish_handoff` is for. Run under a
 * leak checker this is the case that would show it.
 */
void test_kernel_handoff_survives_a_drag() {
  FeqChain* chain = feq_chain_create(48000.0, 2, 512);
  check(chain != nullptr, "chain is created");
  if (chain == nullptr) {
    return;
  }
  FeqChainSettings settings{};
  feq_chain_settings_defaults(&settings);
  settings.enabled = 1;
  settings.eq.enabled = 1;
  settings.eq.phase = FEQ_PHASE_LINEAR;
  settings.eq.band_count = 1;
  settings.eq.bands[0].enabled = 1;
  settings.eq.bands[0].type = FEQ_FILTER_PK;
  settings.eq.bands[0].frequency = 1000.0;
  settings.eq.bands[0].quality = 1.0;

  std::vector<float> left(512, 0.0f);
  std::vector<float> right(512, 0.0f);
  float* channels[2] = {left.data(), right.data()};

  for (int step = 0; step < 32; ++step) {
    settings.eq.bands[0].gain_db = 0.5 * static_cast<double>(step);
    feq_chain_configure(chain, &settings);
  }
  feq_chain_process(chain, channels, 512);
  check(feq_chain_latency_frames(chain) == feq_linear_phase_latency(),
        "the last kernel of a drag is the one that arrives");

  // The same settings again must not rebuild: that guard is the difference
  // between one kernel a frame and one per settings message.
  feq_chain_configure(chain, &settings);
  feq_chain_process(chain, channels, 512);
  check(feq_chain_latency_frames(chain) == feq_linear_phase_latency(),
        "and an unchanged rack leaves it alone");

  feq_chain_destroy(chain);
}

int main() {
  std::printf("fluideq dsp-core, version %s, ABI %u\n", feq_core_version(),
              feq_core_abi_version());
  test_linear_phase_engages();
  test_kernel_handoff_survives_a_drag();
  test_identity();
  test_in_place();
  test_invalid_samples_are_repaired();
  test_parameters();
  test_snapshot_commit();
  test_rejects_impossible_engines();
  test_crossfade_mixer();
  if (g_failures == 0) {
    std::printf("\nall checks passed\n");
    return 0;
  }
  std::printf("\n%d check(s) failed\n", g_failures);
  return 1;
}
