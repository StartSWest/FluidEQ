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
 */
int feq_convolver_transfer(FeqConvolver* state, const FeqConvolver* previous,
                           uint32_t transition_frames);

/**
 * Cross-fade from one kernel to another while both run.
 *
 * Swapping a convolver outright would step the impulse response mid-tail,
 * which is heard as a click on every curve change. Both are run over the same
 * block and blended sample by sample; `blend` is carried across blocks and the
 * new value is returned.
 */
double feq_convolve_blend(FeqConvolver* active,
                          FeqConvolver* next,
                          float* buffer,
                          float* scratch,
                          uint32_t frames,
                          double blend,
                          double step);

#ifdef __cplusplus
}
#endif

#endif /* FLUIDEQ_CONVOLVER_H */
