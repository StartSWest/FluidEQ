/*
<FluidEQ: System-wide parametric audio equalizer interface>
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

import {
  clampGain,
  FilterTypeEnum,
  IFilter,
  IFiltersMap,
  IGraphicEqPoint,
} from './constants';

/**
 * Biquad magnitude response, shared by the graph and the config writer.
 *
 * It lives in common/ rather than beside the chart because both the picture
 * and the file have to agree about how loud a chain is. When the graph owned
 * this alone, the headroom it reserved was only applied if the graph happened
 * to be mounted — so switching to another tab and changing a layer left the
 * preamp describing a chain that no longer existed.
 */

/**
 * The rate the response curve is derived at.
 *
 * Arbitrary but deliberate: it is comfortably above anything Windows will run
 * an endpoint at, so every audible frequency sits well below Nyquist and the
 * drawn curve does not warp at the top of the range.
 *
 * Exported because it is now a *default* rather than the only answer. A filter
 * chain that is actually going to process audio — the mirror does — must be
 * built at the rate that audio is running at, or every centre frequency moves
 * by the ratio between the two. That is not a subtle error: coefficients made
 * here and run at 48 kHz put every band an octave low.
 */
export const RESPONSE_SAMPLE_FREQUENCY = 96000;
const NUM_STEPS = 1000;
export const RESPONSE_START = 10;
export const RESPONSE_END = 20000;

/** Shared output ceiling for strict automatic peak normalization. */
export const AUTO_PREAMP_HEADROOM_DB = 0.2;

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
export const getTFCoefficients = (
  // Only the four fields the maths reads, matching `getChainPeakGain` below.
  // The voicing, driver and Smart EQ layers produce filters of exactly this
  // shape without an id, and they are as entitled to the shared derivation as
  // a user band is.
  filter: Pick<IFilter, 'type' | 'frequency' | 'gain' | 'quality'>,
  sampleFrequency: number = RESPONSE_SAMPLE_FREQUENCY,
): ITransferFuncCoeffs => {
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

  const omega = (2 * Math.PI * frequency) / sampleFrequency;
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

/**
 * Magnitude of one filter at one frequency, in dB.
 *
 * `sampleFrequency` must be the one the coefficients were built at. Evaluating
 * a 48 kHz chain on the 96 kHz grid reports a curve nothing will ever play.
 */
export const gainAtFrequency = (
  f: number,
  c: ITransferFuncCoeffs,
  sampleFrequency: number = RESPONSE_SAMPLE_FREQUENCY,
): number => {
  const { b0, b1, b2, a1, a2 } = c;
  const phi = Math.sin((2 * Math.PI * f) / (2 * sampleFrequency)) ** 2;
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

const sortedGraphicEqPoints = (points: IGraphicEqPoint[] | undefined) =>
  (points ?? [])
    .filter(
      (point) =>
        Number.isFinite(point.frequency) &&
        point.frequency > 0 &&
        Number.isFinite(point.gain),
    )
    .slice()
    .sort((left, right) => left.frequency - right.frequency);

const gainAtSortedGraphicEqFrequency = (
  sorted: IGraphicEqPoint[],
  frequency: number,
): number => {
  if (sorted.length === 0) {
    return 0;
  }
  if (frequency <= sorted[0].frequency) {
    return sorted[0].gain;
  }
  const last = sorted[sorted.length - 1];
  if (frequency >= last.frequency) {
    return last.gain;
  }
  let low = 0;
  let high = sorted.length - 1;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (sorted[middle].frequency <= frequency) {
      low = middle;
    } else {
      high = middle;
    }
  }
  const before = sorted[low];
  const after = sorted[high];
  const span = Math.log(after.frequency) - Math.log(before.frequency);
  const progress =
    span === 0 ? 0 : (Math.log(frequency) - Math.log(before.frequency)) / span;
  return before.gain + (after.gain - before.gain) * progress;
};

/** Linear interpolation in log frequency, matching Equalizer APO GraphicEQ. */
export const getGraphicEqGainAtFrequency = (
  points: IGraphicEqPoint[] | undefined,
  frequency: number,
): number =>
  gainAtSortedGraphicEqFrequency(sortedGraphicEqPoints(points), frequency);

/**
 * How far a chain departs from flat, in either direction.
 *
 * Unsigned, unlike getChainPeakGain below: that one asks where the chain's
 * highest absolute response lands. This asks how extreme the correction is in
 * either direction, and a chain that buries the midrange forty decibels down is
 * exactly as unusable as one that lifts it by forty.
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

export interface ICombinedResponse {
  filters?: Array<Pick<IFilter, 'type' | 'frequency' | 'gain' | 'quality'>>;
  /** Native GraphicEQ stages and measured convolution responses. */
  curves?: Array<IGraphicEqPoint[] | undefined>;
  /** Known frequency-independent gain, such as a custom-file Preamp line. */
  constantGain?: number;
}

/**
 * The chain's gain at each of `frequencies`, in dB.
 *
 * `getCombinedResponsePeakGain` below answers "how loud is the loudest point";
 * Smart auto-normalize needs the shape as well, because it weighs the chain
 * against where the music's energy actually is. Same two primitives, so the two
 * cannot drift apart in kind — and the one caller that compares their results
 * clamps to the peak, so a disagreement in degree can only ever resolve towards
 * less output rather than more.
 *
 * Curves are sorted once here for the same reason the peak does it once: a
 * measured convolution carries about a thousand points and this runs on every
 * filter drag.
 */
