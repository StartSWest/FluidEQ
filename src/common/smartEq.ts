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

import {
  FilterTypeEnum,
  FixedBandSizeEnum,
  FIXED_BAND_FREQUENCIES,
  IFilter,
  IFiltersMap,
  ISmartEqSettings,
  NO_GAIN_FILTER_TYPES,
  clampFrequency,
  clampGain,
  clampQuality,
} from './constants';

export type { ISmartEqSettings };

/**
 * Smart EQ: what the measurement heard, kept as a layer of its own.
 *
 * Smart EQ listens to the output and works out the residual — what is still
 * wrong once the user's bands, the voicing and the driver compensation have all
 * had their say. That residual belongs to none of them, so it is written as its
 * own block of anonymous `Filter N:` lines after every other layer, exactly the
 * way the voicing and the driver already are. Clearing the headphone reference
 * resets the bands and leaves this standing; clearing this leaves the bands and
 * the reference exactly as they were.
 *
 * The layout is fixed rather than borrowed from the band editor, for four
 * reasons that all point the same way:
 *
 *  - Resolution. The residual is smoothed at half an octave. A six- or ten-band
 *    layout cannot represent a half-octave feature, so the correction would
 *    systematically under-shoot and never converge.
 *  - Solvability. A band the user has switched to Notch or High Pass carries no
 *    gain at all in Equalizer APO, so it can hold no correction. These are
 *    always Peak filters, so they always can.
 *  - Identity. Band ids are minted fresh whenever the layout is rebuilt —
 *    clearing the EQ, clearing the reference, switching band count. A layer
 *    keyed on borrowed ids would lose its accumulated correction every time one
 *    of those happened, which is precisely the case this feature exists for.
 *  - Stability. Dragging a band's frequency or Q would silently change what the
 *    layer does, with no new measurement behind it.
 */

/**
 * The range Smart EQ is willing to correct.
 *
 * Below it the capture is dominated by the room and by content that is simply
 * not there; above it the measurement is mostly dither and codec noise.
 * Correcting either produces confident-looking nonsense. The measurement's own
 * coverage regions span exactly this band, so what is measured and what is
 * corrected agree by construction.
 */
export const SMART_EQ_MIN_FREQUENCY = 35;
export const SMART_EQ_MAX_FREQUENCY = 15000;

/**
 * Q of every Smart EQ band.
 *
 * The solver treats the bands as overlapping bells and shares the correction
 * between them. At roughly 1/3-octave centres a Q near 1.4 gives neighbours
 * enough overlap for that to hold; much narrower and the solved curve turns
 * into a comb of isolated spikes between the centres.
 */
export const SMART_EQ_QUALITY = 1.4;

/** Prefix that makes a Smart EQ band id recognisable in a saved profile. */
const SMART_EQ_BAND_ID_PREFIX = 'smart-';

/**
 * The ISO 1/3-octave series, cropped to the correctable range.
 *
 * Reusing the 31-band layout rather than inventing a series keeps the centres
 * on the frequencies every other part of the app already speaks in. The
 * members outside the range — 20, 25, 31.5 Hz at the bottom, 16 and 20 kHz at
 * the top — are dropped here because the measurement would hand them zero
 * confidence anyway, and a band that can never carry a correction is only
 * noise in the config.
 */
export const SMART_EQ_FREQUENCIES = FIXED_BAND_FREQUENCIES[
  FixedBandSizeEnum.THIRTY_ONE
].filter(
  (frequency) =>
    frequency >= SMART_EQ_MIN_FREQUENCY && frequency <= SMART_EQ_MAX_FREQUENCY,
);

/** The empty layer: every band present, every gain neutral. */
export const getSmartEqLayout = (): IFilter[] =>
  SMART_EQ_FREQUENCIES.map((frequency) => ({
    id: `${SMART_EQ_BAND_ID_PREFIX}${frequency}`,
    frequency,
    gain: 0,
    quality: SMART_EQ_QUALITY,
    type: FilterTypeEnum.PK,
  }));

/**
 * The layer's bands as they stand, ready to be measured against again.
 *
 * The capture measures the already-corrected output, so what comes back is a
 * residual and the new gain is the old one plus that residual. Handing the
 * solver the layer's *own* previous gains is what closes that loop; handing it
 * the user's bands, as this used to, made every run rewrite their tuning.
 */
export const getSmartEqBands = (
  settings: ISmartEqSettings | undefined,
): IFilter[] =>
  getSmartEqLayout().map((band) => {
    const stored = settings?.filters?.[band.id];
    return stored && Number.isFinite(stored.gain)
      ? { ...band, gain: clampGain(stored.gain) }
      : band;
  });

