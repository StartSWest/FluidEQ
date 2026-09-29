/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The deepest delay the restoration can add, at every rate a device can run.
 *
 * Isolate subtracts the dry signal from a ring sized to this, and the chain
 * holds its surround channels back by it. It was a constant sized by hand for
 * 192 kHz, and a ring too short does not fail: at 384 kHz with Hiss and Voice
 * on, the read wrapped onto the wrong sample. The sums below are each module's
 * delay as `feq_denoise_latency_frames` counts it — the click repairer's
 * lookahead (143), the spectral window at that rate, and the neural module's
 * hop plus its four-hop headroom after conversion from 48 kHz.
 */
#include "fluideq/denoise.h"

#include <cstdio>
#include <cstdint>

namespace {

int g_failures = 0;

void check(bool condition, const char* what) {
  std::printf("  %s %s\n", condition ? "ok  " : "FAIL", what);
  if (!condition) {
    ++g_failures;
  }
}

}  // namespace

int main() {
  std::printf("fluideq denoise bounds\n");
  check(feq_denoise_max_latency_frames(48000.0) == 143 + 2048 + 2400,
        "48 kHz: the window and the voice module at their own rate");
  check(feq_denoise_max_latency_frames(192000.0) == 143 + 8192 + 9600,
        "192 kHz: what the old constant was sized for");
  check(feq_denoise_max_latency_frames(352800.0) == 143 + 16384 + 17640,
        "352.8 kHz");
  check(feq_denoise_max_latency_frames(384000.0) == 143 + 16384 + 19200,
        "384 kHz");
  // POSITIVE CONTROL: the old constant against the rate it failed at.
  check(feq_denoise_max_latency_frames(384000.0) > 32768,
        "384 kHz needs more than the 32768 the ring used to be");
  check(feq_denoise_max_latency_frames(0.0) == 0, "no rate, no delay");

  // A stage at 384 kHz with every module the tests can switch on (the voice
  // module needs its model) reports a delay inside its own bound.
  FeqDenoise* denoise = feq_denoise_create(384000.0, 2, 512);
  FeqDenoiseSettings settings{};
  feq_denoise_settings_defaults(&settings);
  settings.enabled = 1;
  settings.hiss.enabled = 1;
  settings.click.enabled = 1;
  settings.click.max_repair_samples = 128.0;
  feq_denoise_configure(denoise, &settings);
  check(feq_denoise_latency_frames(denoise) ==
            143 + 16384,
        "384 kHz: click and hiss report the bound's own terms");
  check(feq_denoise_latency_frames(denoise) <=
            feq_denoise_max_latency_frames(384000.0),
        "384 kHz: inside the bound");
  feq_denoise_destroy(denoise);

  if (g_failures == 0) {
    std::printf("denoise bounds: ok\n");
    return 0;
  }
  std::printf("\n%d check(s) failed\n", g_failures);
  return 1;
}
