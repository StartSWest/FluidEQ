/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fftInPlace from '../../common/dsp/fft';

/**
 * Uniformly partitioned overlap-add convolution, for the linear-phase kernel.
 *
 * Direct convolution is not an option: 16384 taps times 48000 samples times two
 * channels is 1.6 billion multiply-accumulates a second, which JavaScript will
 * not do. One transform of the whole kernel is not an option either, for a
 * subtler reason — the cost would be right on average and catastrophic in
 * distribution, because a single 32768-point FFT lands inside one 128-sample
 * callback that has 2.7 ms to finish, and the callbacks either side of it have
 * nothing to do. An audio thread is judged on its worst block, never its mean.
 *
 * Partitioning fixes the distribution. The kernel is cut into blocks of
 * `PARTITION` samples, each transformed once when the kernel arrives; the input
 * is transformed once per `PARTITION` samples and kept in a ring, and the
 * output is the sum of each stored input spectrum against the matching kernel
 * partition. Every block does the same work as every other.
 */

/**
 * 512 samples per partition, and the number is a balance rather than a taste.
 *
 * Larger partitions mean fewer, bigger transforms — cheaper in total, but more
 * added delay and a lumpier profile. Smaller ones mean the transform count
 * rises until the multiply-accumulate across partitions dominates. At 512 the
 * kernel is 32 partitions of a 1024-point transform, which is about 120,000
 * flops per 512 samples per channel — roughly 230 per sample, comfortably
 * inside the budget with the whole rest of the chain still to run.
 */
const PARTITION = 512;

/** Every transform here is a partition and its zero padding. */
const FFT_SIZE = PARTITION * 2;

/**
 * A kernel already in the frequency domain, ready for any number of channels.
 *
 * Split from the convolver itself so the transforms happen where there is time
 * for them. Preparing a 16384-tap kernel is 32 forward FFTs — a third of a
 * millisecond — which is nothing inside a frame and most of a 2.7 ms callback
 * on the audio thread, where it would land on every pixel of a drag. The
 * renderer prepares; the worklet only allocates its own ring.
 */
export interface IConvolverKernel {
  readonly real: Float64Array[];
  readonly imaginary: Float64Array[];
}

export interface IConvolverState {
  readonly kernel: IConvolverKernel;
  /** The last `kernel.real.length` input spectra, newest at `cursor`. */
  readonly historyReal: Float64Array[];
  readonly historyImaginary: Float64Array[];
  cursor: number;
  /** Input accumulator: a transform happens when this fills. */
  readonly pending: Float64Array;
  filled: number;
  /** The tail of the last transform, added into the next block's head. */
  readonly overlap: Float64Array;
  /** Output waiting to be drained, as a ring. */
  readonly ready: Float64Array;
  read: number;
  write: number;
  /** Scratch for the transform, so no block allocates. */
  readonly workReal: Float64Array;
  readonly workImaginary: Float64Array;
  readonly accumulatorReal: Float64Array;
  readonly accumulatorImaginary: Float64Array;
}

/** How many samples of delay the buffering itself adds, on top of the kernel's
 * own half-length. Reported rather than assumed: the transport has to know. */
export const CONVOLVER_LATENCY = PARTITION;

/** Transform a kernel into partitions. Renderer-side; never on a callback. */
export const prepareKernel = (kernel: Float32Array): IConvolverKernel => {
  const partitions = Math.ceil(kernel.length / PARTITION);
  const real: Float64Array[] = [];
  const imaginary: Float64Array[] = [];
  for (let index = 0; index < partitions; index += 1) {
    const partReal = new Float64Array(FFT_SIZE);
    const partImaginary = new Float64Array(FFT_SIZE);
    const from = index * PARTITION;
    const count = Math.min(PARTITION, kernel.length - from);
    for (let i = 0; i < count; i += 1) {
      partReal[i] = kernel[from + i];
    }
    fftInPlace(partReal, partImaginary, false);
    real.push(partReal);
    imaginary.push(partImaginary);
  }
  return { real, imaginary };
};

