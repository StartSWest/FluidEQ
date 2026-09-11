/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Building the two FIR stages a `Graph` can run — the `Convolution:` impulse
 * response read off disk, and every `GraphicEQ:` curve designed into one
 * filter — and the per-channel convolvers for either. Split from `graph.cpp`,
 * which is the graph itself: what runs, in what order, on the audio thread.
 * Everything here runs in the constructor, never on the audio thread.
 */
#ifndef FLUIDEQ_ENGINE_GRAPH_STAGES_H
#define FLUIDEQ_ENGINE_GRAPH_STAGES_H

#include <cstdint>
#include <memory>
#include <string>
#include <vector>

#include "fluideq/convolver.h"
#include "fluideq_engine/config.h"
#include "fluideq_engine/graph.h"

namespace fluideq_engine {

using ConvolverPtr = std::unique_ptr<FeqConvolver, detail::ConvolverDeleter>;

/** The `Convolution:` file, at the stream's rate. Empty when unusable. */
std::vector<float> load_impulse(const std::wstring& path, uint32_t sample_rate,
                                std::vector<std::string>& warnings);

/** Every `GraphicEQ:` curve as one linear-phase FIR at the stream's rate. */
std::vector<float> design_graphic(
    const std::vector<std::vector<GraphicPoint>>& curves, uint32_t sample_rate,
    std::vector<std::string>& warnings);

/**
 * One convolver per channel, all or nothing.
 *
 * A stage that ran on some channels and not others would delay them by
 * different amounts, which collapses the stereo image — worse than the same
 * config running with no convolution at all. Failing partway needs no manual
 * unwind: `out` holds `unique_ptr`s, so clearing it destroys whatever had
 * already been built.
 */
bool build_convolvers(const FeqConvolverKernel* kernel, uint32_t channels,
                      std::vector<ConvolverPtr>& out);

}  // namespace fluideq_engine

#endif  // FLUIDEQ_ENGINE_GRAPH_STAGES_H
