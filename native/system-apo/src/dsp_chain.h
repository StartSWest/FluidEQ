/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The flat array of doubles the app writes, as a rack ready to process audio.
 *
 * Two functions, split from `graph.cpp` so that file stays under the
 * project's 500-line limit — and the seam is a real one: everything here is
 * about the boundary between what the app sent and what may run inside
 * audiodg.exe, which is the one place the system-wide rack differs from the
 * Library player's.
 */
#ifndef FLUIDEQ_ENGINE_DSP_CHAIN_H
#define FLUIDEQ_ENGINE_DSP_CHAIN_H

#include <cstdint>
#include <memory>
#include <string>
#include <vector>

#include "fluideq/chain.h"
#include "fluideq_engine/graph.h"

namespace fluideq_engine {

/**
 * Read `values` into `out`. False when the array is not a rack snapshot.
 *
 * `out` is left exactly as it was on a refusal, which is
 * `feq_chain_settings_decode`'s own contract: a caller that ignored the result
 * would otherwise configure a chain from a half-filled struct.
 *
 * What this removes from what the app sent, and why:
 *
 * - **Denoise.** Its voice module loads an ONNX runtime from disk, and
 *   audiodg.exe is a protected process that will not have it: the load fails
 *   silently inside somebody else's process with nowhere to report it. The
 *   whole stage stays off rather than half of it running.
 *
 * Nothing else is stripped. Crossfade, the track-level gains, the noise
 * profile and the voice model are all set through their own calls, never
 * through a snapshot, so the system-wide rack simply never makes them — see
 * `chain.h`, which says why each of them is its own call.
 */
bool decode_dsp_chain(const std::vector<double>& values,
                      FeqChainSettings* out);

/** What `build_rack` hands back: the chain, its width, and its delay. */
struct RackBuild {
  std::unique_ptr<FeqChain, detail::ChainDeleter> chain;
  uint32_t channels = 0;
  uint32_t latency = 0;
};

/**
 * The DSP rack for one endpoint, from the array the app wrote.
 *
 * Never on the audio thread: this allocates every buffer the chain's stages
 * need and, under linear phase, designs a 16384-tap kernel out of two
 * transforms.
 *
 * `chain` is null whenever there is nothing to run — no rack file, a file
 * this build's decoder does not recognise, the rack switched off on the DSP
 * page, or a chain the core refused to allocate. Every one of those leaves
 * the EQ running, which is the whole point of the rack being a separate file
 * from the configuration tree.
 */
RackBuild build_rack(const std::vector<double>& values, uint32_t sample_rate,
                     uint32_t channels, uint32_t max_frames,
                     std::vector<std::string>& warnings);

}  // namespace fluideq_engine

#endif  // FLUIDEQ_ENGINE_DSP_CHAIN_H