/**
 * The filters this layer contributes to the Equalizer APO config.
 *
 * Same rule as the voicing and the driver: a peak or shelf at 0 dB is inert, so
 * it is dropped rather than written out as a command that does nothing.
 */
export const getSmartEqFilters = (
  settings: ISmartEqSettings | undefined,
): Array<Pick<IFilter, 'type' | 'frequency' | 'gain' | 'quality'>> => {
  if (!settings?.filters) {
    return [];
  }

  return Object.values(settings.filters)
    .filter(
      (filter) =>
        Number.isFinite(filter.frequency) &&
        Number.isFinite(filter.gain) &&
        Number.isFinite(filter.quality),
    )
    .map(({ type, frequency, gain, quality }) => ({
      type,
      frequency,
      gain: clampGain(gain),
      quality,
    }))
    .filter(
      (filter) =>
        NO_GAIN_FILTER_TYPES.includes(filter.type) || filter.gain !== 0,
    )
    .sort((left, right) => left.frequency - right.frequency);
};

/** Whether anything of this layer would actually reach Equalizer APO. */
export const hasSmartEqLayer = (settings: ISmartEqSettings | undefined) =>
  getSmartEqFilters(settings).length > 0;

/**
 * The layer as a comparable string, so "did the measurement change anything"
 * is a question about what will be heard rather than about object identity.
 */
export const describeSmartEqLayer = (
  settings: ISmartEqSettings | undefined,
): string =>
  getSmartEqFilters(settings)
    .map((filter) => `${Math.round(filter.frequency)}/${filter.gain}`)
    .join(',');

const isFilterLike = (value: unknown): value is IFilter => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const filter = value as Record<string, unknown>;
  return (
    typeof filter.frequency === 'number' &&
    Number.isFinite(filter.frequency) &&
    typeof filter.gain === 'number' &&
    Number.isFinite(filter.gain) &&
    typeof filter.quality === 'number' &&
    Number.isFinite(filter.quality) &&
    Object.values(FilterTypeEnum).includes(filter.type as FilterTypeEnum)
  );
};

/**
 * Accept a layer that arrived over IPC or came back off disk.
 *
 * Both are outside the type system, and a band carrying NaN survives every
 * numeric clamp to reach Equalizer APO as text it cannot build a biquad from.
 * Unrenderable bands are dropped, and a layer left with nothing audible is no
 * layer at all — returning undefined rather than an empty husk is what stops a
 * chip appearing for a correction of 0 dB everywhere.
 */
export const sanitizeSmartEqSettings = (
  value: unknown,
): ISmartEqSettings | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const input = value as Record<string, unknown>;
  if (!input.filters || typeof input.filters !== 'object') {
    return undefined;
  }

  const filters: IFiltersMap = {};
  Object.entries(input.filters as Record<string, unknown>).forEach(
    ([id, filter]) => {
      if (!id.trim() || !isFilterLike(filter)) {
        return;
      }
      filters[id] = {
        id,
        frequency: clampFrequency(filter.frequency),
        gain: clampGain(Math.round(filter.gain * 10) / 10),
        quality: clampQuality(filter.quality),
        type: filter.type,
      };
    },
  );

  const settings: ISmartEqSettings = { filters };
  if (input.status === 'ready' || input.status === 'partial') {
    settings.status = input.status;
  }
  if (
    typeof input.lowFrequency === 'number' &&
    Number.isFinite(input.lowFrequency)
  ) {
    settings.lowFrequency = input.lowFrequency;
  }
  if (
    typeof input.highFrequency === 'number' &&
    Number.isFinite(input.highFrequency)
  ) {
    settings.highFrequency = input.highFrequency;
  }

  return hasSmartEqLayer(settings) ? settings : undefined;
};

/**
 * Turn a solved set of gains into the layer to store.
 *
 * Every band is kept, including the ones that came out at 0 dB: the map is the
 * accumulator the next measurement adds its residual to, and a band missing
 * from it would restart from zero rather than from where it actually is. Only
 * the *rendering* drops the neutral ones.
 */
export const buildSmartEqSettings = (
  bands: IFilter[],
  gains: Record<string, number>,
  measurement: Pick<
    ISmartEqSettings,
    'status' | 'lowFrequency' | 'highFrequency'
  > = {},
): ISmartEqSettings | undefined => {
  const filters: IFiltersMap = {};
  bands.forEach((band) => {
    const solved = gains[band.id];
    filters[band.id] = {
      ...band,
      gain: Number.isFinite(solved) ? solved : band.gain,
    };
  });

  return sanitizeSmartEqSettings({ filters, ...measurement });
};
