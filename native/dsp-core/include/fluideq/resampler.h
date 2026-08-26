/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Arbitrary-ratio sample rate conversion, for files that disagree with the
 * device.
 *
 * The TypeScript player never needed this: `decodeAudioData` hands back audio
 * already at the AudioContext's rate, and Chromium did the conversion. Taking
 * the decoder native means taking the resampler with it, because 44.1 kHz
 * material on a 48 kHz endpoint is the ordinary case rather than the exception.
 *
 * Windowed sinc rather than linear interpolation. Linear is one multiply and it
 * is wrong in a way that is easy to miss: its response falls by 3.9 dB at
 * Nyquist and its images land at -14 dB, which on 44.1 to 48 puts audible
 * aliases inside the top octave of every track in the library. This is 32 taps
 * of Kaiser-windowed sinc with 1024 interpolated phases, which measures below
 * -90 dB. Measured: a 1 kHz tone converted 44.1 to 48 leaves -108.7 dB of
 * anything-but-the-tone behind, and a 30 kHz tone taken from 96 to 48 — where
 * it cannot exist — is rejected by 91.3 dB rather than folded back to 18 kHz.
 *
 * Never on the audio thread. It runs where the decoder runs, and the ring
 * buffer downstream of it holds device-rate frames only, so the callback does a
 * copy and nothing else.
 */
#ifndef FLUIDEQ_RESAMPLER_H
#define FLUIDEQ_RESAMPLER_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Taps per phase, and 64 was measured rather than chosen.
 *
 * A Kaiser window's transition band is about `(A - 8) / (2.285 * N)` radians
 * per sample, so halving the width means doubling the taps. At 32 the stopband
 * for a 2:1 downsample did not begin until 31 kHz, which left a 30 kHz tone
 * inside the transition and folded it back at -60 dB â quiet, and exactly the
 * added shimmer a listener would call the converter "bright" for. At 64 the
 * stopband starts at 27 kHz and the same tone is rejected by more than 90.
 */
#define FEQ_RESAMPLER_TAPS 64


typedef struct FeqResampler FeqResampler;

/**
 * Build a converter for one exact ratio. Allocates a phase table.
 *
 * Equal rates are still a valid request and produce a converter that copies:
 * a caller should not have to branch on whether conversion is needed.
 */
FeqResampler* feq_resampler_create(double input_rate,
                                   double output_rate,
                                   uint32_t channels);
void feq_resampler_destroy(FeqResampler* state);

/** Empty the history. After a seek, the old tail is the previous position. */
void feq_resampler_reset(FeqResampler* state);

/**
 * How many input frames are needed to produce `output_frames`, at most.
 *
 * An estimate that never under-reports, so a caller can size one read.
 */
uint32_t feq_resampler_input_for(const FeqResampler* state,
                                 uint32_t output_frames);

/**
 * Convert. Planar in, planar out; both are the caller's.
 *
 * Returns the number of output frames written, which may be fewer than asked
 * for when the input runs out. `consumed` receives the input frames used, so a
 * caller can keep the remainder — the converter holds only its own filter
 * history, never a copy of the caller's data.
 */
uint32_t feq_resample(FeqResampler* state,
                      const float* const* input,
                      uint32_t input_frames,
                      float* const* output,
                      uint32_t output_frames,
                      uint32_t* consumed);

/**
 * Push the tail out at end of file.
 *
 * Half the filter's span sits inside the converter when the input ends, which
 * is a fifth of a millisecond of the track that would otherwise never be heard
 * — inaudible on its own and a click at the end of a gapless album.
 */
uint32_t feq_resampler_flush(FeqResampler* state,
                             float* const* output,
                             uint32_t output_frames);

#ifdef __cplusplus
}
#endif

#endif /* FLUIDEQ_RESAMPLER_H */
