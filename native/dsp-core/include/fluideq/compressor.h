/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * One band of the multiband compressor, ported from `compressor.ts`.
 */
#ifndef FLUIDEQ_COMPRESSOR_H
#define FLUIDEQ_COMPRESSOR_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct FeqCompressor {
  /** Smoothed gain reduction, 0-1. Held across process blocks. */
  double gain;
} FeqCompressor;

typedef struct FeqCompressorBand {
  double threshold_db;
  double ratio;
  double attack_ms;
  double release_ms;
  double makeup_db;
} FeqCompressorBand;

void feq_compressor_reset(FeqCompressor* state);

void feq_compressor_process(FeqCompressor* state,
                            float* samples,
                            uint32_t frames,
                            const FeqCompressorBand* band,
                            double sample_rate);

/**
 * Compress matching channel buffers with one detector and one envelope.
 *
 * A dual-mono compressor turns whichever channel holds the loudest transient
 * down by itself, which moves a centred source sideways. The linked detector
 * listens to the louder channel and applies the same gain to both, so the
 * inter-channel level ratio — and therefore the stereo position — cannot move.
 */
void feq_compressor_process_linked(FeqCompressor* state,
                                   float* const* channels,
                                   uint32_t channel_count,
                                   uint32_t frames,
                                   const FeqCompressorBand* band,
                                   double sample_rate);

#ifdef __cplusplus
}
#endif

#endif /* FLUIDEQ_COMPRESSOR_H */
