/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The one transform every spectrum in the meters is read through.
 *
 * Shared by the stages' windows (`meters.cpp`) and the EQ tap's live and
 * detail windows (`meters_eq_live.cpp`), so a tone reads the same level in
 * each: a Blackman window, both channels' magnitudes averaged, divided by the
 * transform size — the scale `AnalyserNode` reports and every graph in the
 * panel was drawn against.
 */
#ifndef FLUIDEQ_METERS_TRANSFORM_H
#define FLUIDEQ_METERS_TRANSFORM_H

#include <cstdint>
#include <vector>

/** Blackman at `size` points, the window `AnalyserNode` applies. */
std::vector<double> meter_blackman(uint32_t size);

/**
 * Both channels' magnitudes from ONE complex transform.
 *
 * `real` holds the windowed left channel and `imaginary` the windowed right,
 * `size` each, a power of two; both are overwritten. Two real signals share a
 * transform exactly — each one's spectrum is recovered from the bin and its
 * mirror — so the long window costs one transform rather than two.
 *
 * Writes `0.5 * (|L[k]| + |R[k]|) / size` for each of the first `bins` bins:
 * the channels' MAGNITUDES averaged rather than their signals summed, because
 * anti-phase material sums to silence (`StageWindow` in `meters.cpp`).
 */
void meter_two_channel_magnitudes(double* real,
                                  double* imaginary,
                                  uint32_t size,
                                  uint32_t bins,
                                  double* out_magnitudes);

/** Below this the display is at its floor anyway, and log10(0) is not. */
constexpr double kMeterMagnitudeFloor = 1e-10;

#endif /* FLUIDEQ_METERS_TRANSFORM_H */
