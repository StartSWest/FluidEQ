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
  FilterTypeEnum,
  FixedBandSizeEnum,
  FIXED_BAND_FREQUENCIES,
  IFilter,
  IFiltersMap,
  IGraphicEqPoint,
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
  const filters = settings?.apoOverride
    ? settings.apoOverride.filters
    : settings?.filters;
  if (!filters || settings?.apoOverride?.graphicEq?.length) {
    return [];
  }

  /*
   * Scaled by strength, the way every other layer is.
   *
   * Absent means all of it, and that has to stay true: every profile saved
   * before this field existed carries no strength, and reading a missing one as
   * zero would silence all of them on upgrade. A value that is not a finite
   * number is treated the same way rather than clamped to zero, for the same
   * reason and with the same consequence if it were not.
   */
  const intensity = Number.isFinite(settings?.intensity)
    ? Math.max(0, Math.min(1, settings?.intensity as number))
    : 1;
  if (intensity === 0) {
    return [];
  }
  const gainPrecision = settings?.apoOverride ? 100 : 10;

  return Object.values(filters)
    .filter(
      (filter) =>
        Number.isFinite(filter.frequency) &&
        Number.isFinite(filter.gain) &&
        Number.isFinite(filter.quality),
    )
    .map(({ type, frequency, gain, quality }) => ({
      type,
      frequency,
      // Rounded to a tenth, which is all Equalizer APO reads and all anybody
      // hears. Without it, halving a correction writes gains like 2.8499999
      // into a file somebody may well open and read.
      gain: clampGain(
        Math.round(gain * intensity * gainPrecision) / gainPrecision,
      ),
      quality,
    }))
    .filter(
      (filter) =>
        NO_GAIN_FILTER_TYPES.includes(filter.type) || filter.gain !== 0,
    )
    .sort((left, right) => left.frequency - right.frequency);
};

export const getSmartEqGraphicEq = (
  settings: ISmartEqSettings | undefined,
): IGraphicEqPoint[] => {
  const points = settings?.apoOverride?.graphicEq;
  const intensity = Number.isFinite(settings?.intensity)
    ? Math.max(0, Math.min(1, settings?.intensity as number))
    : 1;
  return points?.length && intensity > 0
    ? points.map(({ frequency, gain }) => ({
        frequency,
        gain: clampGain(Math.round(gain * intensity * 100) / 100),
      }))
    : [];
};

/** Whether anything of this layer would actually reach Equalizer APO. */
export const hasSmartEqLayer = (settings: ISmartEqSettings | undefined) =>
  getSmartEqFilters(settings).length > 0 ||
  getSmartEqGraphicEq(settings).length > 0;

/**
 * Whether a measured correction is still held, even at zero strength.
 *
 * `hasSmartEqLayer` answers what APO can hear. Controls need a different
 * answer: at 0% the filters intentionally write nothing, but removing the
 * settings would also remove the slider that can bring them back.
 */
export const hasSmartEqCorrection = (
  settings: ISmartEqSettings | undefined,
): boolean =>
  Boolean(settings) &&
  (Object.values(
    settings?.apoOverride?.filters ?? settings?.filters ?? {},
  ).some(
    ({ type, gain }) =>
      NO_GAIN_FILTER_TYPES.includes(type) || Math.abs(gain) > 0.001,
  ) ||
    (settings?.apoOverride?.graphicEq ?? []).some(
      ({ gain }) => Math.abs(gain) > 0.001,
    ));

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
  const { intensity } = input;
  if (typeof intensity === 'number' && Number.isFinite(intensity)) {
    settings.intensity = Math.max(0, Math.min(1, intensity));
  }
  if (input.apoOverride && typeof input.apoOverride === 'object') {
    const rawOverride = input.apoOverride as Record<string, unknown>;
    const overrideFilters: IFiltersMap = {};
    if (rawOverride.filters && typeof rawOverride.filters === 'object') {
      Object.entries(rawOverride.filters as Record<string, unknown>).forEach(
        ([id, filter]) => {
          if (id.trim() && isFilterLike(filter)) {
            overrideFilters[id] = {
              id,
              frequency: clampFrequency(filter.frequency),
              gain: clampGain(filter.gain),
              quality: clampQuality(filter.quality),
              type: filter.type,
            };
          }
        },
      );
    }
    const graphicEq = Array.isArray(rawOverride.graphicEq)
      ? rawOverride.graphicEq
          .map((point) => {
            if (!point || typeof point !== 'object') {
              return undefined;
            }
            const { frequency, gain } = point as Record<string, unknown>;
            return typeof frequency === 'number' &&
              Number.isFinite(frequency) &&
              typeof gain === 'number' &&
              Number.isFinite(gain)
              ? { frequency, gain: clampGain(gain) }
              : undefined;
          })
          .filter((point): point is IGraphicEqPoint => point !== undefined)
      : undefined;
    if (Object.keys(overrideFilters).length || graphicEq?.length) {
      settings.apoOverride = {
        filters: overrideFilters,
        ...(graphicEq?.length ? { graphicEq } : {}),
      };
    }
  }
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

  return hasSmartEqCorrection(settings) ? settings : undefined;
};

/**
 * The layer as read back from its own file in the Equalizer APO config.
 *
 * Smart EQ is the one layer a config can hand back whole. A voicing or a driver
 * correction is a profile id and an intensity that generated those lines, and
 * nothing in the file records which — read them back and you get bands, not the
 * layer. This one has no generator: the filters ARE what the measurement
 * decided. So once it has a file of its own, the correction stops being
 * something only state.txt remembers, and the report that applying a model can
 * make a measurement disappear stops being able to cost anybody one — whatever
 * the cause, the answer is still in the config and comes back on the next
 * launch.
 *
 * Bands are matched to the layer's own ids by frequency, which works because
 * the layout is fixed and deliberately so. Anything at a frequency this layer
 * never uses is not from this layer and is left out. A band at 0 dB is never
 * written and does not need to come back: one missing from the map reads as
 * zero when the next measurement accumulates onto it.
 */
export const smartEqFromFilters = (
  filters: Array<Pick<IFilter, 'type' | 'frequency' | 'gain' | 'quality'>>,
): ISmartEqSettings | undefined => {
  const known = new Set<number>(SMART_EQ_FREQUENCIES);
  const recovered: IFiltersMap = {};

  filters.forEach((filter) => {
    const frequency = Math.round(filter.frequency);
    if (filter.type !== FilterTypeEnum.PK || !known.has(frequency)) {
      return;
    }
    const id = `${SMART_EQ_BAND_ID_PREFIX}${frequency}`;
    recovered[id] = {
      id,
      frequency,
      gain: filter.gain,
      // The layer's own Q rather than the file's. It is a property of the
      // layout, and a rounded value read back off a config line would drift the
      // shape a little further every time it made the round trip.
      quality: SMART_EQ_QUALITY,
      type: FilterTypeEnum.PK,
    };
  });

  return sanitizeSmartEqSettings({ filters: recovered });
};