export const getResponseGainAtFrequencies = (
  { filters = [], curves = [], constantGain = 0 }: ICombinedResponse,
  frequencies: readonly number[],
): number[] => {
  const coefficients = filters
    .filter(
      (filter) =>
        Number.isFinite(filter.frequency) &&
        Number.isFinite(filter.gain) &&
        Number.isFinite(filter.quality),
    )
    .map((filter) => getTFCoefficients(filter as IFilter));
  const usableCurves = curves
    .filter((curve): curve is IGraphicEqPoint[] => Array.isArray(curve))
    .map(sortedGraphicEqPoints)
    .filter((curve) => curve.length > 0);
  const base = Number.isFinite(constantGain) ? constantGain : 0;

  return Array.from(frequencies, (frequency) => {
    let total = base;
    coefficients.forEach((c) => {
      total += gainAtFrequency(frequency, c);
    });
    usableCurves.forEach((curve) => {
      total += gainAtSortedGraphicEqFrequency(curve, frequency);
    });
    return total;
  });
};

/**
 * The strict peak of every measurable stage at the same frequencies.
 *
 * Peaks are combined before the maximum is selected. Adding each layer's own
 * maximum would reserve headroom for boosts that never coincide, while a
 * program-material weighting can leave a legal full-scale input above 0 dB.
 * Curve frequencies are added to the normal probe grid so a measured FIR peak
 * cannot fall between the logarithmic samples.
 */
export const getCombinedResponsePeakGain = (
  response: ICombinedResponse,
): number => {
  const { filters = [], curves = [], constantGain = 0 } = response;
  const coefficients = filters
    .filter(
      (filter) =>
        Number.isFinite(filter.frequency) &&
        Number.isFinite(filter.gain) &&
        Number.isFinite(filter.quality),
    )
    .map((filter) => getTFCoefficients(filter as IFilter));

  // Sort each curve once. This calculation runs on every filter drag and a
  // measured convolution carries about a thousand points; sorting it again at
  // every probe frequency would turn one response calculation into thousands
  // of full sorts.
  const usableCurves = curves
    .filter((curve): curve is IGraphicEqPoint[] => Array.isArray(curve))
    .map(sortedGraphicEqPoints)
    .filter((curve) => curve.length > 0);
  const hasConstantGain = Number.isFinite(constantGain) && constantGain !== 0;
  if (
    coefficients.length === 0 &&
    usableCurves.length === 0 &&
    !hasConstantGain
  ) {
    return 0;
  }

  const frequencies = new Set(SAMPLE_FREQUENCIES);
  usableCurves.forEach((curve) =>
    curve.forEach(({ frequency }) => {
      if (
        Number.isFinite(frequency) &&
        frequency >= RESPONSE_START &&
        frequency <= RESPONSE_END
      ) {
        frequencies.add(frequency);
      }
    }),
  );

  /*
   * THE TRUE MAXIMUM, WHICH CAN BE NEGATIVE.
   *
   * This started at zero, so a chain that only ever cuts reported a peak of
   * zero rather than the negative number it actually has — and the preamp,
   * being derived from it, sat at zero while the output got quieter. Nothing
   * put that volume back, so using a voicing cost loudness with no visible
   * cause. Clamping here and again at the caller was the same mistake written
   * twice.
   *
   * Negative now means what it says: the chain's loudest point is this far
   * below unity, and a preamp of that much in the other direction restores it
   * without any risk of clipping, since the loudest point lands exactly at 0.
   */
  let peak = -Infinity;
  frequencies.forEach((frequency) => {
    let total = Number.isFinite(constantGain) ? constantGain : 0;
    coefficients.forEach((c) => {
      total += gainAtFrequency(frequency, c);
    });
    usableCurves.forEach((curve) => {
      total += gainAtSortedGraphicEqFrequency(curve, frequency);
    });
    if (Number.isFinite(total) && total > peak) {
      peak = total;
    }
  });

  // No usable filter contributed anything, so there is no chain to speak of and
  // nothing to correct for. Zero rather than the sentinel, which would travel
  // out of here as an infinite preamp.
  if (!Number.isFinite(peak)) {
    return 0;
  }
  return Math.round(peak * 100) / 100;
};

export const getChainPeakGain = (
  filters: Array<Pick<IFilter, 'type' | 'frequency' | 'gain' | 'quality'>>,
): number => getCombinedResponsePeakGain({ filters });

/**
 * Preamp that puts the measurable chain below full scale by the shared margin.
 * A genuinely empty chain remains at 0 dB instead of being attenuated merely
 * because automatic normalization is enabled.
 */
export const getAutoPreAmpGain = (response: ICombinedResponse): number => {
  const filters = response.filters ?? [];
  const curves = (response.curves ?? []).filter(
    (curve) => Array.isArray(curve) && curve.length > 0,
  );
  const constantGain = Number.isFinite(response.constantGain)
    ? (response.constantGain ?? 0)
    : 0;
  if (filters.length === 0 && curves.length === 0 && constantGain === 0) {
    return 0;
  }
  const gain = -(
    getCombinedResponsePeakGain({ filters, curves, constantGain }) +
    AUTO_PREAMP_HEADROOM_DB
  );
  return Math.round(gain * 100) / 100;
};

/**
 * The peak of a native GraphicEQ stage, in dB.
 *
 * GraphicEQ is not a collection of biquads, so it cannot go through
 * `getChainPeakGain`. APO interpolates between the supplied points, which
 * cannot create a value above the largest point; the largest finite gain is
 * therefore the stage peak. Keeping the negative result matters for a curve
 * that cuts everywhere: auto-normalize should restore that lost level too.
 */
export const getGraphicEqPeakGain = (
  points: IGraphicEqPoint[] | undefined,
): number => {
  const finiteGains = (points ?? [])
    .map(({ gain }) => gain)
    .filter((gain) => Number.isFinite(gain));
  return finiteGains.length > 0 ? Math.max(...finiteGains) : 0;
};
