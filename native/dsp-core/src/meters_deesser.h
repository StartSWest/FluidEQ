/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The De-esser's window in the meters, folded per block on the audio thread
 * and cleared as the control thread takes it.
 *
 * Folded rather than stored for Bass Punch's measured reason: a block is
 * published about ninety times a second and read about twenty-three, and an
 * S lasts a few of those blocks — a stored cut would be missed three times in
 * four. Independent atomics, as every other stage's here: each value is drawn
 * as its own mark on a display that repaints every frame, so a reader that
 * catches a band from this block and its neighbour from the next draws a
 * picture at worst one block stale.
 */
#ifndef FLUIDEQ_METERS_DEESSER_H
#define FLUIDEQ_METERS_DEESSER_H

#include "fluideq/deesser.h"

#include <atomic>

struct DeEsserMeterWindow {
  std::atomic<float> reduction_db{0.0f};
  std::atomic<float> frequency_hz{0.0f};
  std::atomic<float> confidence{0.0f};
  std::atomic<float> centre{0.0f};
  std::atomic<float> shape{0.0f};
  std::atomic<float> onset{0.0f};
  std::atomic<float> sibilance_db{-120.0f};
  std::atomic<uint32_t> band_count{0};
  std::atomic<float> band_hz[FEQ_DEESSER_MAX_BANDS];
  std::atomic<float> band_level_db[FEQ_DEESSER_MAX_BANDS];
  std::atomic<float> band_threshold_db[FEQ_DEESSER_MAX_BANDS];
  std::atomic<float> band_cut_db[FEQ_DEESSER_MAX_BANDS];

  DeEsserMeterWindow();
};

/** Fold one block's report in. AUDIO thread. */
void deesser_window_fold(DeEsserMeterWindow& window,
                         const FeqDeEsserReport& report);

/** Take the window, clearing what is folded. CONTROL thread. */
void deesser_window_take(DeEsserMeterWindow& window, FeqDeEsserReport* out);

#endif /* FLUIDEQ_METERS_DEESSER_H */
