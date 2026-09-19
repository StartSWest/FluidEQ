/* FluidEQ — GPL-3.0-or-later */
#ifndef FLUIDEQ_ANALYSIS_PUBLICATION_H
#define FLUIDEQ_ANALYSIS_PUBLICATION_H

#include "fluideq/meters.h"

// Telemetry-thread state, never touched by the callback. A raw sender produces
// no rack windows, but its changed Room report must still leave the host once.
class AnalysisPublication {
 public:
  void clear() noexcept { room_ = {}; }
  bool take(uint32_t stages, bool scope, uint32_t bands,
            const FeqRoomReport& room) noexcept {
    const bool changed = room.flags != room_.flags ||
                        room.reference_gain_db != room_.reference_gain_db;
    if (stages == 0 && !scope && bands == 0 && !changed) return false;
    room_ = room;
    return true;
  }

 private:
  FeqRoomReport room_{};
};

#endif
