/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { FilterTypeEnum, IFilter } from './constants';

/**
 * Biquad magnitude response, shared by the graph and the config writer.
 *
 * It lives in common/ rather than beside the chart because both the picture
 * and the file have to agree about how loud a chain is. When the graph owned
 * this alone, the headroom it reserved was only applied if the graph happened
 * to be mounted — so switching to another tab and changing a layer left the
 * preamp describing a chain that no longer existed.
 */

const SAMPLE_FREQUENCY = 96000;
const NUM_STEPS = 1000;
export const RESPONSE_START = 10;
export const RESPONSE_END = 20000;

const logStart = Math.log10(RESPONSE_START);
const logEnd = Math.log10(RESPONSE_END);
const step = (logEnd - logStart) / NUM_STEPS;

/** Log-spaced probe frequencies, the same grid the response graph draws on. */
export const SAMPLE_FREQUENCIES: number[] = Array.from(
  { length: NUM_STEPS + 1 },
  (_value, index) => 10 ** (logStart + index * step),
);

export interface ITransferFuncCoeffs {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

/** RBJ audio-EQ-cookbook coefficients for one filter. */
export const getTFCoefficients = (filter: IFilter): ITransferFuncCoeffs => {
  const {
    type: filterType,
    frequency,
    gain: dbGain,
    quality: userQuality,
  } = filter;

  const specialFilters = new Set([
    FilterTypeEnum.PK,
    FilterTypeEnum.HSC,
    FilterTypeEnum.LSC,
  ]);
  const gainFactor = specialFilters.has(filterType) ? 40 : 20;
  const gain = 10 ** (dbGain / gainFactor);

  const omega = (2 * Math.PI * frequency) / SAMPLE_FREQUENCY;
  const cosine = Math.cos(omega);

  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let a0 = 0;
  let a1 = 0;
  let a2 = 0;
  let alpha = 0;
  let beta = 0;

  let quality = userQuality;

  const shelfFilters = new Set([FilterTypeEnum.HSC, FilterTypeEnum.LSC]);
  if (shelfFilters.has(filterType)) {
    quality /= 2;

    alpha =
      (Math.sin(omega) / 2) *
      Math.sqrt((gain + 1 / gain) * (1 / quality - 1) + 2);
    beta = 2 * Math.sqrt(gain) * alpha;

    if (filterType === FilterTypeEnum.LSC) {
      b0 = gain * (gain + 1 - (gain - 1) * cosine + beta);
      b1 = 2 * gain * (gain - 1 - (gain + 1) * cosine);
      b2 = gain * (gain + 1 - (gain - 1) * cosine - beta);
      a0 = gain + 1 + (gain - 1) * cosine + beta;
      a1 = -2 * (gain - 1 + (gain + 1) * cosine);
      a2 = gain + 1 + (gain - 1) * cosine - beta;
    } else {
      b0 = gain * (gain + 1 + (gain - 1) * cosine + beta);
      b1 = -2 * gain * (gain - 1 + (gain + 1) * cosine);
      b2 = gain * (gain + 1 + (gain - 1) * cosine - beta);
      a0 = gain + 1 - (gain - 1) * cosine + beta;
      a1 = 2 * (gain - 1 - (gain + 1) * cosine);
      a2 = gain + 1 - (gain - 1) * cosine - beta;
    }
  } else {
    alpha = Math.sin(omega) / (2 * quality);

    if (filterType === FilterTypeEnum.PK) {
      b0 = 1 + alpha * gain;
      b1 = -2 * cosine;
      b2 = 1 - alpha * gain;
      a0 = 1 + alpha / gain;
      a1 = -2 * cosine;
      a2 = 1 - alpha / gain;
    } else if (filterType === FilterTypeEnum.NO) {
      b0 = 1;
      b1 = -2 * cosine;
      b2 = 1;
      a0 = 1 + alpha;
      a1 = -2 * cosine;
      a2 = 1 - alpha;
    } else if (filterType === FilterTypeEnum.LPQ) {
      b0 = (1 - cosine) / 2;
      b1 = 1 - cosine;
      b2 = (1 - cosine) / 2;
      a0 = 1 + alpha;
      a1 = -2 * cosine;
      a2 = 1 - alpha;
    } else if (filterType === FilterTypeEnum.HPQ) {
      b0 = (1 + cosine) / 2;
      b1 = -(1 + cosine);
      b2 = (1 + cosine) / 2;
      a0 = 1 + alpha;
      a1 = -2 * cosine;
      a2 = 1 - alpha;
    } else if (filterType === FilterTypeEnum.BP) {
      b0 = alpha;
      b1 = 0;
      b2 = -alpha;
      a0 = 1 + alpha;
      a1 = -2 * cosine;
      a2 = 1 - alpha;
    }
  }

  b0 /= a0;
  b1 /= a0;
  b2 /= a0;
  a1 /= a0;
  a2 /= a0;

  return { b0, b1, b2, a1, a2 };
};

/** Magnitude of one filter at one frequency, in dB. */
export const gainAtFrequency = (f: number, c: ITransferFuncCoeffs): number => {
  const { b0, b1, b2, a1, a2 } = c;
  const phi = Math.sin((2 * Math.PI * f) / (2 * SAMPLE_FREQUENCY)) ** 2;
  const numerator =
    (b0 + b1 + b2) ** 2 -
    4 * (b0 * b1 + 4 * b0 * b2 + b1 * b2) * phi +
    16 * b0 * b2 * phi * phi;
  const denominator =
    (1 + a1 + a2) ** 2 -
    4 * (a1 + 4 * a2 + a1 * a2) * phi +
    16 * a2 * phi * phi;

  return 10 * Math.log10(numerator / denominator);
};

/**
 * The loudest point of a whole filter chain, in dB, or 0 if it never boosts.
 *
 * This is the number the preamp has to cancel. Summing each filter's own peak
 * would over-reserve, because peaks at different frequencies never coincide;
 * summing the responses at every probe frequency and taking the maximum is the
 * real answer, and it costs one pass over a thousand samples.
 */
export const getChainPeakGain = (
  filters: Array<Pick<IFilter, 'type' | 'frequency' | 'gain' | 'quality'>>,
): number => {
  if (filters.length === 0) {
    return 0;
  }

  const coefficients = filters
    .filter(
      (filter) =>
        Number.isFinite(filter.frequency) &&
        Number.isFinite(filter.gain) &&
        Number.isFinite(filter.quality),
    )
    .map((filter) => getTFCoefficients(filter as IFilter));

  let peak = 0;
  SAMPLE_FREQUENCIES.forEach((frequency) => {
    let total = 0;
    coefficients.forEach((c) => {
      total += gainAtFrequency(frequency, c);
    });
    if (Number.isFinite(total) && total > peak) {
      peak = total;
    }
  });

  return Math.round(peak * 100) / 100;
};
