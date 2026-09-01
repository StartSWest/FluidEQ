/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { TOversampleFactor } from './oversample';

/**
 * Oversampling factor. Four is what ITU-R BS.1770 specifies for a 48kHz
 * signal, and what every meter calling itself "true peak" uses.
 */
export const TRUE_PEAK_FACTOR = 4;

/** Taps per polyphase branch. 12 puts the estimate within ~0.1 dB. */
const TAPS = 12;

/** Half the filter's span, in input samples: the delay it introduces. */
const HALF = TAPS / 2;

/**
 * A windowed-sinc interpolator, one phase per fractional offset.
 *
 * The branch for offset 0 is the identity — sinc(0) is 1 and every other tap
 * is zero — so the original samples pass through untouched and only the three
 * points BETWEEN them are estimated. That is the whole job: a signal can sit
 * at -1 dBFS in its samples and still reconstruct above 0 between them, and
 * the reconstruction is what a converter, a resampler and every streaming
 * service's meter actually see.
 */
const buildPhases = (): Float64Array[] => {
  const phases: Float64Array[] = [];
  for (let phase = 0; phase < TRUE_PEAK_FACTOR; phase += 1) {
    const offset = phase / TRUE_PEAK_FACTOR;
    const taps = new Float64Array(TAPS);
    let sum = 0;
    for (let i = 0; i < TAPS; i += 1) {
      const x = i - HALF + 1 - offset;
      // sinc, with the removable singularity at zero written out rather than
      // left to 0/0.
      const sinc = x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
      // Blackman, for a stopband deep enough that the window is not what
      // limits the estimate.
      const t = i / (TAPS - 1);
      const window =
        0.42 -
        0.5 * Math.cos(2 * Math.PI * t) +
        0.08 * Math.cos(4 * Math.PI * t);
      taps[i] = sinc * window;
      sum += taps[i];
    }
    // Normalised so a constant signal interpolates to itself. Without this the
    // window's own gain shows up as a level error in every reading.
    for (let i = 0; i < TAPS; i += 1) {
      taps[i] /= sum;
    }
    phases.push(taps);
  }
  return phases;
};

const PHASES = buildPhases();

export interface ITruePeakState {
  /** Session-aware interpolation density: 4x, 2x, or sample peak at 1x. */
  factor: TOversampleFactor;
  /** Circular history; `position` points to the oldest/next write slot. */
  history: Float64Array;
  position: number;
}

export const createTruePeakState = (
  factor: TOversampleFactor = TRUE_PEAK_FACTOR,
): ITruePeakState => ({
  factor,
  history: new Float64Array(TAPS),
  position: 0,
});

/**
 * Advance by one sample and report the largest magnitude around it.
 *
 * The per-sample primitive, because a limiter needs a magnitude per sample to
 * feed its sliding-window maximum — a peak per block would tell it a whole
 * block is loud when one sample is.
 *
 * The value returned lags its input by `HALF` samples: it describes the signal
 * in the middle of the filter's window, not at its newest end. That is fine
 * for a limiter and not an accident — its look-ahead is hundreds of samples,
 * so the reading still arrives long before the audio it describes.
 */
export const truePeakOfSample = (
  state: ITruePeakState,
  sample: number,
): number => {
  if (state.factor === 1) {
    return Math.abs(sample);
  }
  const { history } = state;
  history[state.position] = sample;
  state.position = state.position + 1 === TAPS ? 0 : state.position + 1;
  let peak = 0;
  const phaseStep = TRUE_PEAK_FACTOR / state.factor;
  for (let phase = 0; phase < TRUE_PEAK_FACTOR; phase += phaseStep) {
    const taps = PHASES[phase];
    let sum = 0;
    let tap = 0;
    for (let read = state.position; read < TAPS; read += 1) {
      sum += history[read] * taps[tap];
      tap += 1;
    }
    for (let read = 0; tap < TAPS; read += 1) {
      sum += history[read] * taps[tap];
      tap += 1;
    }
    const magnitude = Math.abs(sum);
    if (magnitude > peak) {
      peak = magnitude;
    }
  }
  return peak;
};

/**
 * The largest magnitude the signal reaches, samples and the gaps between them.
 *
 * Returns the peak over `input` INCLUDING the interpolated points, which is
 * what "true peak" means. Never smaller than the plain sample peak, because
 * phase 0 is the identity branch.
 *
 * The state carries the filter's history across blocks so a peak straddling a
 * block boundary is not missed — the reason this takes state at all rather
 * than being a pure function of one buffer.
 */
export const truePeak = (
  state: ITruePeakState,
  input: Float32Array,
): number => {
  let peak = 0;
  for (let i = 0; i < input.length; i += 1) {
    const magnitude = truePeakOfSample(state, input[i]);
    if (magnitude > peak) {
      peak = magnitude;
    }
  }
  return peak;
};
