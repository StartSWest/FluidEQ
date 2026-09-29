/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { FilterTypeEnum } from '../../common/constants';
import { TEqModel } from '../../common/dsp/chain';
import modelledQuality from '../../common/dsp/eqModel';
import matchedCoefficients from './biquadMatched';

export interface IBiquadCoefficients {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

export interface IBandSpec {
  type: FilterTypeEnum;
  frequency: number;
  gainDb: number;
  quality: number;
}

/**
 * RBJ's cookbook coefficients — the same shapes Equalizer APO renders.
 *
 * Deliberately the same source APO uses, so a curve dialled here and a curve
 * written into an APO config are the same curve. A "better" formula that
 * disagreed with the other half of the app would be worse.
 *
 * Every one of these is normalised by a0 on the way out, so the caller never
 * has to.
 */
const cookbook = (
  { type, frequency, gainDb, quality }: IBandSpec,
  sampleRate: number,
): IBiquadCoefficients => {
  const amplitude = 10 ** (gainDb / 40);
  // Match the native filter's Nyquist guard: high preset corners must remain
  // stable on lower-rate devices, and this graph must show the applied curve.
  const safeFrequency = Math.min(frequency, sampleRate * 0.499);
  const omega = (2 * Math.PI * safeFrequency) / sampleRate;
  const cosine = Math.cos(omega);
  const sine = Math.sin(omega);
  const alpha = sine / (2 * quality);
  const normalise = (
    b0: number,
    b1: number,
    b2: number,
    a0: number,
    a1: number,
    a2: number,
  ): IBiquadCoefficients => ({
    b0: b0 / a0,
    b1: b1 / a0,
    b2: b2 / a0,
    a1: a1 / a0,
    a2: a2 / a0,
  });

  if (type === FilterTypeEnum.PK) {
    return normalise(
      1 + alpha * amplitude,
      -2 * cosine,
      1 - alpha * amplitude,
      1 + alpha / amplitude,
      -2 * cosine,
      1 - alpha / amplitude,
    );
  }
  if (type === FilterTypeEnum.NO) {
    return normalise(1, -2 * cosine, 1, 1 + alpha, -2 * cosine, 1 - alpha);
  }
  if (type === FilterTypeEnum.LPQ) {
    return normalise(
      (1 - cosine) / 2,
      1 - cosine,
      (1 - cosine) / 2,
      1 + alpha,
      -2 * cosine,
      1 - alpha,
    );
  }
  if (type === FilterTypeEnum.HPQ) {
    return normalise(
      (1 + cosine) / 2,
      -(1 + cosine),
      (1 + cosine) / 2,
      1 + alpha,
      -2 * cosine,
      1 - alpha,
    );
  }
  if (type === FilterTypeEnum.BP) {
    return normalise(alpha, 0, -alpha, 1 + alpha, -2 * cosine, 1 - alpha);
  }
  // Shelves take their own alpha: the cookbook's shelf slope parameter, with
  // S = 1 giving the steepest slope that stays monotonic.
  const beta = 2 * Math.sqrt(amplitude) * alpha;
  if (type === FilterTypeEnum.LSC) {
    return normalise(
      amplitude * (amplitude + 1 - (amplitude - 1) * cosine + beta),
      2 * amplitude * (amplitude - 1 - (amplitude + 1) * cosine),
      amplitude * (amplitude + 1 - (amplitude - 1) * cosine - beta),
      amplitude + 1 + (amplitude - 1) * cosine + beta,
      -2 * (amplitude - 1 + (amplitude + 1) * cosine),
      amplitude + 1 + (amplitude - 1) * cosine - beta,
    );
  }
  return normalise(
    amplitude * (amplitude + 1 + (amplitude - 1) * cosine + beta),
    -2 * amplitude * (amplitude - 1 + (amplitude + 1) * cosine),
    amplitude * (amplitude + 1 + (amplitude - 1) * cosine - beta),
    amplitude + 1 - (amplitude - 1) * cosine + beta,
    2 * (amplitude - 1 - (amplitude + 1) * cosine),
    amplitude + 1 - (amplitude - 1) * cosine - beta,
  );
};

/**
 * Analog matching is a Treble choice here, not a fourth character, and that
 * is worth recording.
 *
 * It was first built as a model and removed: measured at 44.1 kHz, a 16 kHz
 * shelf asked for +6 dB already delivers 5.92 at 20 kHz and a full 6 at
 * Nyquist, so for shelves the correction moved hundredths of a decibel. What
 * the cookbook genuinely squeezes is a bell near Nyquist — a +6 dB, Q 2 bell
 * at 16 kHz on a 48 kHz stream falls 3 dB short — and that is not a colour
 * but the band failing to be what was drawn. So it came back as the main
 * EQ's Precise, and the rack's EQ takes the same choice (`biquadMatched.ts`).
 */

/**
 * A band as the rack builds it: its model's Q (`eqModel.ts`), then
 * analog-matched when `matched` (Treble: Precise) and the shape has a
 * matched design, on the cookbook otherwise.
 */
export const biquadCoefficients = (
  spec: IBandSpec,
  sampleRate: number,
  model: TEqModel = 'clean',
  /** 0 collapses every character to the cookbook, which is the off position. */
  amount = 1,
  matched = false,
): IBiquadCoefficients => {
  const shaped = { ...spec, quality: modelledQuality(spec, model, amount) };
  const plain = cookbook(shaped, sampleRate);
  return matched ? matchedCoefficients(shaped, sampleRate, plain) : plain;
};

/**
 * What the filter actually does at one frequency, in dB.
 *
 * Evaluated from the coefficients rather than from the parameters that made
 * them, which is the entire point: it reports what the filter IS, not what it
 * was asked to be. That difference is measurable near Nyquist and is what the
 * tests use to hold the design honest.
 */
export const biquadMagnitudeDb = (
  { b0, b1, b2, a1, a2 }: IBiquadCoefficients,
  frequency: number,
  sampleRate: number,
): number => {
  const omega = (2 * Math.PI * frequency) / sampleRate;
  const cos1 = Math.cos(omega);
  const sin1 = Math.sin(omega);
  const cos2 = Math.cos(2 * omega);
  const sin2 = Math.sin(2 * omega);
  const numeratorReal = b0 + b1 * cos1 + b2 * cos2;
  const numeratorImaginary = -(b1 * sin1 + b2 * sin2);
  const denominatorReal = 1 + a1 * cos1 + a2 * cos2;
  const denominatorImaginary = -(a1 * sin1 + a2 * sin2);
  const numerator = Math.hypot(numeratorReal, numeratorImaginary);
  const denominator = Math.hypot(denominatorReal, denominatorImaginary);
  if (denominator === 0) {
    return Number.NEGATIVE_INFINITY;
  }
  return 20 * Math.log10(numerator / denominator);
};

export interface IBiquadState {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

export const createBiquadState = (): IBiquadState => ({
  x1: 0,
  x2: 0,
  y1: 0,
  y2: 0,
});

/**
 * Direct Form I, in place.
 *
 * Form I rather than the transposed Form II every textbook reaches for first:
 * at 32-bit float, Form II accumulates its state in a single node whose value
 * can be far larger than either the input or the output, and a high-Q filter
 * low down — a 30Hz notch at Q 8 — is exactly where that node blows up. Form I
 * stores inputs and outputs separately, so nothing in the state ever exceeds
 * the signal itself.
 */
export const processBiquad = (
  state: IBiquadState,
  buffer: Float32Array,
  { b0, b1, b2, a1, a2 }: IBiquadCoefficients,
): void => {
  for (let i = 0; i < buffer.length; i += 1) {
    const x = buffer[i];
    const y =
      b0 * x + b1 * state.x1 + b2 * state.x2 - a1 * state.y1 - a2 * state.y2;
    state.x2 = state.x1;
    state.x1 = x;
    state.y2 = state.y1;
    state.y1 = y;
    buffer[i] = y;
  }
};
