/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Turns an Equalizer APO `GraphicEQ:` curve into a linear-phase FIR kernel,
 * by frequency sampling: the target curve is evaluated at every bin of a
 * power-of-two FFT, given zero phase, inverse-transformed, centred and
 * windowed. Not under `include/`: only `graph.cpp` (Task 3), beside this
 * file, calls it.
 */
#ifndef FLUIDEQ_ENGINE_GRAPHIC_EQ_H
#define FLUIDEQ_ENGINE_GRAPHIC_EQ_H

#include <cstdint>
#include <vector>

#include "fluideq_engine/config.h"

namespace fluideq_engine {

/**
 * Designs a linear-phase FIR approximating `points` (in dB, piecewise-linear
 * in log10(frequency), clamped to the outer points beyond their range).
 *
 * `taps` is forced odd (`taps | 1`) so the kernel has a single centre sample
 * and the linear phase is an exact integer delay of half its length. An
 * empty `points` asks for no curve at all: every bin evaluates to 0 dB, whose
 * inverse transform is an exact unit impulse — the same code path returns a
 * plain bypass kernel with no separate case for it.
 */
std::vector<float> design_graphic_kernel(const std::vector<GraphicPoint>& points,
                                         uint32_t sample_rate, uint32_t taps);

}  // namespace fluideq_engine

#endif  // FLUIDEQ_ENGINE_GRAPHIC_EQ_H
