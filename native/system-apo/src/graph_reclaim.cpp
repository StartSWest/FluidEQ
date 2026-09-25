/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "graph_reclaim.h"

#include <algorithm>

namespace fluideq_engine {

void reclaim_graphs(std::vector<OwnedGraph>& owned, uint64_t blocks) {
  // Entries are in publish order and their block counts never decrease, so
  // the newest entry whose grace period has elapsed is a boundary: every
  // entry before it was superseded by something the audio thread has already
  // taken up, and cannot be reached again — except by a graph still crossing
  // over from it (`Graph::crossing_from`), which plays it every block until
  // it has crossed. So whatever a kept graph names there is kept too, and
  // whatever that one names, however far back.
  size_t boundary = 0;
  for (size_t at = owned.size(); at > 0; --at) {
    if (blocks >= owned[at - 1].blocks_at_publish + kGraceBlocks) {
      boundary = at - 1;
      break;
    }
  }
  std::vector<const Graph*> crossed_from;
  for (size_t at = boundary; at < owned.size(); ++at) {
    for (const Graph* from = owned[at].graph->crossing_from(); from != nullptr;
         from = from->crossing_from()) {
      crossed_from.push_back(from);
    }
  }
  size_t kept = 0;
  for (size_t at = 0; at < owned.size(); ++at) {
    const bool still_played =
        std::find(crossed_from.begin(), crossed_from.end(), owned[at].graph) !=
        crossed_from.end();
    if (at >= boundary || still_played) {
      owned[kept++] = owned[at];
    } else {
      delete owned[at].graph;
    }
  }
  owned.resize(kept);
}

}  // namespace fluideq_engine
