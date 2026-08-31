/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What `bass_forge.cpp` and `bass_forge_meters.cpp` share, which is very
 * little on purpose.
 *
 * The analyser was split out when the audio path grew its own shelf, and the
 * seam it was split on is the one that was already there: the eight band-passes
 * read the band and the forged band and write to nothing else, so they can be
 * gated off entirely without the audio noticing. Keeping them in the same file
 * as the generators is what made it easy to miss that they were running for a
 * graph nobody had open.
 */
#ifndef FLUIDEQ_BASS_FORGE_INTERNAL_H
#define FLUIDEQ_BASS_FORGE_INTERNAL_H

#include "fluideq/bass_forge.h"

/** The meter grid: eight bands, geometrically spaced, bass and nothing else. */
constexpr double kMeterLowHz = 20.0;
constexpr double kMeterHighHz = 1000.0;
constexpr double kMeterFloorDb = -120.0;

/** The eight band-passes, rebuilt only when the rate moves. */
void bass_forge_build_meters(FeqBassForge* state, double sample_rate);

/** Empties the filters and the followers. Called by reset and by the gate. */
void bass_forge_clear_meters(FeqBassForge* state);

/** One sample of both runs. `window` is the smoothing the audio path uses. */
void bass_forge_run_meters(FeqBassForge* state,
                           double dry_band,
                           double forged_band,
                           double window);

#endif /* FLUIDEQ_BASS_FORGE_INTERNAL_H */
