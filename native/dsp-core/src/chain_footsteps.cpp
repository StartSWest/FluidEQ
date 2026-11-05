/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Footsteps in the rack: run after the EQ and before Bass Punch and the
 * Room, and reported to the page.
 *
 * After the EQ because the EQ is the listener's own voicing, and what is
 * quiet is decided on the sound as it will be heard. Before the Room because
 * the Room folds a 7.1 game around the head: lifted first, a step behind is
 * lifted on its own speaker, the same on every speaker, and the walls the
 * Room adds are never lifted with it. Before Punch and the Maximizer because
 * those are the level stages, and a lift after the ceiling would be a lift
 * over it.
 */
#include "chain_internal.h"

namespace {

/** The room's speaker that is the centre: FL, FR, then FC (`room.h`). */
constexpr int kCentreSpeaker = 2;

}  // namespace

void chain_apply_footsteps_layout(FeqChain* chain) {
  int centre = -1;
  for (uint32_t channel = 0; channel < chain->channels; ++channel) {
    if (chain->room_speakers[channel] == kCentreSpeaker) {
      centre = static_cast<int>(channel);
    }
  }
  feq_footsteps_set_lfe(chain->footsteps, chain->lfe_channel);
  feq_footsteps_set_centre(chain->footsteps, centre);
}

void chain_process_footsteps(FeqChain* chain, float* const* channels,
                             uint32_t frames) {
  if (chain->footsteps == nullptr) {
    return;
  }
  feq_footsteps_process(chain->footsteps, channels, frames);
  if (chain->meters != nullptr) {
    FeqFootstepsReport report{};
    feq_footsteps_block_report(chain->footsteps, &report);
    feq_meters_publish_footsteps(chain->meters, &report);
  }
}
