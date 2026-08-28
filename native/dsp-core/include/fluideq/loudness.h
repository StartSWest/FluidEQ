/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Whole-track loudness and true peak, ported from `inputNormalizer.ts`.
 *
 * BS.1770 integrated loudness: K-weighting, 400 ms blocks overlapping by 75%,
 * an absolute gate at -70 LUFS and a relative gate 10 LU below the ungated
 * mean. The true peak is measured over the same pass rather than a second one.
 *
 * Streaming rather than whole-buffer, so a decoder can hand it blocks as they
 * arrive and nothing has to hold the decoded file twice. It allocates on
 * `create` and on nothing else, but it is NOT a real-time path — the block
 * energies grow with the track, and this runs beside the decoder, never in the
 * device callback.
 *
 * Only the measurement lives here. Choosing the gain from it stays in
 * TypeScript on purpose: the panel shows which control won, and two
 * derivations of the same number drift apart until the meter is lying.
 */
#ifndef FLUIDEQ_LOUDNESS_H
#define FLUIDEQ_LOUDNESS_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/** What a silent or absent measurement reports, in dB. */
#define FEQ_LOUDNESS_SILENCE_DB (-120.0)

typedef struct FeqLoudnessAnalyzer FeqLoudnessAnalyzer;

typedef struct FeqLoudnessResult {
  double integrated_lufs;
  double true_peak_dbtp;
} FeqLoudnessResult;

/**
 * `channels` above two are ignored, matching the reference: BS.1770's
 * surround weights are not implemented here and a stereo downmix is what the
 * player feeds anyway. Returns null on a rate or channel count of zero.
 */
FeqLoudnessAnalyzer* feq_loudness_create(double sample_rate, uint32_t channels);
void feq_loudness_destroy(FeqLoudnessAnalyzer* analyzer);

/** Planar, one pointer per channel. Allocates only when a block completes. */
void feq_loudness_feed(FeqLoudnessAnalyzer* analyzer,
                       const float* const* channels,
                       uint32_t frames);

/**
 * Flush the interpolation window and report.
 *
 * The flush is why this is not simply a getter: a peak on the last sample sits
 * inside the half-window the true-peak FIR has not observed yet, so twelve
 * zeroes are pushed through before the maximum is read. Calling it twice is
 * harmless but pushes the tail again, which cannot lower the result.
 */
FeqLoudnessResult feq_loudness_finish(FeqLoudnessAnalyzer* analyzer);

#ifdef __cplusplus
}
#endif

#endif /* FLUIDEQ_LOUDNESS_H */
