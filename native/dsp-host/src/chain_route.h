/* FluidEQ — GPL-3.0-or-later */
#ifndef FLUIDEQ_CHAIN_ROUTE_H
#define FLUIDEQ_CHAIN_ROUTE_H

#include "fluideq/chain.h"
#include "fluideq/meters.h"
#include "processing_latency.h"

// Audio-owned route state. Control publishes only the requested raw flag.
// A route boundary invalidates the Room capture and all of its delayed audio;
// resetting the whole chain here is unsafe (voice reset can allocate a worker).
class ChainRoute {
 public:
  void process(FeqChain* chain, FeqMeters* meters, bool raw,
               float* const* planar, uint32_t frames,
               ProcessingLatency& latency) noexcept {
    if (raw != raw_) feq_chain_reset_room(chain);
    raw_ = raw;
    if (raw) {
      const FeqRoomReport inactive{FEQ_ROOM_REPORT_TAG, 0};
      feq_meters_publish_room(meters, &inactive);
    } else {
      feq_chain_process(chain, planar, frames);
    }
    // Zero is processing delay only, not device/network/end-to-end latency.
    latency.publish(raw ? nullptr : chain);
  }

 private:
  bool raw_ = false;
};

#endif
