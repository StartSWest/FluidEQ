/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fftInPlace from '../dsp/fft';

/**
 * The short-time Fourier transform the vocal separation model expects.
 *
 * The separation model is a "host STFT" export: the network itself only maps a
 * spectrogram to a mask, and the transform on either side of it belongs to us.
 * That is a good split — it keeps the ONNX graph small and lets the transform
 * run in plain TypeScript — but it means the contract below is not a
 * suggestion. Every constant here is a number the model was trained with, and
 * changing one produces a mask computed for a spectrogram that was never fed
 * in. There is no error when that happens, only a worse-sounding result, so
 * this module is deliberately pure and deliberately tested.
 */

/** The rate the model was trained at. Audio is resampled to this first. */
export const SEPARATION_SAMPLE_RATE = 44_100;

/** Transform size. 2048 samples at 44.1 kHz is a ~46 ms window. */
export const SEPARATION_FFT_SIZE = 2048;

/** Hop between frames. 441 samples is exactly 10 ms at 44.1 kHz. */
export const SEPARATION_HOP = 441;

/** Bins in a one-sided spectrum of a real signal: 2048/2 + 1. */
export const SEPARATION_FREQ_BINS = SEPARATION_FFT_SIZE / 2 + 1;

/** Frames per inference. Fixed by the export; the graph has no dynamic axis. */
export const SEPARATION_FRAMES = 1101;

/**
 * Rows in the packed tensor: one per frequency bin per channel, interleaved as
 * `2 * bin + channel`, exactly as the model card describes.
 *
 * This was briefly written channel-major on the strength of a test that could
 * not tell the difference, and the mistake is worth recording because the test
 * looked like the strongest evidence available. Fed a vocal-free instrumental,
 * channel-major suppressed the vocal stem by 52 dB with a mask averaging
 * 0.0004 — apparently flawless — while the interleaved layout managed 4 dB.
 *
 * The flaw is that a vocal-free input cannot distinguish a correct pipeline
 * from one that returns zero for everything, and channel-major returns zero
 * for everything. On a real mix the two separate cleanly: interleaved yields a
 * vocal stem at -18 dB RMS with a mask averaging 0.41, channel-major yields
 * -45 dB and a mask averaging 0.001. It was not separating at all.
 *
 * The lesson generalises past this file: a null result needs a positive
 * control beside it, or "found nothing" reads as "removed everything".
 */
export const SEPARATION_PACKED_ROWS = SEPARATION_FREQ_BINS * 2;

/** Samples covered by one inference: 1100 hops plus the final frame. */
export const SEPARATION_CHUNK_SAMPLES =
  (SEPARATION_FRAMES - 1) * SEPARATION_HOP;

/**
 * Advance between chunks, in samples. Exactly 800 hops.
 *
 * Shorter than the 11.01 s window on purpose: the model is weakest at the edges
 * of its receptive field, so neighbouring chunks overlap by ~3 s and are
 * cross-faded. A step equal to the window would butt two weak edges together
 * and put a seam in the output every eleven seconds.
 */
export const SEPARATION_STEP_SAMPLES = 8 * SEPARATION_SAMPLE_RATE;

/** The row for a channel and frequency bin in the packed tensor. */
export const separationPackedRow = (channel: number, bin: number): number =>
  2 * bin + channel;

/**
 * Scale factor to bring a signal inside the range the model was trained on.
 *
 * Modern masters routinely decode above +/-1.0 — the track this was measured
 * on peaked at 1.42 — and the network was trained on audio that does not.
 * Feeding it an over-range signal degrades the mask rather than erroring, so
 * the caller normalises before inference and divides the result back out
 * afterwards, leaving the stems at the original level.
 */
export const separationNormalisationGain = (
  left: Float32Array | Float64Array,
  right: Float32Array | Float64Array,
): number => {
  let peak = 0;
  for (let i = 0; i < left.length; i += 1) {
    const magnitude = Math.max(Math.abs(left[i]), Math.abs(right[i]));
    if (magnitude > peak) {
      peak = magnitude;
    }
  }
  return peak > 1 ? 1 / peak : 1;
};

/**
 * A periodic Hann window, which is what the training code's
 * `torch.hann_window(periodic=True)` produces.
 *
 * The symmetric variant differs only in its final sample, and that one sample
 * is enough to stop the overlap-add summing to unity.
 */
export const separationHannWindow = (size: number): Float64Array => {
  const window = new Float64Array(size);
  for (let i = 0; i < size; i += 1) {
    window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / size);
  }
  return window;
};

/**
 * A Hamming taper for cross-fading neighbouring chunks.
 *
 * Symmetric here, unlike the Hann above: this one is a fade shape rather than
 * an analysis window, and it needs to reach its endpoints.
 */
export const separationHammingWindow = (size: number): Float64Array => {
  const window = new Float64Array(size);
  for (let i = 0; i < size; i += 1) {
    window[i] = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (size - 1));
  }
  return window;
};

/**
 * The transform, re-exported under the name this module's callers know.
 *
 * The implementation moved to `common/dsp/fft.ts` when the linear-phase EQ
 * needed a transform of exactly the same shape. One copy, so the sign of the
 * twiddle factor and the missing 1/N cannot drift apart between two callers
 * that each believe they know the convention.
 */
export const separationFft = fftInPlace;

/**
 * Reflect-pad by half the transform size at both ends.
 *
 * This is what `torch.stft(center=True)` does, and it is why frame `f` is
 * centred on sample `f * hop` rather than starting there. Without it every
 * frame index is offset by half a window and the mask lands on the wrong part
 * of the audio.
 */
