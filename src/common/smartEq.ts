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

/**
 * How far one continuous update is allowed to move a band, in dB.
 *
 * The whole difference between Continuous EQ and pressing the button is here.
 * A solve answers "where should this band be", and applying that answer whole
 * is a step somebody hears; applying a fraction of it and solving again is a
 * correction that arrives without ever announcing itself.
 *
 * Half a decibel is below the level at which a broad change reads as an event
 * rather than as the sound simply being like that, and with an update every ten
 * seconds it still crosses the whole of the range below in about two minutes.
 */
export const CONTINUOUS_STEP_DB = 0.5;

/**
 * How far the accumulated correction may go, per band, in dB.
 *
 * This mode runs unattended for hours, so the question is not how much
 * correction is useful — it is how wrong it is allowed to get while nobody is
 * watching. Six decibels covers any real headphone or room problem; past that
 * the likelier explanation is that the measurement is being misled, and a cap
 * turns "it sounded strange after a while" into "it stopped short of strange".
 */
export const CONTINUOUS_MAX_DB = 6;

/**
 * How far a band has to be out before it is worth moving, in dB.
 *
 * This is what makes the mode react to the sound rather than to a clock. A
 * measurement never lands on exactly the gain a band already has, so without a
 * deadband every look would find every band a fraction out and rewrite the
 * whole correction on a timer — for changes nobody can hear, forever.
 *
 * One decibel is about where a change to a single band starts to be audible at
 * all, and it makes the mode per-range for free: the ranges that have drifted
 * move, the ranges that are already right hold completely still, and a look in
 * which nothing has drifted writes nothing at all. So the correction settles
 * and stays settled, and a range that goes out — different headphones, a
 * different room, a genuinely different balance — is the one thing that starts
 * it moving again.
 */
export const CONTINUOUS_TRIGGER_DB = 1;

/**
 * How much of one window's answer to believe.
 *
 * The correction is supposed to converge on the system — the headphones, the
 * room — and those do not change. What changes is the music, and a single
 * window of it is a measurement of one piece rather than of the system. A
 * bass-heavy album and a thin one really do have different long-run balances,
 * both perfectly steady, both easily passing the confidence test, so acting on
 * each in turn is a correction that raises the bass and then lowers it for as
 * long as anybody keeps listening.
 *
 * Averaging the answers is what makes them cancel. At 0.15 a window moves the
 * destination by a seventh of the way, so it takes half a dozen of them —
 * minutes of different music — for the destination to travel, and one album
 * cannot take it anywhere. Combined with the deadband this is what stops the
 * mode moving at all once it is right: a track that disagrees by two decibels
 * shifts the destination by 0.3, which is under the threshold, so nothing is
 * written.
 */
export const CONTINUOUS_MEMORY = 0.15;

/**
 * Where the correction is heading, averaged over everything heard so far.
 *
 * `solved` is one window's answer in absolute gains — already relative to what
 * is applied, because the solve accumulates onto the layer's own bands — so
 * answers from different windows are directly comparable and averaging them is
 * meaningful even though the chain changed in between. That is the property
 * that lets this survive a correction, where averaging raw measurements could
 * not.
 *
 * A band with no history takes the first answer whole: with nothing else known,
 * one measurement is the estimate. A band this window said nothing about keeps
 * the destination it had rather than decaying toward zero — no evidence is not
 * evidence of nothing.
 */
export const blendSmartEqTarget = (
  previous: Record<string, number>,
  solved: Record<string, number>,
  memory = CONTINUOUS_MEMORY,
): Record<string, number> => {
  const blended = { ...previous };
  Object.entries(solved).forEach(([id, answer]) => {
    if (!Number.isFinite(answer)) {
      return;
    }
    const held = blended[id];
    blended[id] = Number.isFinite(held)
      ? held + memory * (answer - held)
      : answer;
  });
  return blended;
};

/**
 * One continuous step: where each band moves to next, not where it belongs.
 *
 * `solved` is the destination the measurement worked out — absolute gains, the
 * same ones a manual run hands straight to `buildSmartEqSettings`. This walks
 * toward them instead, at most `maxStep` per band per call, never past
 * `maxTotal` in either direction, and only for bands more than `deadband` out.
 *
 * Bands the solve had nothing to say about are left exactly where they are
 * rather than pulled toward zero. Silence about a band is not evidence that it
 * should be flat, and treating it as such would undo a good correction every
 * time a passage had no energy in that region — which, over a long listen, is
 * most passages for most bands.
 */
export const stepSmartEqGains = (
  bands: IFilter[],
  solved: Record<string, number>,
  {
    maxStep = CONTINUOUS_STEP_DB,
    maxTotal = CONTINUOUS_MAX_DB,
    deadband = CONTINUOUS_TRIGGER_DB,
  }: { maxStep?: number; maxTotal?: number; deadband?: number } = {},
): Record<string, number> => {
  const stepped: Record<string, number> = {};
  bands.forEach((band) => {
    const destination = solved[band.id];
    const drift = destination - band.gain;
    if (!Number.isFinite(destination) || Math.abs(drift) < deadband) {
      stepped[band.id] = band.gain;
      return;
    }
    const move = Math.max(-maxStep, Math.min(maxStep, drift));
    stepped[band.id] = Math.max(
      -maxTotal,
      Math.min(maxTotal, band.gain + move),
    );
  });
  return stepped;
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
