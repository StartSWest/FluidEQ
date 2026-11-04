/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Racks with Dynamics on, as the app writes them, for `dynamics_line_test.cpp`.
 *
 * Produced by the one encoder there is — `encodeChainSettings` and
 * `appendPresetTone` in `src/common/dsp/chainWire.ts` — for the reason
 * `dsp_chain_fixture.h` gives: a layout the two sides disagree about does
 * not fail loudly. Each band carries values no other band does, so a field
 * read from the wrong place is a number that cannot match. Regenerate with a
 * script printing the defaults with game mode, Footsteps (Lift 0.85, Calm
 * 0.5) and Dynamics on — bands (-45, 1.5, 6, -18, 4), (-42, 2, 9, -14, 2),
 * (-48, 2.5, 5, -10, 1), attack 8, release 250, mix 0.75, make-up 1.5 —
 * the same with a
 * 3150 Hz +2.8 dB bell at Q 1.4 appended, and the defaults with Dynamics
 * alone.
 */
#ifndef FLUIDEQ_ENGINE_DYNAMICS_LINE_FIXTURE_H
#define FLUIDEQ_ENGINE_DYNAMICS_LINE_FIXTURE_H

namespace fluideq_engine_test {

/** Game mode, Footsteps and Dynamics on. */
inline const char* const kDynamicsBothLine =
    "1 0 0 0 0 0 0.45 0 0.35 700 0.3 1 77 0.3568123043805345 1.8 0.15 0.05 1 950 0.3 2 0.2 "
    "0.18 1 7700 0.23727782085891017 2.6 0.38 0.6 0 0 0 1 0 0 0 0 1 0 0 0 0 0 0.55 4500 11000 "
    "6 0.67 0 1 60 1 0.7 4207 12 1 0 0 0 0.9 1.05 1.25 200 3000 0.25 0 0 -1 5 100 0 0 0 -14 "
    "-1 200 0 0 0 0 1 0.15 -6 -1 0.95 0 0 6 24 30 0 0.5 32 0 0 1 0 0 90 0 0 0 0.8 0 0 0 120 "
    "0.65 -0.3 0 80 0 1 0 1 4.2 0.55 1.8 0 0 1 1 -30 30 0 -100 100 -140 140 0 0 0 0 0 0 0 1 "
    "80 0 0.6 1.8 1.8 1.8 1.8 1.8 1.8 1.8 0 0 0 0 0 0 0 0 1 9 15 1 2 32 0 0.7 0 -24 1 0 50 0 "
    "2.23 0 -24 1 0 80 0 2.23 0 -24 1 0 125 0 2.23 0 -24 1 0 200 0 2.23 0 -24 1 0 315 0 2.23 "
    "0 -24 1 0 500 0 2.23 0 -24 1 0 800 0 2.23 0 -24 1 0 1250 0 2.23 0 -24 1 0 2000 0 2.23 0 "
    "-24 1 0 3150 0 2.23 0 -24 1 0 5000 0 2.23 0 -24 1 0 8000 0 2.23 0 -24 1 0 12500 0 2.23 0 "
    "-24 1 3 16000 0 0.7 0 -24 1 -1 -14 1 1179602772 1 4 1 0 0.85 0.5 1146703425 1 20 1 -45 "
    "1.5 6 -18 4 -42 2 9 -14 2 -48 2.5 5 -10 1 8 250 0.75 1.5";

/** The same, with the preset's curve after it. */
inline const char* const kDynamicsToneLine =
    "1 0 0 0 0 0 0.45 0 0.35 700 0.3 1 77 0.3568123043805345 1.8 0.15 0.05 1 950 0.3 2 0.2 "
    "0.18 1 7700 0.23727782085891017 2.6 0.38 0.6 0 0 0 1 0 0 0 0 1 0 0 0 0 0 0.55 4500 11000 "
    "6 0.67 0 1 60 1 0.7 4207 12 1 0 0 0 0.9 1.05 1.25 200 3000 0.25 0 0 -1 5 100 0 0 0 -14 "
    "-1 200 0 0 0 0 1 0.15 -6 -1 0.95 0 0 6 24 30 0 0.5 32 0 0 1 0 0 90 0 0 0 0.8 0 0 0 120 "
    "0.65 -0.3 0 80 0 1 0 1 4.2 0.55 1.8 0 0 1 1 -30 30 0 -100 100 -140 140 0 0 0 0 0 0 0 1 "
    "80 0 0.6 1.8 1.8 1.8 1.8 1.8 1.8 1.8 0 0 0 0 0 0 0 0 1 9 15 1 2 32 0 0.7 0 -24 1 0 50 0 "
    "2.23 0 -24 1 0 80 0 2.23 0 -24 1 0 125 0 2.23 0 -24 1 0 200 0 2.23 0 -24 1 0 315 0 2.23 "
    "0 -24 1 0 500 0 2.23 0 -24 1 0 800 0 2.23 0 -24 1 0 1250 0 2.23 0 -24 1 0 2000 0 2.23 0 "
    "-24 1 0 3150 0 2.23 0 -24 1 0 5000 0 2.23 0 -24 1 0 8000 0 2.23 0 -24 1 0 12500 0 2.23 0 "
    "-24 1 3 16000 0 0.7 0 -24 1 -1 -14 1 1179602772 1 4 1 0 0.85 0.5 1146703425 1 20 1 -45 "
    "1.5 6 -18 4 -42 2 9 -14 2 -48 2.5 5 -10 1 8 250 0.75 1.5 1414483525 1 1 1 0 3150 2.8 1.4";

/** Dynamics alone, after a game word written off. */
inline const char* const kDynamicsAloneLine =
    "1 0 0 0 0 0 0.45 0 0.35 700 0.3 1 77 0.3568123043805345 1.8 0.15 0.05 1 950 0.3 2 0.2 "
    "0.18 1 7700 0.23727782085891017 2.6 0.38 0.6 0 0 0 1 0 0 0 0 1 0 0 0 0 0 0.55 4500 11000 "
    "6 0.67 0 1 60 1 0.7 4207 12 1 0 0 0 0.9 1.05 1.25 200 3000 0.25 0 0 -1 5 100 0 0 0 -14 "
    "-1 200 0 0 0 0 1 0.15 -6 -1 0.95 0 0 6 24 30 0 0.5 32 0 0 1 0 0 90 0 0 0 0.8 0 0 0 120 "
    "0.65 -0.3 0 80 0 1 0 1 4.2 0.55 1.8 0 0 1 1 -30 30 0 -100 100 -140 140 0 0 0 0 0 0 0 1 "
    "80 0 0.6 1.8 1.8 1.8 1.8 1.8 1.8 1.8 0 0 0 0 0 0 0 0 1 9 15 1 2 32 0 0.7 0 -24 1 0 50 0 "
    "2.23 0 -24 1 0 80 0 2.23 0 -24 1 0 125 0 2.23 0 -24 1 0 200 0 2.23 0 -24 1 0 315 0 2.23 "
    "0 -24 1 0 500 0 2.23 0 -24 1 0 800 0 2.23 0 -24 1 0 1250 0 2.23 0 -24 1 0 2000 0 2.23 0 "
    "-24 1 0 3150 0 2.23 0 -24 1 0 5000 0 2.23 0 -24 1 0 8000 0 2.23 0 -24 1 0 12500 0 2.23 0 "
    "-24 1 3 16000 0 0.7 0 -24 1 -1 -14 0 1146703425 1 20 1 -45 1.5 6 -18 4 -42 2 9 -14 2 -48 "
    "2.5 5 -10 1 8 250 0.75 1.5";

}  // namespace fluideq_engine_test

#endif  // FLUIDEQ_ENGINE_DYNAMICS_LINE_FIXTURE_H
