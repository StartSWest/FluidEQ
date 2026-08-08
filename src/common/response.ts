/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

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

import { clampGain, FilterTypeEnum, IFilter, IFiltersMap } from './constants';

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
/**
 * How far below full scale music actually sits, by frequency.
 *
 * The headroom question is not "how much does this filter boost" but "how much
 * boost will ever meet a full-scale signal". Those are the same only if the
 * material is flat to 20 kHz, and nothing is: recorded music is loud from the
 * bass through the lower mids and falls away steeply above, so a +8 dB lift at
 * 12 kHz can never cost 8 dB of headroom because there is never 0 dBFS up there
 * to lift.
 *
 * Reserving as if there were is what made the preamp read −11 dB on a chain
 * nobody would call extreme. The numbers below are the shortfall, in dB, of
 * typical program material against its own busiest region — deliberately
 * conservative, roughly half of what measured spectra show, so the reserve
 * still errs high. Zero from 60 Hz to 2 kHz, where music genuinely does reach
 * full scale and the full boost has to be paid for.
 *
 * This is a model, not a measurement, and that is the point: it does not move
 * while somebody is listening. Measuring the live output would be more accurate
 * and would change the level under them, which is worse.
 */
const PROGRAM_ALLOWANCE: Array<[frequency: number, allowanceDb: number]> = [
  [20, 4],
  [40, 1.5],
  [60, 0],
  [2000, 0],
  [4000, 1.5],
  [6000, 3],
  [10000, 5],
  [16000, 7],
  [20000, 8],
];

/** Linear interpolation in log frequency, which is how hearing spaces it. */
const getProgramAllowance = (frequency: number): number => {
  const first = PROGRAM_ALLOWANCE[0];
  const last = PROGRAM_ALLOWANCE[PROGRAM_ALLOWANCE.length - 1];
  if (frequency <= first[0]) {
    return first[1];
  }
  if (frequency >= last[0]) {
    return last[1];
  }
  for (let i = 1; i < PROGRAM_ALLOWANCE.length; i += 1) {
    const [highFrequency, highAllowance] = PROGRAM_ALLOWANCE[i];
    if (frequency <= highFrequency) {
      const [lowFrequency, lowAllowance] = PROGRAM_ALLOWANCE[i - 1];
      const span = Math.log10(highFrequency / lowFrequency);
      const along = span > 0 ? Math.log10(frequency / lowFrequency) / span : 0;
      return lowAllowance + (highAllowance - lowAllowance) * along;
    }
  }
  return last[1];
};

/**
 * How far a chain departs from flat, in either direction.
 *
 * Unweighted and unsigned, unlike getChainPeakGain below: that one asks what a
 * boost will cost in headroom, which is a question about loud passages and only
 * about boosts. This asks how extreme the correction is at all, and a chain
 * that buries the midrange forty decibels down is exactly as unusable as one
 * that lifts it by forty.
 */
export const getChainExcursion = (
  filters: Array<Pick<IFilter, 'type' | 'frequency' | 'gain' | 'quality'>>,
): number => {
  const coefficients = filters
    .filter(
      (filter) =>
        Number.isFinite(filter.frequency) &&
        Number.isFinite(filter.gain) &&
        Number.isFinite(filter.quality),
    )
    .map((filter) => getTFCoefficients(filter as IFilter));

  let excursion = 0;
  SAMPLE_FREQUENCIES.forEach((frequency) => {
    let total = 0;
    coefficients.forEach((c) => {
      total += gainAtFrequency(frequency, c);
    });
    if (Number.isFinite(total)) {
      excursion = Math.max(excursion, Math.abs(total));
    }
  });

  return excursion;
};

/**
 * Scale a correction until the equaliser can actually express it.
 *
 * The shield in front of every applied reference, and it bounds the *chain*
 * rather than the bands. Bounding the bands is what the per-band ceiling
 * already does, and it is not enough on its own: a fit that spends eleven
 * filters on one excursion produces eleven individually legal bands whose sum
 * is fifty decibels of cut, which is silence. Nothing about any one of those
 * bands looks wrong, because nothing was.
 *
 * Compressed rather than clipped, because clipping invents a shape. Every gain
 * moves by the same factor, so each frequency keeps its position relative to
 * every other and the correction is recognisably the one the measurement asked
 * for, only gentler. A curve already inside the limit is returned untouched —
 * this costs a sane reference nothing.
 *
 * Found by halving rather than by dividing. Scaling straight to the ratio of
 * the limit to the excursion looks like the obvious step and lands a whisker
 * over, every time, because a peaking filter's response is not quite
 * proportional to its gain — so the bound would be one it very nearly kept.
 * Halving the interval converges on the largest factor that fits and cannot
 * overshoot: the low end of it is always a factor that already fits.
 */
export const compressChainToLimit = (
  filters: IFiltersMap,
  limit: number,
): IFiltersMap => {
  const bands = Object.values(filters);
  if (!bands.length || !(limit > 0)) {
    return filters;
  }

  const excursionAt = (scale: number) =>
    getChainExcursion(
      bands.map((band) => ({ ...band, gain: band.gain * scale })),
    );

  if (excursionAt(1) <= limit) {
    return filters;
  }

  // Zero always fits — a chain of nothing departs from flat by nothing — so the
  // low end is a factor known to be inside the limit throughout.
  let low = 0;
  let high = 1;
  for (let pass = 0; pass < 12; pass += 1) {
    const mid = (low + high) / 2;
    if (excursionAt(mid) > limit) {
      high = mid;
    } else {
      low = mid;
    }
  }
  const scale = low;

  return Object.fromEntries(
    bands.map((band) => [
      band.id,
      { ...band, gain: clampGain(band.gain * scale) },
    ]),
  );
};

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
    // What the boost will actually cost, not what it could cost in theory.
    const needed = total - getProgramAllowance(frequency);
    if (Number.isFinite(needed) && needed > peak) {
      peak = needed;
    }
  });

  return Math.round(peak * 100) / 100;
};