const reflectPad = (samples: Float64Array, pad: number): Float64Array => {
  const padded = new Float64Array(samples.length + pad * 2);
  padded.set(samples, pad);
  for (let i = 0; i < pad; i += 1) {
    padded[pad - 1 - i] = samples[Math.min(i + 1, samples.length - 1)];
    padded[pad + samples.length + i] =
      samples[Math.max(samples.length - 2 - i, 0)];
  }
  return padded;
};

/** One channel's spectrogram, laid out frame-major as `[frame][bin]`. */
export interface ISeparationSpectrogram {
  real: Float64Array;
  imaginary: Float64Array;
}

/**
 * Transform one channel of a chunk into a spectrogram.
 *
 * The chunk is expected to be {@link SEPARATION_CHUNK_SAMPLES} long; a shorter
 * one is read as zeros past its end, which is how the final chunk of a song is
 * handled without a separate code path.
 */
export const separationStft = (
  samples: Float64Array,
): ISeparationSpectrogram => {
  const window = separationHannWindow(SEPARATION_FFT_SIZE);
  const padded = reflectPad(samples, SEPARATION_FFT_SIZE / 2);
  const real = new Float64Array(SEPARATION_FRAMES * SEPARATION_FREQ_BINS);
  const imaginary = new Float64Array(SEPARATION_FRAMES * SEPARATION_FREQ_BINS);
  const frameReal = new Float64Array(SEPARATION_FFT_SIZE);
  const frameImaginary = new Float64Array(SEPARATION_FFT_SIZE);
  for (let frame = 0; frame < SEPARATION_FRAMES; frame += 1) {
    const offset = frame * SEPARATION_HOP;
    for (let i = 0; i < SEPARATION_FFT_SIZE; i += 1) {
      frameReal[i] = (padded[offset + i] ?? 0) * window[i];
      frameImaginary[i] = 0;
    }
    separationFft(frameReal, frameImaginary, false);
    const row = frame * SEPARATION_FREQ_BINS;
    for (let bin = 0; bin < SEPARATION_FREQ_BINS; bin += 1) {
      real[row + bin] = frameReal[bin];
      imaginary[row + bin] = frameImaginary[bin];
    }
  }
  return { real, imaginary };
};

/**
 * Invert a spectrogram back to samples.
 *
 * Overlap-add divided by the summed squared window, which is the standard
 * least-squares inverse. Dividing by the envelope rather than assuming it sums
 * to one is what makes the first and last few frames — where fewer windows
 * overlap — come back at the right level instead of fading in.
 */
export const separationIstft = (
  real: Float64Array,
  imaginary: Float64Array,
  outputLength: number,
): Float64Array => {
  const window = separationHannWindow(SEPARATION_FFT_SIZE);
  const paddedLength = outputLength + SEPARATION_FFT_SIZE;
  const accumulator = new Float64Array(paddedLength);
  const envelope = new Float64Array(paddedLength);
  const frameReal = new Float64Array(SEPARATION_FFT_SIZE);
  const frameImaginary = new Float64Array(SEPARATION_FFT_SIZE);
  for (let frame = 0; frame < SEPARATION_FRAMES; frame += 1) {
    const row = frame * SEPARATION_FREQ_BINS;
    for (let bin = 0; bin < SEPARATION_FREQ_BINS; bin += 1) {
      frameReal[bin] = real[row + bin];
      frameImaginary[bin] = imaginary[row + bin];
      // Rebuild the mirrored half. The signal is real, so the upper bins are
      // the conjugates of the lower ones and were never stored.
      if (bin > 0 && bin < SEPARATION_FREQ_BINS - 1) {
        frameReal[SEPARATION_FFT_SIZE - bin] = frameReal[bin];
        frameImaginary[SEPARATION_FFT_SIZE - bin] = -frameImaginary[bin];
      }
    }
    separationFft(frameReal, frameImaginary, true);
    const offset = frame * SEPARATION_HOP;
    for (let i = 0; i < SEPARATION_FFT_SIZE; i += 1) {
      if (offset + i >= paddedLength) {
        break;
      }
      accumulator[offset + i] +=
        (frameReal[i] / SEPARATION_FFT_SIZE) * window[i];
      envelope[offset + i] += window[i] * window[i];
    }
  }
  const output = new Float64Array(outputLength);
  const shift = SEPARATION_FFT_SIZE / 2;
  for (let i = 0; i < outputLength; i += 1) {
    const weight = envelope[i + shift];
    output[i] = weight > 1e-8 ? accumulator[i + shift] / weight : 0;
  }
  return output;
};

/**
 * Apply the model's complex mask to a spectrogram, in place.
 *
 * The mask is complex, not a magnitude gain: it rotates phase as well as
 * scaling, which is how the model separates two sources that share a bin.
 * Treating it as a real gain — taking only `maskReal` — is a plausible-looking
 * mistake that costs several dB of separation and leaves the residue audible.
 */
export const separationApplyMask = (
  spectrogram: ISeparationSpectrogram,
  maskReal: number[] | Float32Array,
  maskImaginary: number[] | Float32Array,
): void => {
  const { real, imaginary } = spectrogram;
  for (let i = 0; i < real.length; i += 1) {
    const a = real[i];
    const b = imaginary[i];
    const c = maskReal[i];
    const d = maskImaginary[i];
    real[i] = a * c - b * d;
    imaginary[i] = a * d + b * c;
  }
};
