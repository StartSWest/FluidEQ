/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Footsteps' window in the meters, folded per block on the audio thread and
 * cleared as the control thread takes it.
 *
 * Folded for the De-esser's reason (`meters_deesser.h`): a step's lift
 * lasts a few blocks, and a stored reading would be missed most of the times
 * the page looks. The largest lift and the deepest calm of the window, the
 * loudest levels, the bed as last measured.
 */
#ifndef FLUIDEQ_METERS_FOOTSTEPS_H
#define FLUIDEQ_METERS_FOOTSTEPS_H

#include "fluideq/footsteps.h"

#include <atomic>

struct FootstepsMeterWindow {
  std::atomic<float> level_db{-120.0f};
  std::atomic<float> cue_db{-120.0f};
  std::atomic<float> bed_db{-120.0f};
  std::atomic<float> lift_db[FEQ_FOOTSTEPS_BANDS];
  std::atomic<float> calm_db{0.0f};

  FootstepsMeterWindow();
};

/** Fold one block's report in. AUDIO thread. */
void footsteps_window_fold(FootstepsMeterWindow& window,
                           const FeqFootstepsReport& report);

/** Take the window, clearing what is folded. CONTROL thread. */
void footsteps_window_take(FootstepsMeterWindow& window,
                           FeqFootstepsReport* out);

#endif /* FLUIDEQ_METERS_FOOTSTEPS_H */
