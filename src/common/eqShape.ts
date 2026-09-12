import { getResponseGainAtFrequencies } from './response';
import {
  clampQuality,
  FilterTypeEnum,
  IFilter,
  IGraphicEqPoint,
} from './constants';

export type TBandQ = 'off' | 'proportional' | 'asymmetric';
export type TCurveSmoothing = 'off' | 'twelfth' | 'third';

export const shapeEqFilters = <
  T extends Pick<IFilter, 'type' | 'gain' | 'quality'>,
>(
  filters: T[],
  shape: TBandQ = 'off',
): T[] =>
  filters.map((filter) => {
    if (shape === 'off' || filter.type !== FilterTypeEnum.PK) {
      return filter;
    }
    const narrowing = Math.sqrt(1 + Math.min(20, Math.abs(filter.gain)) / 12);
    const factor =
      shape === 'asymmetric' && filter.gain > 0 ? 1 / narrowing : narrowing;
    return {
      ...filter,
      quality: Math.round(clampQuality(filter.quality * factor) * 100) / 100,
    };
  });

/** Integrates dB over a log-frequency window so dense samples cannot bias smoothing. */
export const smoothEqCurve = (
  points: IGraphicEqPoint[],
  smoothing: TCurveSmoothing = 'off',
): IGraphicEqPoint[] => {
  if (smoothing === 'off' || points.length < 2) {
    return points;
  }
  const unique = new Map<number, { frequency: number; gain: number }>();
  points.forEach(({ frequency, gain }) => {
    if (frequency > 0 && Number.isFinite(frequency) && Number.isFinite(gain)) {
      unique.set(Math.log2(frequency), { frequency, gain });
    }
  });
  const samples = [...unique]
    .map(([logFrequency, point]) => [logFrequency, point.gain] as const)
    .sort(([first], [second]) => first - second);
  if (samples.length < 2) {
    return points;
  }
  const prefix = [0];
  samples.slice(1).forEach(([frequency, gain], index) => {
    const [previousFrequency, previousGain] = samples[index];
    prefix.push(
      prefix[index] +
        ((frequency - previousFrequency) * (gain + previousGain)) / 2,
    );
  });
  const integral = (frequency: number): number => {
    if (frequency <= samples[0][0]) {
      return (frequency - samples[0][0]) * samples[0][1];
    }
    let low = 0;
    let high = samples.length - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (samples[middle][0] <= frequency) {
        low = middle;
      } else {
        high = middle - 1;
      }
    }
    const distance = frequency - samples[low][0];
    const next = samples[low + 1];
    const slope = next
      ? (next[1] - samples[low][1]) / (next[0] - samples[low][0])
      : 0;
    return (
      prefix[low] +
      distance * samples[low][1] +
      (slope * distance * distance) / 2
    );
  };
  const width = smoothing === 'third' ? 1 / 3 : 1 / 12;
  return samples.map(([frequency]) => ({
    frequency: unique.get(frequency)!.frequency,
    gain:
      (integral(frequency + width / 2) - integral(frequency - width / 2)) /
      width,
  }));
};
export const filterSmoothingCorrection = (
  filters: Array<Pick<IFilter, 'type' | 'frequency' | 'gain' | 'quality'>>,
  smoothing: TCurveSmoothing = 'off',
): IGraphicEqPoint[] => {
  if (smoothing === 'off' || !filters.length) {
    return [];
  }
  const frequencies = [
    ...new Set([
      ...Array.from(
        { length: 1024 },
        (_, index) => 20 * 1000 ** (index / 1023),
      ),
      ...filters
        .map((filter) => filter.frequency)
        .filter((frequency) => frequency > 0 && Number.isFinite(frequency)),
    ]),
  ].sort((first, second) => first - second);
  const gains = getResponseGainAtFrequencies({ filters }, frequencies);
  const original = frequencies.map((frequency, index) => ({
    frequency,
    gain: gains[index],
  }));
  return smoothEqCurve(original, smoothing).map((point, index) => ({
    ...point,
    gain: point.gain - gains[index],
  }));
};
