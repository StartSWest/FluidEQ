import {
  FilterTypeEnum,
  getDefaultFilterWithId,
  IFiltersMap,
  MAX_FREQUENCY,
  MAX_GAIN,
  MAX_NUM_FILTERS,
  MAX_QUALITY,
  MIN_FREQUENCY,
  MIN_GAIN,
  MIN_NUM_FILTERS,
  MIN_QUALITY,
} from './constants';

export interface IBandDesignBand {
  frequency: number;
  quality: number;
}

export interface IBandDesign {
  id: string;
  name: string;
  bands: IBandDesignBand[];
}

export const MAX_BAND_DESIGN_NAME = 64;
export const MAX_BAND_DESIGNS = 100;

export const BAND_DESIGN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'name', 'bands'],
  properties: {
    id: { type: 'string', minLength: 1, maxLength: 64 },
    name: {
      type: 'string',
      minLength: 1,
      maxLength: MAX_BAND_DESIGN_NAME,
      pattern: '^[^\\u0000-\\u001f\\u007f]+$',
    },
    bands: {
      type: 'array',
      minItems: MIN_NUM_FILTERS,
      maxItems: MAX_NUM_FILTERS,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['frequency', 'quality'],
        properties: {
          frequency: {
            type: 'number',
            minimum: MIN_FREQUENCY,
            maximum: MAX_FREQUENCY,
          },
          gain: { type: 'number', minimum: MIN_GAIN, maximum: MAX_GAIN },
          quality: {
            type: 'number',
            minimum: MIN_QUALITY,
            maximum: MAX_QUALITY,
          },
          type: { type: 'string', enum: Object.values(FilterTypeEnum) },
          isEnabled: { type: 'boolean' },
        },
      },
    },
  },
};

export const isBandDesignName = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.trim().length > 0 &&
  value.length <= MAX_BAND_DESIGN_NAME &&
  Array.from(value).every(
    (letter) => letter.charCodeAt(0) >= 32 && letter.charCodeAt(0) !== 127,
  );

export const isBandDesign = (value: unknown): value is IBandDesign => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const design = value as Partial<IBandDesign>;
  const inRange = (number: unknown, min: number, max: number) =>
    typeof number === 'number' &&
    Number.isFinite(number) &&
    number >= min &&
    number <= max;
  return (
    typeof design.id === 'string' &&
    design.id.length > 0 &&
    design.id.length <= 64 &&
    isBandDesignName(design.name) &&
    Array.isArray(design.bands) &&
    design.bands.length >= MIN_NUM_FILTERS &&
    design.bands.length <= MAX_NUM_FILTERS &&
    design.bands.every(
      (band) =>
        band &&
        inRange(band.frequency, MIN_FREQUENCY, MAX_FREQUENCY) &&
        inRange(band.quality, MIN_QUALITY, MAX_QUALITY),
    )
  );
};

export const cloneBandDesign = (design: IBandDesign): IBandDesign => ({
  id: design.id,
  name: design.name.trim(),
  bands: design.bands.map((band) => ({
    frequency: band.frequency,
    quality: band.quality,
  })),
});

export const filtersFromBandDesign = (design: IBandDesign): IFiltersMap =>
  Object.fromEntries(
    design.bands.map((band) => {
      const filter = {
        ...getDefaultFilterWithId(),
        frequency: band.frequency,
        quality: band.quality,
      };
      return [filter.id, filter];
    }),
  );

export const snapshotBandDesign = (filters: IFiltersMap): IBandDesignBand[] =>
  Object.values(filters)
    .map(({ frequency, quality }) => ({ frequency, quality }))
    .sort((left, right) => left.frequency - right.frequency);

export const normalizeBandDesign = (value: unknown): IBandDesign | undefined =>
  isBandDesign(value) ? cloneBandDesign(value) : undefined;
