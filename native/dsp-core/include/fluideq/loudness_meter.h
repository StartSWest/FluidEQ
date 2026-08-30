/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * BS.1770 loudness of what is playing, as it plays.
 *
 * The offline analyzer next door measures a whole file before it is heard and
 * is the reference for the track-level gain. This is the other half and it did
 * not exist: nothing in the app could say how loud the output is RIGHT NOW, so
 * the Master card printed the target the user had dialled and had no way to
 * show whether the chain was reaching it. A loudness target with no loudness
 * meter beside it is a number that cannot be checked.
 *
 * ## Why this is not the offline analyzer with a getter bolted on
 *
 * That one keeps every 400 ms block's energy in a `std::vector` that grows with
 * the track and allocates when it does. On a device callback that is two
 * disqualifying properties, and the second one is fatal rather than untidy.
 *
 * So the shape here is different in three ways:
 *
 *  - **Energy is accumulated per 100 ms sub-block into a fixed ring of thirty.**
 *    Momentary is the mean of the last four sub-blocks and short term the mean
 *    of all thirty, which is exactly BS.1770's 400 ms and EBU Tech 3341's 3 s
 *    without ever holding three seconds of samples anywhere.
 *  - **Integrated and range come from fixed histograms of block loudness**,
 *    0.1 LU per bin, holding a count and an energy sum. Memory is therefore
 *    constant however long the session runs, and the gated mean stays exact —
 *    reconstructing energy from bin centres, which is the usual shortcut, puts
 *    the error in the measurement rather than only in the gate threshold.
 *  - **No true peak.** The safety stage already measures the final output's
 *    true peak with an oversampling FIR, and a second one here would be the
 *    most expensive thing in the file to learn a number the chain already has.
 *
 * ## What runs where
 *
 * `process` is the audio thread: two biquads per channel per sample, and once
 * every 100 ms a scan of the two histograms. That scan is about three thousand
 * integer operations five times a second, it allocates nothing, and it is what
 * lets `read` be four relaxed loads from the control thread.
 */
#ifndef FLUIDEQ_LOUDNESS_METER_H
#define FLUIDEQ_LOUDNESS_METER_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/** What a window with nothing above the absolute gate reports, in LUFS. */
#define FEQ_LOUDNESS_METER_SILENCE_DB (-120.0)

typedef struct FeqLoudnessMeter FeqLoudnessMeter;

typedef struct FeqLoudnessReading {
  /** The last 400 ms, K-weighted and ungated. */
  double momentary_lufs;
  /** The last 3 s, which is the one a person watches while setting a target. */
  double short_term_lufs;
  /** Gated over everything since the last reset. */
  double integrated_lufs;
  /**
   * Loudness range in LU: the 95th percentile of short-term blocks minus the
   * 10th, over blocks surviving a gate 20 LU below their own mean.
   *
   * The number that says whether a target was reached by mastering or by
   * flattening. Two records at the same integrated loudness and eight LU apart
   * in range are not the same master, and nothing else on the page can tell
   * them apart.
   */
  double range_lu;
} FeqLoudnessReading;

/**
 * Channels above two are ignored, matching the offline analyzer: BS.1770's
 * surround weights are not implemented and the player feeds a stereo pair.
 * Returns null on a rate or channel count of zero.
 */
FeqLoudnessMeter* feq_loudness_meter_create(double sample_rate,
                                            uint32_t channels);
void feq_loudness_meter_destroy(FeqLoudnessMeter* meter);

/**
 * Start the integration again, for a new programme.
 *
 * Integrated loudness is a property of one piece of music. Carrying it across
 * a track change would answer a question nobody asked — how loud the last two
 * songs were on average — and would make the reading drift further from the
 * target the longer the queue ran.
 */
void feq_loudness_meter_reset(FeqLoudnessMeter* meter);

/** One block, planar. **Audio thread.** Allocates nothing. */
void feq_loudness_meter_process(FeqLoudnessMeter* meter,
                                const float* const* channels,
                                uint32_t frames);

/** The last published reading. **Any thread.** */
void feq_loudness_meter_read(const FeqLoudnessMeter* meter,
                             FeqLoudnessReading* out);

#ifdef __cplusplus
}
#endif

#endif /* FLUIDEQ_LOUDNESS_METER_H */
