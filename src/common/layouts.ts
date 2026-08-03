import {
  FilterTypeEnum,
  FixedBandSizeEnum,
  FIXED_BAND_FREQUENCIES,
  IFilter,
  IFiltersMap,
} from './constants';

/** The editable part of a band that should survive a layout change. */
export interface ILayoutBand {
  frequency: number;
  gain: number;
  quality: number;
  type: FilterTypeEnum;
}

export type ILayoutSnapshot = ILayoutBand[];

const cloneBand = (band: ILayoutBand): ILayoutBand => ({ ...band });

const sortBands = (bands: ILayoutSnapshot): ILayoutSnapshot =>
  bands.map(cloneBand).sort((left, right) => left.frequency - right.frequency);

export const getFixedBandSizeForCount = (
  count: number,
): FixedBandSizeEnum | undefined => {
  const sizes = Object.values(FixedBandSizeEnum).filter(
    (value): value is number => typeof value === 'number',
  );
  return sizes.find(
    (size) =>
      FIXED_BAND_FREQUENCIES[size as FixedBandSizeEnum].length === count,
  ) as FixedBandSizeEnum | undefined;
};

export const snapshotFilters = (filters: IFiltersMap): ILayoutSnapshot =>
  sortBands(
    Object.values(filters).map((filter: IFilter) => ({
      frequency: filter.frequency,
      gain: filter.gain,
      quality: filter.quality,
      type: filter.type,
    })),
  );

const isSameFrequency = (left: number, right: number) =>
  Math.abs(Math.log10(Math.max(left, 1)) - Math.log10(Math.max(right, 1))) <
  0.0005;

const neutralBand = (frequency: number): ILayoutBand => ({
  frequency,
  gain: 0,
  quality: 1,
  type: FilterTypeEnum.PK,
});

/**
 * Convert the current layout to another fixed size without throwing away the
 * source snapshot. A smaller layout keeps representative source bands; a
 * larger layout keeps every source band and fills the gaps with neutral bands.
 */
export const adaptLayoutSnapshot = (
  sourceSnapshot: ILayoutSnapshot,
  targetSize: FixedBandSizeEnum,
): ILayoutSnapshot => {
  const source = sortBands(sourceSnapshot);
  const targetCount = FIXED_BAND_FREQUENCIES[targetSize].length;

  if (source.length === 0) {
    return FIXED_BAND_FREQUENCIES[targetSize].map(neutralBand);
  }

  if (source.length >= targetCount) {
    if (source.length === targetCount) {
      return source;
    }

    const selected = Array.from({ length: targetCount }, (_value, index) => {
      const sourceIndex = Math.round(
        (index * (source.length - 1)) / (targetCount - 1),
      );
      return source[sourceIndex];
    });
    return sortBands(selected);
  }

  const expanded = source.map(cloneBand);
  FIXED_BAND_FREQUENCIES[targetSize].forEach((frequency) => {
    if (
      expanded.length < targetCount &&
      !expanded.some((band) => isSameFrequency(band.frequency, frequency))
    ) {
      expanded.push(neutralBand(frequency));
    }
  });

  // The fixed frequencies normally fill the target. This fallback keeps the
  // function safe if a future layout definition contains duplicate points.
  let extraIndex = 0;
  while (expanded.length < targetCount) {
    const min = expanded[0].frequency;
    const max = expanded[expanded.length - 1].frequency;
    const ratio = (extraIndex + 1) / (targetCount - expanded.length + 1);
    const frequency = Math.round(
      10 ** (Math.log10(min) + ratio * (Math.log10(max) - Math.log10(min))),
    );
    if (!expanded.some((band) => isSameFrequency(band.frequency, frequency))) {
      expanded.push(neutralBand(frequency));
    }
    extraIndex += 1;
  }

  return sortBands(expanded).slice(0, targetCount);
};

/**
 * Adapt a layout's tuning values onto the canonical frequency positions for
 * the target quick layout. This keeps the user's gains/Q/type when moving
 * between band counts while ensuring each layout starts with its predefined
 * frequencies. Once the target layout is edited, its exact snapshot is saved
 * and restored on the next visit.
 */
export const adaptLayoutToFixedFrequencies = (
  sourceSnapshot: ILayoutSnapshot,
  targetSize: FixedBandSizeEnum,
): ILayoutSnapshot => {
  const adapted = adaptLayoutSnapshot(sourceSnapshot, targetSize);
  return FIXED_BAND_FREQUENCIES[targetSize].map((frequency, index) => ({
    ...(adapted[index] || neutralBand(frequency)),
    frequency,
  }));
};
