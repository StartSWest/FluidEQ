/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * When the watcher may destroy a graph it published.
 *
 * Split from `watcher.cpp`, which runs a thread and opens handles, so the
 * rule can be tested on its own: it is the one thing standing between a
 * graph the audio thread is still playing and `delete`.
 */

#ifndef FLUIDEQ_ENGINE_GRAPH_RECLAIM_H
#define FLUIDEQ_ENGINE_GRAPH_RECLAIM_H

#include <cstdint>
#include <vector>

#include "fluideq_engine/graph.h"

namespace fluideq_engine {

/** A graph the watcher owns, and the audio thread's block count at its publish. */
struct OwnedGraph {
  Graph* graph;
  uint64_t blocks_at_publish;
};

/**
 * Blocks the audio thread must complete after a publish before the graphs
 * older than it can be destroyed.
 *
 * Two, not one. The block in flight when the new graph was stored may already
 * have read the previous `pending` and be about to run the old graph; only
 * the block after that one is guaranteed to have started after the store was
 * visible. Counting completed blocks, `blocks >= at + 2` means both of them
 * are finished and every block from here on runs the new graph or a later
 * one.
 */
inline constexpr uint64_t kGraceBlocks = 2;

/**
 * Destroys every graph in `owned` nothing can play any more, keeping the rest
 * in publish order. `owned` is in publish order; `blocks` is what the audio
 * thread has completed.
 */
void reclaim_graphs(std::vector<OwnedGraph>& owned, uint64_t blocks);

}  // namespace fluideq_engine

#endif  // FLUIDEQ_ENGINE_GRAPH_RECLAIM_H
