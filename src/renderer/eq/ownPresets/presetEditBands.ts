/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  FIXED_BAND_FREQUENCIES,
  FilterTypeEnum,
  FixedBandSizeEnum,
  MAX_FREQUENCY,
  MIN_FREQUENCY,
  isBandEnabled,
  type IFilter,
  type IFiltersMap,
} from '../../../common/constants';
import {
  qualityForAddedBand,
  qualityForMainRack,
} from '../../../common/bandQuality';
import {
  DSP_DEFAULTS,
  type IEqBandSettings,
  type IEqSettings,
} from '../../../common/dsp/chain';
import {
  PRESET_CURVE_MAX_BANDS,
  clampPresetCurve,
} from '../../../common/dsp/presetCurveClamp';

/**
 * A band of the preset curve being edited, under an id of its own: the band
 * rail and the graph's handles key on it, and an index would hand a band's
 * selection to its neighbour the moment a band before it was taken away.
 */
export interface IDraftBand {
  id: string;
  band: IEqBandSettings;
}

/**
 * Kept apart from the bands of Your EQ, whose ids are main's: a band menu
 * asked for one of these finds nothing to open among Your EQ's bands.
 */
const BAND_ID_PREFIX = 'preset-band-';
let lastBandId = 0;
export const newDraftBandId = (): string => {
  lastBandId += 1;
  return `${BAND_ID_PREFIX}${lastBandId}`;
};

export const draftBandsOf = (curve: IEqSettings): IDraftBand[] =>
  curve.bands.map((band) => ({ id: newDraftBandId(), band }));

/**
 * The curve the draft plays: every setting it started with, its bands as
 * they stand now, on and with no monitor. `sourceBands` go: they are the
 * published curve an import was fitted from, and an edited curve is no
 * longer that fit.
 */
export const draftCurveOf = (
  base: IEqSettings,
  bands: readonly IDraftBand[],
): IEqSettings =>
  clampPresetCurve({
    ...base,
    enabled: true,
    isolate: false,
    presetId: '',
    bands: bands.map((one) => one.band),
    sourceBands: [],
  });

/** A band as the band rail and the graph's handles read one. */
const draftFilterOf = ({ id, band }: IDraftBand): IFilter => ({
  id,
  type: band.type as FilterTypeEnum,
  frequency: band.frequency,
  gain: band.gainDb,
  quality: band.quality,
  ...(band.enabled ? {} : { isEnabled: false }),
});

export const draftFiltersOf = (bands: readonly IDraftBand[]): IFiltersMap =>
  Object.fromEntries(bands.map((one) => [one.id, draftFilterOf(one)]));

/** Your EQ's bands as a curve's: the same filters, at the same place. */
export const curveFromFilters = (filters: IFiltersMap): IEqSettings => {
  const bands: IEqBandSettings[] = Object.values(filters)
    .sort((a, b) => a.frequency - b.frequency)
    .map((filter) => ({
      enabled: isBandEnabled(filter),
      type: filter.type,
      frequency: filter.frequency,
      gainDb: filter.gain,
      quality: filter.quality,
      dynamic: false,
      thresholdDb: -24,
    }));
  return clampPresetCurve({ ...DSP_DEFAULTS.eq, enabled: true, bands });
};

/** Ten bands at 0 dB on the ten-band layout's octaves, to be shaped. */
export const flatCurve = (): IEqSettings => {
  const frequencies = FIXED_BAND_FREQUENCIES[FixedBandSizeEnum.TEN];
  const quality = qualityForMainRack(frequencies);
  return clampPresetCurve({
    ...DSP_DEFAULTS.eq,
    enabled: true,
    bands: frequencies.map((frequency) => ({
      enabled: true,
      type: 'PK',
      frequency,
      gainDb: 0,
      quality,
      dynamic: false,
      thresholdDb: -24,
    })),
  });
};

/** Whether another band fits: the main EQ's ceiling, where the curve plays. */
export const canAddDraftBand = (bands: readonly IDraftBand[]) =>
  bands.length < PRESET_CURVE_MAX_BANDS;

const LOW_EDGE = 20;
const HIGH_EDGE = 20_000;

/**
 * Where a new band goes: the middle, in octaves, of the widest stretch of
 * the spectrum no band covers, the audible edges counted as neighbours, so a
 * band added twice does not land on top of the first.
 */
export const freeFrequency = (bands: readonly IDraftBand[]): number => {
  const stops = [
    LOW_EDGE,
    ...bands
      .map((one) => one.band.frequency)
      .filter((frequency) => frequency > LOW_EDGE && frequency < HIGH_EDGE)
      .sort((a, b) => a - b),
    HIGH_EDGE,
  ];
  let best = { width: -1, at: 1_000 };
  stops.slice(1).forEach((upper, index) => {
    const lower = stops[index];
    const width = Math.log2(upper / lower);
    if (width > best.width) {
      best = { width, at: Math.sqrt(lower * upper) };
    }
  });
  return Math.round(best.at);
};

/** A flat bell at `frequency`, as wide as the middle of the bands already there. */
export const newDraftBand = (
  bands: readonly IDraftBand[],
  frequency: number,
): IDraftBand => ({
  id: newDraftBandId(),
  band: {
    enabled: true,
    type: 'PK',
    frequency: Math.round(
      Math.min(MAX_FREQUENCY, Math.max(MIN_FREQUENCY, frequency)),
    ),
    gainDb: 0,
    quality: qualityForAddedBand(bands.map((one) => one.band.quality)),
    dynamic: false,
    thresholdDb: -24,
  },
});

/** Half an octave to one side of a band, for "add a band beside it". */
export const besideFrequency = (frequency: number, side: 'left' | 'right') =>
  side === 'left' ? frequency / Math.SQRT2 : frequency * Math.SQRT2;
