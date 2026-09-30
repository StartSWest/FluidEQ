/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Hold the native engine to what the TypeScript engine already does.
 *
 * The fixtures were frozen from the final TypeScript rack immediately before
 * it was removed, so this is not a test of agreed constants — it is a test that
 * the native engine keeps producing the same numbers as the thing it replaced,
 * on signals chosen because each one is somewhere a DSP port has historically
 * gone wrong.
 *
 * A processor the native side has not implemented yet is reported as PENDING
 * and counted, never skipped quietly. A suite that silently passes over what
 * it cannot check is a suite that reports green for an engine that does
 * nothing, which is what the positive control at the end exists to prevent.
 */

#include "parity_fixture.h"

#include "fluideq/analog_diode.h"
#include "fluideq/bass_punch.h"
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
#include "fluideq/convolver.h"
#include "fluideq/linear_phase.h"
#include "fluideq/chain.h"
#include "fluideq/crossfade.h"
#include "fluideq/loudness.h"
#include "fluideq/post_filter_normalizer.h"
#include "fluideq/limiter.h"
#include "fluideq/saturate.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <filesystem>
#include <map>
#include <fstream>
#include <span>
#include <string>
#include <vector>

using namespace feq_parity;

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
  size_t superseded = 0;
  std::map<uint32_t, size_t> pending_by_processor;
  /** How many fixtures each entry of `kSuperseded` took out of comparison. */
  std::vector<size_t> excused(std::size(kSuperseded), 0);
  bool superseded_stale = false;
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
      ++pending_by_processor[fixture.processor];
      continue;
    }
    const Superseded* excuse = superseded_entry(fixture);
    if (excuse != nullptr) {
      /**
       * Still rendered, so a crash or a NaN in a processor that has left
       * parity is still this suite's business; only the comparison against
       * what the TypeScript rack used to produce is dropped.
       */
      const Difference difference = compare(actual, fixture.expected);
      if (difference.non_finite) {
        std::printf("  FAIL %s  NON-FINITE OUTPUT\n", fixture.name.c_str());
        ++failed;
        continue;
      }
      if (!excuse->fixtures.empty() && within_tolerance(fixture, difference)) {
        std::printf("  SUPERSEDED YET AGREEING %s: nothing left to excuse\n",
                    fixture.name.c_str());
        superseded_stale = true;
      }
      ++superseded;
      ++excused[static_cast<size_t>(excuse - kSuperseded)];
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
  for (const auto& entry : pending_by_processor) {
    // Named, because a count alone cannot tell "one processor was never
    // ported" from "every whole-chain fixture stopped running last month".
    std::printf("            processor %u: %zu\n", entry.first, entry.second);
  }
  if (superseded > 0) {
    std::printf("  superseded %zu (changed on purpose since the port)\n",
                superseded);
  }
  for (size_t index = 0; index < std::size(kSuperseded); ++index) {
    const Superseded& entry = kSuperseded[index];
    const size_t count = excused[index];
    if (entry.fixtures.empty()) {
      std::printf("            processor %u: %zu — %s\n", entry.processor,
                  count, entry.reason);
    } else {
      std::printf("            processor %u: %zu of %zu named — %s\n",
                  entry.processor, count, entry.fixtures.size(), entry.reason);
    }
    // Every fixture of a processor, or exactly the ones an entry names.
    if (entry.fixtures.empty() ? count == 0
                               : count != entry.fixtures.size()) {
      superseded_stale = true;
    }
  }
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
        "  chain coverage: LOST — the runner no longer reads the layout the "
        "corpus was frozen with, so the whole-chain fixtures above were not "
        "run\n");
  }

  if (superseded_stale) {
    std::printf(
        "  superseded coverage: an entry above matched none of its fixtures, "
        "or names one that is missing or agrees again, so it is excusing "
        "nothing and belongs in history rather than in this table\n");
  }

  if (failed > 0 || unreadable > 0 || !control_ok || !dynamic_covered ||
      g_chain_layout_stale || superseded_stale) {
    std::printf("\nparity FAILED\n");
    return 1;
  }
  std::printf("\nparity passed (%zu still to port)\n", pending);
  return 0;
}
