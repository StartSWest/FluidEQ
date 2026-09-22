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

import { FilterTypeEnum, IFilter, IGraphicEqPoint } from 'common/constants';
import { range } from 'renderer/utils/utils';
import {
  IChartPointData,
  IChartLineDataPointsById,
  GRAPH_START,
  GRAPH_END,
} from './ChartController';

/**
 * The rate a cookbook band is drawn at while the output's own is not known:
 * high enough that the bilinear squeeze sits above the graph's range.
 */
const SAMPLE_FREQUENCY = 96000;
const NUM_STEPS = 1000;

const logStart = Math.log10(GRAPH_START);
const logEnd = Math.log10(GRAPH_END);
const step = (logEnd - logStart) / NUM_STEPS;
const SAMPLE_FREQUENCIES = range(logStart, logEnd + step, step).map(
  (p) => 10 ** p,
);

interface ITransferFuncCoeffs {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

/**
 * The highest centre a band can have at `sampleRate`: the bound both
 * engines keep (`feq_biquad_coefficients`), clear of Nyquist's degenerate
 * poles. A band asked for above it plays there.
 */
const realizable = (frequency: number, sampleRate: number): number =>
  Math.min(frequency, sampleRate * 0.499);

const getTFCoefficients = (filter: IFilter, sampleRate: number) => {
  const {
    type: filterType,
    frequency,
    gain: dbGain,
    quality: userQuality,
  } = filter;

  // The types that take a gain. Everything else is a pure filter shape and
  // ignores it.
  //
  // Adding a filter type means three edits, not one: uncomment it in
  // FilterTypeEnum, add its Q handling below, and add its coefficients further
  // down. Miss the last two and the graph silently draws the wrong curve for a
  // filter Equalizer APO is genuinely applying, which is worse than not
  // offering the type at all.
  const specialFilters = new Set([
    FilterTypeEnum.PK,
    FilterTypeEnum.HSC,
    FilterTypeEnum.LSC,
  ]);
  const gainFactor = specialFilters.has(filterType) ? 40 : 20;
  const gain = 10 ** (dbGain / gainFactor);

  const omega = (2 * Math.PI * realizable(frequency, sampleRate)) / sampleRate;
  const cosine = Math.cos(omega);

  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let a0 = 0;
  let a1 = 0;
  let a2 = 0;
  let alpha = 0;
  let beta = 0;

  const quality = userQuality;

  const shelfFilters = new Set([FilterTypeEnum.HSC, FilterTypeEnum.LSC]);
  if (shelfFilters.has(filterType)) {
    alpha = Math.sin(omega) / (2 * quality);
    beta = 2 * Math.sqrt(gain) * alpha;

    // If filter is a low shelf {'low-shelf-fixed', 'low-shelf-q', 'low-shelf-db'}
    if (filterType === FilterTypeEnum.LSC) {
      b0 = gain * (gain + 1 - (gain - 1) * cosine + beta);
      b1 = 2 * gain * (gain - 1 - (gain + 1) * cosine);
      b2 = gain * (gain + 1 - (gain - 1) * cosine - beta);
      a0 = gain + 1 + (gain - 1) * cosine + beta;
      a1 = -2 * (gain - 1 + (gain + 1) * cosine);
      a2 = gain + 1 + (gain - 1) * cosine - beta;
      // If filter is a high shelf {'high-shelf-fixed', 'high-shelf-q', 'high-shelf-q'}
    } else if (filterType === FilterTypeEnum.HSC) {
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
      // All-pass would go here. It is commented out in FilterTypeEnum too, so
      // the two agree: the app cannot produce one, and nothing here pretends
      // it can. Its coefficients are b0 = 1 - alpha, b1 = -2cos, b2 = 1 +
      // alpha over a0 = 1 + alpha, a1 = -2cos, a2 = 1 - alpha, if it is ever
      // wanted.
    }
  }

  b0 /= a0;
  b1 /= a0;
  b2 /= a0;
  a1 /= a0;
  a2 /= a0;

  return { b0, b1, b2, a1, a2 } as ITransferFuncCoeffs;
};

const gainAtFrequency = (
  f: number,
  c: ITransferFuncCoeffs,
  sampleRate: number,
) => {
  const { b0, b1, b2, a1, a2 } = c;
  // Nothing plays above Nyquist, so the line holds the value it has there
  // rather than drawing the digital response's mirror image.
  const phi =
    Math.sin((Math.PI * Math.min(f, sampleRate / 2)) / sampleRate) ** 2;
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
 * One band's line as the cookbook plays it at `sampleRate` — the output's
 * own rate when the caller knows it, which is where the cookbook narrows the
 * treble bands, and `SAMPLE_FREQUENCY` when it does not.
 */
export const getFilterLineData = (
  filter: IFilter,
  sampleRate: number = SAMPLE_FREQUENCY,
): IChartPointData[] => {
  const tf = getTFCoefficients(filter, sampleRate);

  const data: IChartPointData[] = SAMPLE_FREQUENCIES.map((f) => {
    return { x: f, y: 0 };
  });

  for (let i = 0; i < SAMPLE_FREQUENCIES.length; i += 1) {
    const freqFilterGain = gainAtFrequency(
      SAMPLE_FREQUENCIES[i],
      tf,
      sampleRate,
    );
    data[i].y = freqFilterGain;
  }

  return data;
};

/**
 * How far from Butterworth a shelf may be and still be built analog-matched:
 * `kButterworthTolerance` in `native/dsp-core/src/biquad_matched.cpp`,
 * mirrored so the graph draws each band with the design the engine uses.
 */
const BUTTERWORTH_TOLERANCE = 0.02;

/**
 * Whether the FluidEQ Engine builds this band analog-matched when its layer
 * asks: the same rule as `feq_biquad_coefficients_matched`, which keeps the
 * cookbook for notches and non-Butterworth shelves because no matched design
 * measured better there.
 */
export const playsAnalogMatched = ({
  type,
  quality,
}: Pick<IFilter, 'type' | 'quality'>): boolean => {
  switch (type) {
    case FilterTypeEnum.PK:
    case FilterTypeEnum.LPQ:
    case FilterTypeEnum.HPQ:
    case FilterTypeEnum.BP:
      return true;
    case FilterTypeEnum.LSC:
    case FilterTypeEnum.HSC:
      return Math.abs(quality - Math.SQRT1_2) <= BUTTERWORTH_TOLERANCE;
    default:
      return false;
  }
};

/**
 * The analog prototype a cookbook band is the bilinear image of, in dB at
 * `f`: what an analog-matched band plays, at any sample rate, to within a
 * few tenths of a decibel of Nyquist.
 */
const analogGainDb = (
  { type, frequency, gain, quality }: IFilter,
  f: number,
): number => {
  const w = f / frequency;
  const real = 1 - w * w;
  const poles = real * real + (w / quality) ** 2;
  if (type === FilterTypeEnum.PK) {
    const a = 10 ** (gain / 40);
    return (
      10 *
      Math.log10(
        (real * real + ((w * a) / quality) ** 2) /
          (real * real + (w / (a * quality)) ** 2),
      )
    );
  }
  if (type === FilterTypeEnum.LSC || type === FilterTypeEnum.HSC) {
    const a = 10 ** (gain / 40);
    const r = (Math.sqrt(a) * w) / quality;
    const low = (a - w * w) ** 2 + r * r;
    const high = (1 - a * w * w) ** 2 + r * r;
    return (
      10 *
      Math.log10(
        type === FilterTypeEnum.LSC
          ? (a * a * low) / high
          : (a * a * high) / low,
      )
    );
  }
  if (type === FilterTypeEnum.LPQ) {
    return 10 * Math.log10(1 / poles);
  }
  if (type === FilterTypeEnum.HPQ) {
    return 10 * Math.log10(w ** 4 / poles);
  }
  // Band-pass: (s/Q) over the same poles, unity at the centre.
  return 10 * Math.log10((w / quality) ** 2 / poles);
};

/**
 * One band as the engine plays it at `sampleRate`: analog-matched when
 * `matched` and the engine has a matched design for its shape, the cookbook
 * otherwise.
 *
 * A matched band is the analog shape at any rate, bounded the way the engine
 * bounds it: a bell's or a pass filter's centre held below Nyquist, a
 * shelf's corner left where it was asked for, and nothing drawn changing
 * above Nyquist. Without a rate it is the analog shape across the graph.
 */
export const getDesignedFilterLineData = (
  filter: IFilter,
  matched: boolean,
  sampleRate?: number,
): IChartPointData[] => {
  if (!matched || !playsAnalogMatched(filter)) {
    return getFilterLineData(filter, sampleRate);
  }
  if (sampleRate === undefined) {
    return SAMPLE_FREQUENCIES.map((f) => ({
      x: f,
      y: analogGainDb(filter, f),
    }));
  }
  const isShelf =
    filter.type === FilterTypeEnum.LSC || filter.type === FilterTypeEnum.HSC;
  const played = isShelf
    ? filter
    : { ...filter, frequency: realizable(filter.frequency, sampleRate) };
  const nyquist = sampleRate / 2;
  return SAMPLE_FREQUENCIES.map((f) => ({
    x: f,
    y: analogGainDb(played, Math.min(f, nyquist)),
  }));
};

/**
 * Sample a native Equalizer APO GraphicEQ curve on the graph's log-frequency
 * grid. APO interpolates between neighbouring points, so interpolate in
 * logarithmic frequency space as well; that keeps a sparse custom curve
 * faithful between its points instead of bending it toward the linear axis.
 */
export const getGraphicEqLineData = (
  points: IGraphicEqPoint[],
): IChartPointData[] => {
  const sorted = points
    .filter(
      ({ frequency, gain }) =>
        Number.isFinite(frequency) && Number.isFinite(gain),
    )
    .slice()
    .sort((left, right) => left.frequency - right.frequency);

  if (sorted.length === 0) {
    return [];
  }

  return SAMPLE_FREQUENCIES.map((frequency) => {
    if (frequency <= sorted[0].frequency) {
      return { x: frequency, y: sorted[0].gain };
    }
    const last = sorted[sorted.length - 1];
    if (frequency >= last.frequency) {
      return { x: frequency, y: last.gain };
    }

    let index = 1;
    while (index < sorted.length && sorted[index].frequency < frequency) {
      index += 1;
    }
    const before = sorted[index - 1];
    const after = sorted[index];
    const span = Math.log(after.frequency) - Math.log(before.frequency);
    const progress =
      span === 0
        ? 0
        : (Math.log(frequency) - Math.log(before.frequency)) / span;
    return {
      x: frequency,
      y: before.gain + (after.gain - before.gain) * progress,
    };
  });
};

// Get total curve info from filter and point data
export const getCombinedLineData = (
  preAmp: number,
  filterLines: IChartLineDataPointsById,
) => {
  const data: IChartPointData[] = SAMPLE_FREQUENCIES.map((f) => {
    return { x: f, y: 0 };
  });

  for (let i = 0; i < SAMPLE_FREQUENCIES.length; i += 1) {
    // Add fixed preamp gain for each sample point
    data[i].y = preAmp;
    Object.values(filterLines).forEach((points) => {
      // Add frequency gain obtained from each filter
      data[i].y += points[i].y;
    });
  }

  return data;
};

// Return the response curve value at an arbitrary frequency. Curves are
// sampled logarithmically, so interpolate in log-frequency space to keep
// points accurate between samples (especially after expanding a layout).
export const getLineGainAtFrequency = (
  points: IChartPointData[],
  frequency: number,
) => {
  if (points.length === 0) {
    return 0;
  }
  if (frequency <= points[0].x) {
    return points[0].y;
  }
  const last = points[points.length - 1];
  if (frequency >= last.x) {
    return last.y;
  }

  let low = 0;
  let high = points.length - 1;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (points[middle].x <= frequency) {
      low = middle;
    } else {
      high = middle;
    }
  }

  const lower = points[low];
  const upper = points[high];
  const ratio =
    (Math.log(frequency) - Math.log(lower.x)) /
    (Math.log(upper.x) - Math.log(lower.x));
  return lower.y + (upper.y - lower.y) * ratio;
};
