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
  SAMPLE_FREQUENCIES,
  gainAtFrequency,
  getTFCoefficients,
} from './response';
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

  /*
   * Scaled by strength, the way every other layer is.
   *
   * Absent means all of it, and that has to stay true: every profile saved
   * before this field existed carries no strength, and reading a missing one as
   * zero would silence all of them on upgrade. A value that is not a finite
   * number is treated the same way rather than clamped to zero, for the same
   * reason and with the same consequence if it were not.
   */
  const intensity = Number.isFinite(settings.intensity)
    ? Math.max(0, Math.min(1, settings.intensity as number))
    : 1;
  if (intensity === 0) {
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
      // Rounded to a tenth, which is all Equalizer APO reads and all anybody
      // hears. Without it, halving a correction writes gains like 2.8499999
      // into a file somebody may well open and read.
      gain: clampGain(Math.round(gain * intensity * 10) / 10),
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
 * RARELY, AND THEN PROPERLY — which is a reversal, and the reason is worth
 * keeping.
 *
 * It was half a decibel, chosen so a correction would arrive without ever
 * announcing itself: below the level at which a broad change reads as an event.
 * That worked, and it made the mode a nuisance to live with. Half a decibel at
 * a time means six writes to close a three-decibel gap, six config rewrites,
 * six reloads, and six times the app pipes up to say what it just did. The
 * arrival was imperceptible and the fuss around it was not.
 *
 * Two decibels, and only for a range that is far enough out to be worth
 * correcting at all — see `CONTINUOUS_TRIGGER_DB`, which is now larger than
 * this. That pairing is the whole design: nothing happens until something is
 * genuinely wrong, and then one step very nearly fixes it. A range three
 * decibels out is corrected once and falls inside the deadband, rather than
 * being nudged at for a minute.
 */
export const CONTINUOUS_STEP_DB = 2;

/**
 * The largest single move, and the fraction of the remaining distance a step
 * aims at.
 *
 * A flat two decibels was right while the errors were small, and stopped being
 * right the moment the ceiling came off: a band sixteen decibels out needs eight
 * writes at twenty seconds apart to be reached, which is nearly three minutes of
 * a mode visibly failing to fix something obvious. Half the remaining distance
 * each time gets there in three, and the sequence is the familiar one — a big
 * move, a smaller one, a nudge — which is what somebody watching expects of a
 * thing that knows what it is doing.
 *
 * The floor stays `CONTINUOUS_STEP_DB`, so the ordinary case is untouched: a
 * range three decibels out is still corrected in one step and still falls inside
 * the deadband afterwards. Only a genuine mess moves faster, and it slows down
 * as it stops being one.
 */
export const CONTINUOUS_MAX_STEP_DB = 8;
export const CONTINUOUS_STEP_FRACTION = 0.5;

/**
 * How far this layer may go, per band, in dB — and the rule is that IT DOES NOT
 * ACCUMULATE. The total is exactly what one measurement is allowed to ask for,
 * so repeated runs settle rather than stack.
 *
 * The numbers are `buildBalancedGains`' own per-run boost and cut limits, which
 * is what makes that sentence true: whatever a single solve may do is also the
 * furthest twenty solves may get. Every path that writes this layer is held to
 * them — the one-shot through `buildSmartEqSettings`, the continuous modes
 * through `stepSmartEqGains`.
 *
 * Asymmetric because cutting and boosting are not equally risky. A cut costs
 * nothing but level; a boost costs headroom, and this layer sits on top of the
 * user's bands, a voicing and a driver correction, with the preamp reserving
 * room for the sum of all of them.
 *
 * It has been six, and twenty, on the way here, and both were right about the
 * architecture they were written for. Six was for correcting a system — a
 * headphone, a room, something small and physical. Twenty came when the
 * measurement briefly treated the whole output as correctable, the user's own
 * bands included: a slider dragged to -16 dB was then a sixteen-decibel error,
 * and a six-decibel correction could not reach it, so the mode moved the full
 * six, sat on the clamp and went on reporting that it was working on it. A
 * ceiling below the size of the errors it is asked to fix is not a safety limit,
 * it is a hang.
 *
 * The premise of that is gone. The capture subtracts the chain, so Smart EQ
 * never sees a slider somebody dragged and is never asked to undo one. It
 * corrects the record, and a record does not need twenty decibels of anything.
 */
export const SMART_EQ_MAX_BOOST_DB = 6;
export const SMART_EQ_MAX_CUT_DB = 9;

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
export const CONTINUOUS_TRIGGER_DB = 2.5;

/**
 * How close a band that is ALREADY moving has to get before it stops.
 *
 * The trigger above was doing two jobs and is only right for one of them. As
 * "how wrong does this have to be before I bother", 2.5 dB is a good answer: it
 * is what stops the mode rewriting the correction on a timer for changes nobody
 * can hear. As "how close is close enough", it is a bad one, because it means
 * the correction stops the moment it is within 2.5 dB and never finishes — a
 * band could sit two and a half decibels out for the rest of the evening while
 * the mode reported that everything was fine. Which is exactly what it looked
 * like: it moved once, reached a level, and stayed there with an audible problem
 * still in the sound.
 *
 * So a band starts moving at `CONTINUOUS_TRIGGER_DB` and keeps moving until it
 * is inside this. Hysteresis, which is the standard answer whenever one
 * threshold is being asked to both start and stop something.
 *
 * Three quarters of a decibel is below the level at which a broad change is
 * audible, so stopping there is stopping at "done" rather than at "close". It
 * cannot cause the fidgeting the trigger prevents, because a band only ever gets
 * here by having been more than 2.5 dB out first.
 */
export const CONTINUOUS_SETTLE_DB = 0.75;

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
 * When a disagreement stops being noise and starts being a different situation.
 *
 * Averaging alone converges on what every record agrees about and then holds
 * there, which is right until the thing being corrected genuinely changes —
 * other headphones, another room, a source with a different balance. Then the
 * memory is not steadying the answer, it is defending an obsolete one, and a
 * seventh of the way per window means minutes of hearing something wrong.
 *
 * One window three decibels out is a loud chorus. Three in a row, all still
 * three decibels out, is not: the estimate is simply no longer describing what
 * is being played, and the honest response is to take the new answer whole
 * rather than creep toward it.
 *
 * This is the fast half of the pair, and it is what keeps the raised deadband
 * from making the mode sluggish. Something genuinely and suddenly different —
 * other headphones, another room, a source with a different balance — is
 * adopted outright within a few windows, where an ordinary drift has to earn
 * its way past the threshold slowly.
 *
 * Both numbers matter and they do different jobs. The threshold decides what
 * counts as disagreement at all; the count is what stops a single unusual track
 * from qualifying, and it is the reason this does not collapse back into
 * correcting every song — which is the behaviour the averaging was added to
 * stop.
 */
export const CONTINUOUS_RESET_DB = 3;
export const CONTINUOUS_RESET_HOLDS = 3;

/**
 * How far each band has been out, for how long — the state the reset needs.
 *
 * Carried by the caller rather than kept here so this file stays pure, and per
 * band rather than per range because a range's bands can disagree with the
 * settled answer independently.
 */
export type TSmartEqDrift = Record<string, number>;

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
 *
 * Two rates, not one. Averaging is right until the thing being corrected
 * actually changes, at which point it is defending an obsolete answer — so a
 * disagreement that is both large and sustained resets the estimate instead of
 * being averaged into it. See `CONTINUOUS_RESET_DB`. The returned drift counts
 * are what the next call needs to know how long each band has been out; hand
 * them straight back.
 */
export const blendSmartEqTarget = (
  previous: Record<string, number>,
  solved: Record<string, number>,
  {
    memory = CONTINUOUS_MEMORY,
    drift = {},
    resetDb = CONTINUOUS_RESET_DB,
    resetHolds = CONTINUOUS_RESET_HOLDS,
  }: {
    memory?: number;
    /** How many windows running each band has been far out. */
    drift?: TSmartEqDrift;
    resetDb?: number;
    resetHolds?: number;
  } = {},
): { target: Record<string, number>; drift: TSmartEqDrift } => {
  const blended = { ...previous };
  const nextDrift: TSmartEqDrift = { ...drift };

  Object.entries(solved).forEach(([id, answer]) => {
    if (!Number.isFinite(answer)) {
      return;
    }
    const held = blended[id];
    if (!Number.isFinite(held)) {
      blended[id] = answer;
      delete nextDrift[id];
      return;
    }

    if (Math.abs(answer - held) < resetDb) {
      // Back in agreement. The count goes to nothing rather than down by one,
      // because what earns a reset is a run of them: three scattered across ten
      // minutes is ordinary music, three in a row is a different situation.
      delete nextDrift[id];
      blended[id] = held + memory * (answer - held);
      return;
    }

    const runLength = (nextDrift[id] ?? 0) + 1;
    if (runLength >= resetHolds) {
      // Long enough. Take the new answer whole — creeping toward it a seventh
      // at a time would be minutes of defending an estimate that has already
      // been contradicted three times running.
      delete nextDrift[id];
      blended[id] = answer;
      return;
    }
    nextDrift[id] = runLength;
    blended[id] = held + memory * (answer - held);
  });

  return { target: blended, drift: nextDrift };
};

/**
 * One continuous step: where each band moves to next, not where it belongs.
 *
 * `solved` is the destination the measurement worked out — absolute gains, the
 * same ones a manual run hands straight to `buildSmartEqSettings`. This walks
 * toward them instead, never past `maxTotal` in either direction, and only for
 * bands more than `deadband` out.
 *
 * The size of the walk scales with how far there is to go — see
 * `CONTINUOUS_MAX_STEP_DB`. Small errors move by the floor and are done in one
 * step; large ones close half the gap at a time and are done in three, instead
 * of inching toward something obviously broken for minutes.
 *
 * Bands the solve had nothing to say about are left exactly where they are
 * rather than pulled toward zero. Silence about a band is not evidence that it
 * should be flat, and treating it as such would undo a good correction every
 * time a passage had no energy in that region — which, over a long listen, is
 * most passages for most bands.
 *
 * `moving` is which bands were still travelling after the last call, and it is
 * what lets a correction finish. A band in that set is held to `settle` instead
 * of `deadband` — see `CONTINUOUS_SETTLE_DB`. The caller keeps the set, because
 * deriving it is trivial and exact: a band moved if its gain changed.
 */
export const stepSmartEqGains = (
  bands: IFilter[],
  solved: Record<string, number>,
  {
    maxStep = CONTINUOUS_MAX_STEP_DB,
    maxBoost = SMART_EQ_MAX_BOOST_DB,
    maxCut = SMART_EQ_MAX_CUT_DB,
    deadband = CONTINUOUS_TRIGGER_DB,
    settle = CONTINUOUS_SETTLE_DB,
    moving,
  }: {
    maxStep?: number;
    maxBoost?: number;
    maxCut?: number;
    deadband?: number;
    settle?: number;
    moving?: ReadonlySet<string>;
  } = {},
): Record<string, number> => {
  const stepped: Record<string, number> = {};
  bands.forEach((band) => {
    const destination = solved[band.id];
    const drift = destination - band.gain;
    const threshold = moving?.has(band.id) ? settle : deadband;
    if (!Number.isFinite(destination) || Math.abs(drift) < threshold) {
      stepped[band.id] = band.gain;
      return;
    }
    const step = Math.min(
      maxStep,
      Math.max(CONTINUOUS_STEP_DB, Math.abs(drift) * CONTINUOUS_STEP_FRACTION),
    );
    const move = Math.max(-step, Math.min(step, drift));
    stepped[band.id] = Math.max(-maxCut, Math.min(maxBoost, band.gain + move));
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
  /**
   * How far a band may be moved, in either direction.
   *
   * One number rather than a pair, and symmetric, because an asymmetric clamp
   * biases a correction that was centred: the anchor removes the mean and then
   * the tighter side truncates first, so what is applied carries a mean the
   * solver never asked for. See `renderer/utils/correctionLimit` for the
   * measurement that settled it and for why the default is what the old pair
   * allowed upward.
   */
  limitDb: number = SMART_EQ_MAX_BOOST_DB,
): ISmartEqSettings | undefined => {
  const filters: IFiltersMap = {};
  bands.forEach((band) => {
    const solved = gains[band.id];
    const gain = Number.isFinite(solved) ? solved : band.gain;
    filters[band.id] = {
      ...band,
      // Bounded here rather than only in the continuous stepper, so every path
      // that writes this layer is bounded — including the one-shot, which
      // accumulates onto whatever is already there now that it no longer clears
      // to flat first. Without this, pressing the button repeatedly could walk a
      // band past the ceiling one residual at a time.
      gain: Math.max(-limitDb, Math.min(limitDb, gain)),
    };
  });

  return sanitizeSmartEqSettings({ filters, ...measurement });
};

/**
 * Scale the whole layer back inside a response limit, immediately.
 *
 * The per-band clamp bounds each band and the CURVE is what the limit line
 * promises: neighbouring bells sum, so two lawful +6 bands can stack +9 into
 * the response, and a layer inherited from a wider limit can sit outside the
 * new one entirely. Walking back at the ordinary step pace leaves the plot
 * showing a curve over a line it must never cross, for minutes.
 *
 * So an out-of-bounds RESPONSE is not stepped home, it is scaled home in one
 * move. Scaling down is the one intervention that is always safe — it reduces
 * a correction that was already judged too large and can lift nothing — and
 * because every gain shrinks by the same factor, the correction keeps its
 * shape: it gets smaller, not different. Two passes, because a biquad's
 * response is only approximately proportional to its gain.
 */
export const confineSmartEqResponse = (
  gains: Record<string, number>,
  bands: IFilter[],
  limitDb: number,
): Record<string, number> => {
  if (!(limitDb > 0)) {
    return gains;
  }
  let scaled = { ...gains };
  for (let pass = 0; pass < 2; pass += 1) {
    const current = scaled;
    const filters = bands
      .filter((band) => Number.isFinite(current[band.id]))
      .map((band) => ({ ...band, gain: current[band.id] }));
    let peak = 0;
    SAMPLE_FREQUENCIES.forEach((frequency) => {
      const total = filters.reduce(
        (sum, filter) =>
          sum + gainAtFrequency(frequency, getTFCoefficients(filter)),
        0,
      );
      peak = Math.max(peak, Math.abs(total));
    });
    if (peak <= limitDb) {
      break;
    }
    const factor = limitDb / peak;
    scaled = Object.fromEntries(
      Object.entries(scaled).map(([id, gain]) => [id, gain * factor]),
    );
  }
  return scaled;
};
