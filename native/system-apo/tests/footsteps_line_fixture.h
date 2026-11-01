/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Racks with Footsteps on, as the app writes them, for `footsteps_line_test.cpp`.
 *
 * Produced by the one encoder there is — `encodeChainSettings` and
 * `appendPresetTone` in `src/common/dsp/chainWire.ts` — for the reason
 * `dsp_chain_fixture.h` gives: a layout the two sides disagree about does
 * not fail loudly. Regenerate them with a script that prints, for the Gaming
 * preset (`dspPresetSettings('gaming')`), its line, the same line with a
 * 3150 Hz +2.8 dB bell at Q 1.4 appended, and the defaults with Footsteps on
 * (Isolate on, Lift 0.4, Calm 0.2).
 */
#ifndef FLUIDEQ_ENGINE_FOOTSTEPS_LINE_FIXTURE_H
#define FLUIDEQ_ENGINE_FOOTSTEPS_LINE_FIXTURE_H

namespace fluideq_engine_test {

/** The Gaming preset as `dspPresetSettings` makes it: game mode on, Footsteps at Competitive. */
inline const char* const kGamingLine =
    "1 0 0 0 0 0 0.45 0 0.35 700 0.3 1 77 0.3568123043805345 1.8 0.15 0.05 "
    "1 950 0.3 2 0.2 0.18 1 7700 0.23727782085891017 2.6 0.38 0.6 1 0 1 1 0 "
    "0 0 40 1 20 0 0 0 0 0.55 4500 11000 6 0.67 0 1 60 1 0.7 4207 12 1 0 0 "
    "0 0.9 1.05 1.25 200 3000 0.25 1 1 -1 1 60 0 0 0 -14 -1 200 0 0 0 0 1 "
    "0.15 -6 -1 0.95 0 0 6 24 30 0 0.5 32 0 0 1 0 0 90 0 0 0 0.8 0 0 0 120 "
    "0.65 -0.3 0 80 0 1 0 1 4.2 0.55 1.8 0 0 1 1 -30 30 0 -100 100 -140 140 "
    "0 0 0 0 0 0 0 1 80 0 0.6 1.8 1.8 1.8 1.8 1.8 1.8 1.8 0 0 0 0 0 0 0 0 1 "
    "9 15 1 0 32 0 0.7 0 -24 1 0 50 0 2.23 0 -24 1 0 80 0 2.23 0 -24 1 0 "
    "125 0 2.23 0 -24 1 0 200 0 2.23 0 -24 1 0 315 0 2.23 0 -24 1 0 500 0 "
    "2.23 0 -24 1 0 800 0 2.23 0 -24 1 0 1250 0 2.23 0 -24 1 0 2000 0 2.23 "
    "0 -24 1 0 3150 0 2.23 0 -24 1 0 5000 0 2.23 0 -24 1 0 8000 0 2.23 0 "
    "-24 1 0 12500 0 2.23 0 -24 1 0 16000 0 0.7 0 -24 0 -1 -14 1 1179602772 "
    "1 4 1 0 0.85 0.5";

/** The same with a one-band curve after it (`appendPresetTone`). */
inline const char* const kGamingToneLine =
    "1 0 0 0 0 0 0.45 0 0.35 700 0.3 1 77 0.3568123043805345 1.8 0.15 0.05 "
    "1 950 0.3 2 0.2 0.18 1 7700 0.23727782085891017 2.6 0.38 0.6 1 0 1 1 0 "
    "0 0 40 1 20 0 0 0 0 0.55 4500 11000 6 0.67 0 1 60 1 0.7 4207 12 1 0 0 "
    "0 0.9 1.05 1.25 200 3000 0.25 1 1 -1 1 60 0 0 0 -14 -1 200 0 0 0 0 1 "
    "0.15 -6 -1 0.95 0 0 6 24 30 0 0.5 32 0 0 1 0 0 90 0 0 0 0.8 0 0 0 120 "
    "0.65 -0.3 0 80 0 1 0 1 4.2 0.55 1.8 0 0 1 1 -30 30 0 -100 100 -140 140 "
    "0 0 0 0 0 0 0 1 80 0 0.6 1.8 1.8 1.8 1.8 1.8 1.8 1.8 0 0 0 0 0 0 0 0 1 "
    "9 15 1 0 32 0 0.7 0 -24 1 0 50 0 2.23 0 -24 1 0 80 0 2.23 0 -24 1 0 "
    "125 0 2.23 0 -24 1 0 200 0 2.23 0 -24 1 0 315 0 2.23 0 -24 1 0 500 0 "
    "2.23 0 -24 1 0 800 0 2.23 0 -24 1 0 1250 0 2.23 0 -24 1 0 2000 0 2.23 "
    "0 -24 1 0 3150 0 2.23 0 -24 1 0 5000 0 2.23 0 -24 1 0 8000 0 2.23 0 "
    "-24 1 0 12500 0 2.23 0 -24 1 0 16000 0 0.7 0 -24 0 -1 -14 1 1179602772 "
    "1 4 1 0 0.85 0.5 1414483525 1 1 1 0 3150 2.8 1.4";

/** Footsteps alone on the defaults, game mode off, Isolate on, Lift 0.4, Calm 0.2. */
inline const char* const kFootstepsAloneLine =
    "1 0 0 0 0 0 0.45 0 0.35 700 0.3 1 77 0.3568123043805345 1.8 0.15 0.05 "
    "1 950 0.3 2 0.2 0.18 1 7700 0.23727782085891017 2.6 0.38 0.6 0 0 0 1 0 "
    "0 0 0 1 0 0 0 0 0 0.55 4500 11000 6 0.67 0 1 60 1 0.7 4207 12 1 0 0 0 "
    "0.9 1.05 1.25 200 3000 0.25 0 0 -1 5 100 0 0 0 -14 -1 200 0 0 0 0 1 "
    "0.15 -6 -1 0.95 0 0 6 24 30 0 0.5 32 0 0 1 0 0 90 0 0 0 0.8 0 0 0 120 "
    "0.65 -0.3 0 80 0 1 0 1 4.2 0.55 1.8 0 0 1 1 -30 30 0 -100 100 -140 140 "
    "0 0 0 0 0 0 0 1 80 0 0.6 1.8 1.8 1.8 1.8 1.8 1.8 1.8 0 0 0 0 0 0 0 0 1 "
    "9 15 1 2 32 0 0.7 0 -24 1 0 50 0 2.23 0 -24 1 0 80 0 2.23 0 -24 1 0 "
    "125 0 2.23 0 -24 1 0 200 0 2.23 0 -24 1 0 315 0 2.23 0 -24 1 0 500 0 "
    "2.23 0 -24 1 0 800 0 2.23 0 -24 1 0 1250 0 2.23 0 -24 1 0 2000 0 2.23 "
    "0 -24 1 0 3150 0 2.23 0 -24 1 0 5000 0 2.23 0 -24 1 0 8000 0 2.23 0 "
    "-24 1 0 12500 0 2.23 0 -24 1 3 16000 0 0.7 0 -24 1 -1 -14 0 1179602772 "
    "1 4 1 1 0.4 0.2";

}  // namespace fluideq_engine_test

#endif /* FLUIDEQ_ENGINE_FOOTSTEPS_LINE_FIXTURE_H */
