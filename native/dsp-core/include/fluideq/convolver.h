/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Uniformly partitioned overlap-add convolution, ported from `convolver.ts`
 * and `fft.ts`.
 *
 * A 16k linear-phase kernel convolved directly would be sixteen thousand
 * multiplies per sample. Partitioned into 512-sample blocks and multiplied in
 * the frequency domain it is a few transforms per partition boundary, which is
 * the difference between a feature and a dropout.
 *
 * The partition size IS the latency. `feq_convolver_latency()` reports it and
 * the chain compensates the dry path by exactly that much.
 */
#ifndef FLUIDEQ_CONVOLVER_H
#define FLUIDEQ_CONVOLVER_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct FeqConvolverKernel FeqConvolverKernel;
typedef struct FeqConvolver FeqConvolver;

/**
 * Radix-2, in place, over `size` samples. `size` MUST be a power of two.
 *
 * A size that is not one is refused and the buffers left untouched, rather
 * than read past their end — which is what this used to do, sixty-four doubles
 * beyond a 960-point call, silently, until an unrelated allocation died of it.
 * Use `FeqDft` when the size is not a power of two.
 */
void feq_fft_in_place(double* real,
                      double* imaginary,
                      uint32_t size,
                      int inverse);

typedef struct FeqDft FeqDft;

/**
 * A transform of ANY size, built on the one above by Bluestein's algorithm.
 *
 * Needed because a model dictates its own window: DPDFNet runs at 960 samples
 * and wants exactly 481 bins, and no amount of zero-padding produces those
 * bins. Costs two power-of-two transforms of the first size at or above 2N-1
 * per call, plus a kernel built once at create.
 *
 * `feq_dft_in_place` allocates nothing and is safe on a worker thread, but a
 * plan carries its own scratch and so belongs to one thread at a time.
 * `inverse` is unnormalised, matching `feq_fft_in_place`: the caller divides.
 */
FeqDft* feq_dft_create(uint32_t size);
void feq_dft_destroy(FeqDft* plan);
void feq_dft_in_place(FeqDft* plan,
                      double* real,
                      double* imaginary,
                      int inverse);

uint32_t feq_convolver_latency(void);
/** Audio owner only: clear delayed samples without reallocating or changing kernels. */
void feq_convolver_reset(FeqConvolver* state);
uint32_t feq_convolver_warmup(void);
uint64_t feq_convolver_kernel_warmup(const FeqConvolverKernel* kernel);

/**
 * A KERNEL'S FIRST PARTITION, RUN DIRECTLY: convolution with no latency.
 *
 * The partitioned convolver hands everything back one partition late. Run
 * the first partition as a plain FIR instead, and give the convolver the rest
 * of the kernel starting one partition in (`kernel + feq_convolver_head_taps()`):
 * its own partition of delay then puts that tail exactly where it belongs
 * behind the head, and the sum is the whole convolution arriving on time.
 * Game mode's room and headphone curve are built this way.
 *
 * It costs what a direct FIR costs — `feq_convolver_head_taps()` multiplies a
 * sample per kernel — which is why it is not how every convolution runs.
 *
 * `head` holds the taps reversed, as `feq_convolver_head_prepare` writes
 * them; `input` holds `feq_convolver_head_taps() - 1` samples of history and
 * then the block, so the first output reaches back across the boundary.
 */
uint32_t feq_convolver_head_taps(void);
void feq_convolver_head_prepare(const float* kernel, uint32_t length,
                                float* head);
void feq_convolver_head_run(const float* head, const float* input,
                            float* out, uint32_t frames);

/**
 * Transform a kernel into partitioned spectra. Allocates; never on the audio
 * thread. The returned kernel may be shared by several convolvers.
 */
FeqConvolverKernel* feq_convolver_kernel_create(const float* kernel,
                                                uint32_t length);
void feq_convolver_kernel_destroy(FeqConvolverKernel* kernel);

/** Allocates its histories from the kernel's partition count. */
FeqConvolver* feq_convolver_create(const FeqConvolverKernel* kernel);
void feq_convolver_destroy(FeqConvolver* state);

/** Real-time safe: every buffer it touches was allocated by `create`. */
void feq_convolve(FeqConvolver* state, float* buffer, uint32_t frames);
/**
 * Copies input history and queued output into preallocated equal-size storage.
 * A cold 4097-tap graphic FIR muted the next 53 ms on every smoothing edit.
 * Both kernels now share that input history and crossfade sample by sample;
 * an interrupted fade starts from its current response. No previous pointer
 * survives this call, so retiring the previous graph cannot free live state.
 * Refused for a convolver carrying changes: the fade covers the main output
 * alone, and a change left on its old response would outlive it.
 */
int feq_convolver_transfer(FeqConvolver* state, const FeqConvolver* previous,
                           uint32_t transition_frames);

/**
 * Cross-fade from one kernel to another while both run.
 *
 * Swapping a convolver outright would step the impulse response mid-tail,
 * which is heard as a click on every curve change. Both are run over the same
 * block and blended sample by sample; `blend` is carried across blocks and the
 * new value is returned. `difference`, when not null, receives the next
 * kernel's output less the active one's, sample by sample: whatever runs after
 * the fade and belongs to one kernel's share alone needs that share back.
 */
double feq_convolve_blend(FeqConvolver* active,
                          FeqConvolver* next,
                          float* buffer,
                          float* scratch,
                          uint32_t frames,
                          double blend,
                          double step,
                          float* difference);

/**
 * A CHANGE: a second, sparse kernel that reads its kernel's input history.
 *
 * A linear-phase equaliser is one fixed kernel, and a dynamic band is not
 * fixed — it adds its change only while its passband is loud. What the band
 * changes at full strength IS fixed, though: a narrow kernel centred where
 * the main one is, so its output lands on the same sample as the main
 * output. Scaled by the band's moment-to-moment amount, that output is the
 * dynamic band in linear phase.
 *
 * Only the partitions that carry the change are kept — a narrow band's is a
 * few milliseconds either side of the centre, not the kernel's whole length
 * — and they multiply the input spectra the main kernel already transformed,
 * so a change costs a multiply-add per kept partition and one inverse
 * transform per partition of audio, never a second input history.
 *
 * Attached before any convolver is created from the kernel, because a
 * convolver sizes its outputs from the kernel it is given. `taps` is laid out
 * like the main kernel's and no longer than it. Allocates; never on the audio
 * thread. Returns the change's index, which is how it is read back, or -1
 * when it could not be made.
 */
int feq_convolver_kernel_add_change(FeqConvolverKernel* kernel,
                                    const float* taps,
                                    uint32_t length);

/**
 * What one change produced for the samples `feq_convolve` last returned.
 *
 * The last `frames` of them, which may be no more than
 * `feq_convolver_latency()`: the output ring keeps that much behind its read
 * head whatever the host's block size, and not much more.
 */
void feq_convolver_read_change(const FeqConvolver* state,
                               uint32_t change,
                               float* out,
                               uint32_t frames);

#ifdef __cplusplus
}
#endif

#endif /* FLUIDEQ_CONVOLVER_H */
