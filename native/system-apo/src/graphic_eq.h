/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Turns Equalizer APO `GraphicEQ:` curves into one linear-phase FIR kernel,
 * by frequency sampling: the target curve is evaluated at every bin of a
 * power-of-two FFT, given zero phase, inverse-transformed, centred and
 * windowed. Not under `include/`: only `graph.cpp`, beside this file, calls
 * it.
 */
#ifndef FLUIDEQ_ENGINE_GRAPHIC_EQ_H
#define FLUIDEQ_ENGINE_GRAPHIC_EQ_H

#include <cstdint>
#include <vector>

#include "fluideq_engine/config.h"

namespace fluideq_engine {

/**
 * Designs a linear-phase FIR approximating every curve in `curves` at once.
 *
 * Each curve is in dB, piecewise-linear in log10(frequency) and clamped to
 * its outer points beyond their range, evaluated on its own exactly as a
 * lone curve would be; the target is their sum. Curves in series multiply
 * their magnitudes, so adding their dB is the response Equalizer APO gives
 * the same lines — here in one kernel, with one group delay instead of one
 * per curve.
 *
 * `taps` is forced odd (`taps | 1`) so the kernel has a single centre sample
 * and the linear phase is an exact integer delay of half its length. No
 * curves at all is 0 dB at every bin, whose inverse transform is an exact
 * unit impulse — the same code path returns a plain bypass kernel with no
 * separate case for it.
 */
std::vector<float> design_graphic_kernel(
    const std::vector<std::vector<GraphicPoint>>& curves, uint32_t sample_rate,
    uint32_t taps);

}  // namespace fluideq_engine

#endif  // FLUIDEQ_ENGINE_GRAPHIC_EQ_H
