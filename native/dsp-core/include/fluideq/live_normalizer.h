/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/
#ifndef FLUIDEQ_LIVE_NORMALIZER_H
#define FLUIDEQ_LIVE_NORMALIZER_H
#include <stdint.h>
#include "fluideq/leveling_memory.h"
#ifdef __cplusplus
extern "C" {
#endif
typedef struct FeqLiveNormalizer FeqLiveNormalizer;
typedef struct FeqNormalizerSettings {
  int mode; /* 0 off, 1 true peak, 2 loudness */
  double ceiling_db;
  double target_lufs;
} FeqNormalizerSettings;
typedef struct FeqLiveNormalizerReading {
  double input_true_peak_db;
  double input_lufs;
  double applied_gain_db;
  double reference_lufs;
  int level_state; /* 0 off, 1 peak protection, 2 learning, 3 hold, 4 leveling, 5 limited */
} FeqLiveNormalizerReading;
FeqLiveNormalizer* feq_live_normalizer_create(double rate, uint32_t channels);
void feq_live_normalizer_destroy(FeqLiveNormalizer* state);
void feq_live_normalizer_reset(FeqLiveNormalizer* state);
/* Audio-thread notification when a host flags silence without sample data. */
void feq_live_normalizer_silence(FeqLiveNormalizer* state, uint32_t frames);
/* Before processing, from the thread that owns the chain. Borrowed: the memory
   must outlive every normalizer attached to it. Null detaches. */
void feq_live_normalizer_attach_memory(FeqLiveNormalizer* state, FeqLevelingMemory* memory);
uint32_t feq_live_normalizer_latency(const FeqLiveNormalizer* state);
/* Audio thread only, including the returned reading. No allocation or locks. */
FeqLiveNormalizerReading feq_live_normalizer_process(FeqLiveNormalizer* state,
    float* const* channels, uint32_t frames, const FeqNormalizerSettings* settings);
#ifdef __cplusplus
}
#endif
#endif