/**
 * Prepare a convolver for one channel against one prepared kernel.
 *
 * Allocates, so it is called when a kernel changes and never inside a block —
 * allocation on an audio thread is a garbage collection waiting to happen in
 * the middle of a callback.
 */
export const createConvolver = (kernel: IConvolverKernel): IConvolverState => {
  const partitions = kernel.real.length;
  const historyReal: Float64Array[] = [];
  const historyImaginary: Float64Array[] = [];
  for (let index = 0; index < partitions; index += 1) {
    historyReal.push(new Float64Array(FFT_SIZE));
    historyImaginary.push(new Float64Array(FFT_SIZE));
  }
  return {
    kernel,
    historyReal,
    historyImaginary,
    cursor: 0,
    pending: new Float64Array(PARTITION),
    filled: 0,
    overlap: new Float64Array(PARTITION),
    // Two partitions plus a block, so a drain can never outrun a fill even
    // when the host hands over an unusual quantum.
    ready: new Float64Array(PARTITION * 3),
    read: 0,
    // Primed with a partition of silence. That priming IS the buffering delay:
    // without it the first blocks would read samples that have not been
    // computed yet, and there is nothing sensible to hand back at that point.
    write: PARTITION,
    workReal: new Float64Array(FFT_SIZE),
    workImaginary: new Float64Array(FFT_SIZE),
    accumulatorReal: new Float64Array(FFT_SIZE),
    accumulatorImaginary: new Float64Array(FFT_SIZE),
  };
};

/** One partition's worth of input, transformed, summed and queued. */
const flush = (state: IConvolverState): void => {
  const {
    workReal,
    workImaginary,
    accumulatorReal,
    accumulatorImaginary,
    kernel,
    historyReal,
    historyImaginary,
    ready,
    overlap,
  } = state;
  const partitions = kernel.real.length;

  workReal.set(state.pending);
  workReal.fill(0, PARTITION);
  workImaginary.fill(0);
  fftInPlace(workReal, workImaginary, false);

  state.cursor = (state.cursor + 1) % partitions;
  historyReal[state.cursor].set(workReal);
  historyImaginary[state.cursor].set(workImaginary);

  accumulatorReal.fill(0);
  accumulatorImaginary.fill(0);
  for (let index = 0; index < partitions; index += 1) {
    // Oldest kernel partition against the oldest input spectrum: walking the
    // ring backwards from the newest is what lines the two up in time.
    const at = (state.cursor - index + partitions * 2) % partitions;
    const xr = historyReal[at];
    const xi = historyImaginary[at];
    const hr = kernel.real[index];
    const hi = kernel.imaginary[index];
    for (let bin = 0; bin < FFT_SIZE; bin += 1) {
      accumulatorReal[bin] += xr[bin] * hr[bin] - xi[bin] * hi[bin];
      accumulatorImaginary[bin] += xr[bin] * hi[bin] + xi[bin] * hr[bin];
    }
  }

  fftInPlace(accumulatorReal, accumulatorImaginary, true);

  for (let i = 0; i < PARTITION; i += 1) {
    ready[state.write] = accumulatorReal[i] / FFT_SIZE + overlap[i];
    state.write = (state.write + 1) % ready.length;
    overlap[i] = accumulatorReal[PARTITION + i] / FFT_SIZE;
  }
  state.filled = 0;
};

/**
 * Filter `buffer` in place. Same number of samples out as in, always.
 *
 * The delay is constant and is `CONVOLVER_LATENCY` plus half the kernel — not
 * something that varies with block size, which is what lets the two channels
 * stay sample-aligned without either of them knowing about the other.
 */
export const convolve = (
  state: IConvolverState,
  buffer: Float32Array,
): void => {
  for (let i = 0; i < buffer.length; i += 1) {
    state.pending[state.filled] = buffer[i];
    state.filled += 1;
    if (state.filled === PARTITION) {
      flush(state);
    }
    buffer[i] = state.ready[state.read];
    state.read = (state.read + 1) % state.ready.length;
  }
};
