/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { FilterTypeEnum, NO_GAIN_FILTER_TYPES } from '../../common/constants';
import { TEqModel } from '../../common/dsp/chain';

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
  const omega = (2 * Math.PI * frequency) / sampleRate;
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
 * How much the Q tightens as a band is driven harder.
 *
 * At full boost the band ends up about twice as narrow as its dial says. That
 * is the behaviour of the classic wide-and-punchy console equalisers: a small
 * move is broad and gentle, a large one focuses on the frequency it was aimed
 * at instead of dragging its neighbours with it. It is the same curve at 1 dB
 * and a different instrument at 12.
 */
const proportionalQuality = ({ gainDb, quality }: IBandSpec): number =>
  Math.min(18, quality * (1 + (Math.abs(gainDb) / 24) * 1.6));

/**
 * Broad and overlapping, the way a passive tone stack behaves.
 *
 * The opposite character to proportional: instead of focusing as it is driven,
 * a band here always reaches well past its own centre, so neighbouring bands
 * blend into one another and the result is a tilt rather than a set of bumps.
 * It is the gentler, rounder sound, and it is the one that flatters a whole
 * mix where a narrow band would sound like a repair.
 *
 * Shelves get it worse than bells on purpose: a shallow shelf is most of what
 * makes that style of equaliser sound like itself.
 */
const wideQuality = ({ type, quality }: IBandSpec): number => {
  const isShelf = type === FilterTypeEnum.LSC || type === FilterTypeEnum.HSC;
  return Math.max(0.25, quality * (isShelf ? 0.4 : 0.45));
};

/**
 * A fourth model was built here and removed, which is worth recording.
 *
 * "Analog matched" was to undo the bilinear transform's cramping near Nyquist.
 * Measured at 44.1 kHz, a 16 kHz shelf asked for +6 dB already delivers 5.92 at
 * 20 kHz and a full 6 at Nyquist, so the correction moved it by hundredths of a
 * decibel. The roadmap's claim that it "delivers 3-6 dB" was reading the
 * shelf's own corner — half gain at the corner is what a shelf IS — as a
 * shortfall. What the cookbook genuinely does squeeze is a bell's upper skirt
 * near Nyquist, and that is a refinement rather than a character.
 */

export const biquadCoefficients = (
  spec: IBandSpec,
  sampleRate: number,
  model: TEqModel = 'clean',
): IBiquadCoefficients => {
  if (
    model === 'clean' ||
    spec.gainDb === 0 ||
    NO_GAIN_FILTER_TYPES.includes(spec.type as never)
  ) {
    // Nothing to model when there is no gain to shape: every design collapses
    // to the same filter, and a notch has no gain to correct in the first
    // place.
    return cookbook(spec, sampleRate);
  }
  if (model === 'proportional') {
    return cookbook(
      { ...spec, quality: proportionalQuality(spec) },
      sampleRate,
    );
  }
  return cookbook({ ...spec, quality: wideQuality(spec) }, sampleRate);
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
