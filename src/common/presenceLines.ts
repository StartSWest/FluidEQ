/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { MAX_GAIN, MIN_GAIN } from './constants';
import { REFERENCE_SLOPE_DB_PER_DECADE } from './referenceCurve';
import type { TSmartEqMode } from './smartEqMode';

/**
 * How much signal a range must show before its correction is trusted.
 *
 * WHAT THIS FIXES. A range is measured if it sits within 45 dB of the frame
 * peak, which a solo passage clears easily — so a guitar intro with no bass
 * instrument in it reads as a record with no bass, and the correction answers
 * by boosting. Measured on a synthetic solo guitar, every mode drove 40 Hz and
 * 50 Hz to +6 dB, their hard limit, where the same material inside a full mix
 * is CUT by two to four. Nine decibels wrong, in the worst direction, pinned at
 * the cap.
 *
 * The gate cannot simply be tightened. Music's own tilt spans about 25 dB, so a
 * threshold tight enough to catch a missing bass guitar throws away the genuine
 * air of acoustic material. No single number against the frame peak separates
 * "quiet because nothing is playing there" from "quiet because that is what
 * this range does".
 *
 * TWO LINES, NOT ONE, AND THE GAP BETWEEN THEM IS THE POINT.
 *
 *   floor — below it the range is not playing. No boost, ever.
 *   full  — above it the range has shown enough of itself to be trusted with
 *           the whole correction.
 *
 * Between them the allowance ramps. A single line would be a cliff, and a cliff
 * in audio is a thing you can hear: when the drums enter, the bass crosses the
 * line and wobbles either side of it for a second, switching the correction on
 * and off with it. Everything else in this measurement already fades for the
 * same reason — the frame weighting, the region gate, the evidence decay.
 *
 * The ramp is also the honest rule. A range barely above its floor has barely
 * any signal in it, and was never worth six decibels of trust; the allowance
 * now follows how much evidence there actually is.
 *
 * ONLY BOOSTS ARE WITHHELD. Cutting a range that was barely heard takes away
 * something nobody could hear anyway. Boosts are what run away, because a range
 * with no signal in it reports a deficit forever and nothing arrives to
 * contradict it, and boosts are what cost headroom.
 *
 * WHAT THE COLOURS MEAN NEVER CHANGES. Red is the floor and green is full
 * trust, in every mode. The mode moves the lines; it does not redefine them.
 * Colour that means one thing in Detail and another in Target is a graph that
 * has to be re-read every time somebody switches, which is the opposite of a
 * thing you can glance at.
 */

/** Chart decibels, which is the axis the live trace is drawn against. */
export const PRESENCE_MIN_DB = MIN_GAIN;
export const PRESENCE_MAX_DB = MAX_GAIN;

/** The two edges of the ramp. */
export type TPresenceEdge = 'floor' | 'full';

/**
 * Where music's own tilt puts a range, before any margin is taken off.
 *
 * One height for every range would be wrong by the width of the tilt: a line
 * that sits under the bass sits well above the air, and the top of the spectrum
 * would be called absent on every record ever made. So the defaults follow the
 * slope the reference already believes music has, anchored where programme is
 * loudest.
 */
const PROGRAMME_PEAK_HZ = 80;

const expectedLevelDb = (centreFrequency: number): number =>
  PRESENCE_MAX_DB +
  REFERENCE_SLOPE_DB_PER_DECADE *
    Math.log10(centreFrequency / PROGRAMME_PEAK_HZ);

/**
 * How far each mode lets a range fall before disbelieving it, and how long it
 * takes to believe it again.
 *
 * A bigger margin puts the floor lower, so the mode corrects more readily. A
 * wider ramp spreads the two lines apart, so trust arrives more gradually.
 *
 * The ladder matches what the modes are for. The one-shot is a repair somebody
 * asked for once and cannot take back on the next pass, so it is the most
 * cautious: high floor, wide ramp. Target promises that every record arrives at
 * the same signature, which it cannot do while declining to correct, so its
 * lines sit low and close together.
 */
const MODE_MARGINS: Record<TSmartEqMode, { floor: number; ramp: number }> = {
  smart: { floor: 10, ramp: 14 },
  detail: { floor: 12, ramp: 10 },
  balance: { floor: 12, ramp: 10 },
  target: { floor: 15, ramp: 8 },
};

/**
 * Detail is merely stricter about the bass, no longer deaf to it.
 *
 * The first version pinned the bass floor to the ceiling of the plot — no
 * boost, ever — on the argument that a mode promising "without touching the
 * bottom" should be seen to keep it. That over-reached: the promise is about
 * not CUTTING the bass to fund the lift, and the anchor already keeps it. An
 * outright wall meant a genuine bass resonance dip could never be repaired in
 * Detail at all, which read as the mode being broken in its lowest two bands.
 *
 * So the bass keeps a tighter margin than the rest of the spectrum — its floor
 * sits four decibels higher, its ramp is wider — and earns correction the same
 * way everything else does, just more slowly and on stronger evidence.
 */
const DETAIL_BASS_CEILING_HZ = 150;
const DETAIL_BASS_MARGINS = { floor: 8, ramp: 12 };

const marginsFor = (mode: TSmartEqMode, centreFrequency: number) => {
  if (mode === 'detail' && centreFrequency <= DETAIL_BASS_CEILING_HZ) {
    return DETAIL_BASS_MARGINS;
  }
  return MODE_MARGINS[mode] ?? MODE_MARGINS.smart;
};

export const clampPresenceDb = (db: number) =>
  Math.max(PRESENCE_MIN_DB, Math.min(PRESENCE_MAX_DB, db));

/**
 * How far the automatic placement may come DOWN from the tilt model, and no
 * further, ever.
 *
 * Without a bound, a follower always ends up in the dangerous direction. Down
 * is the dangerous direction: the lower a floor sits, the more readily a range
 * counts as present, and the bottom of that is boosting silence again — the
 * original fault in slow motion, which is worse than the original fault because
 * it takes minutes to appear instead of seconds. There is always a quieter
 * record than the last one, so an unbounded follower gets there eventually.
 *
 * What separates the two cases is not the range's history but how far it sits
 * under the rest of the record. Fifteen decibels below expectation is quiet and
 * real — an acoustic record with modest bass. Forty-five is not there at all.
 * Eight decibels of travel reaches the first and cannot reach the second: a
 * genuinely light record pulls its floor down over a couple of minutes and gets
 * corrected, while a range that truly is absent sits twenty or thirty decibels
 * below a floor it will never meet however long it plays.
 *
 * It comes from the tilt model rather than being written per range, which is
 * what makes one number right at every frequency: the model already knows the
 * air lives lower than the bass, so "a bit quieter than usual" is the same
 * eight decibels in both.
 *
 * Upward is unbounded back to the model and no further. That direction only
 * ever corrects less, so nothing needs protecting from it — but neither is
 * there a reason to let a loud record raise its own bar.
 */
export const PRESENCE_AUTO_TRAVEL_DB = 8;

/** Where the tilt model alone puts an edge, before the music is consulted. */
export const modelThresholdDb = (
  edge: TPresenceEdge,
  mode: TSmartEqMode,
  centreFrequency: number,
): number => {
  if (!(centreFrequency > 0)) {
    return edge === 'floor' ? PRESENCE_MIN_DB : PRESENCE_MAX_DB;
  }
  const { floor, ramp } = marginsFor(mode, centreFrequency);
  const floorDb = expectedLevelDb(centreFrequency) - floor;
  return clampPresenceDb(
    Math.round((edge === 'floor' ? floorDb : floorDb + ramp) * 10) / 10,
  );
};

/**
 * Where a line places itself, given what this range typically does.
 *
 * The model says where music of this kind usually sits; the measurement says
 * where THIS record sits. Following the measurement is what stops a range that
 * is real but modest waiting forever to be heard, and the bound above is what
 * stops the same mechanism talking itself into believing silence.
 *
 * With no measurement yet it is the model, which is also what every test and
 * every synthetic frame sees.
 */
export const defaultThresholdDb = (
  edge: TPresenceEdge,
  mode: TSmartEqMode,
  centreFrequency: number,
  typicalDb?: number,
): number => {
  const model = modelThresholdDb(edge, mode, centreFrequency);
  if (typicalDb === undefined || !Number.isFinite(typicalDb)) {
    return model;
  }
  const { floor } = marginsFor(mode, centreFrequency);
  // The floor is what tracks; the full line rides above it at the mode's own
  // ramp width, so the gap somebody has judged does not change underneath them.
  const trackedFloor = typicalDb - floor;
  const modelFloor = modelThresholdDb('floor', mode, centreFrequency);
  const bounded = Math.max(
    modelFloor - PRESENCE_AUTO_TRAVEL_DB,
    Math.min(modelFloor, trackedFloor),
  );
  return clampPresenceDb(
    Math.round((bounded + (model - modelFloor)) * 10) / 10,
  );
};

/**
 * Where somebody has moved the lines, keyed by mode, range and edge, because
 * each mode keeps its own pair.
 *
 * Dragging a line in Target says something about Target. Detail has a different
 * appetite for correction and a different promise to keep, and inheriting a
 * number set for another mode would break both quietly.
 *
 * The window keeps them (`renderer/utils/presenceThreshold.ts`) and hands the
 * core a copy, which measures with them.
 */
export type TPresenceOffsets = Record<string, number>;

export const presenceKey = (
  mode: TSmartEqMode,
  label: string,
  edge: TPresenceEdge,
) => `${mode}:${label}:${edge}`;

/**
 * Stored offsets, keeping only what can be one.
 *
 * Anything that is not a number in range is dropped rather than trusted: a
 * stored NaN would silently disable the gate for that range.
 */
export const parsePresenceOffsets = (raw: unknown): TPresenceOffsets => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).filter(
      ([, value]) =>
        typeof value === 'number' &&
        Number.isFinite(value) &&
        // A displacement, so it spans the axis in both directions.
        value >= PRESENCE_MIN_DB - PRESENCE_MAX_DB &&
        value <= PRESENCE_MAX_DB - PRESENCE_MIN_DB,
    ) as Array<[string, number]>,
  );
};

/**
 * Where a line is: the automatic placement, plus whatever somebody moved it by.
 *
 * AN OFFSET, NOT A POSITION, and that is the point of it. Stored as an absolute
 * the two halves of what was asked for would fight: a line that follows the
 * music cannot also be a line that stays where it was put. As a displacement
 * they compose — the automatic part keeps tracking the record, and the drag
 * keeps meaning "and a bit lower than that", which is what somebody adjusting
 * it actually intends.
 *
 * So the reset is not "back to a number" but "back to automatic", which is a
 * better thing for that button to mean.
 */
export const presenceLineAt = (
  offsets: TPresenceOffsets,
  mode: TSmartEqMode,
  edge: TPresenceEdge,
  label: string,
  centreFrequency: number,
  typicalDb?: number,
): number => {
  const auto = defaultThresholdDb(edge, mode, centreFrequency, typicalDb);
  const offset = offsets[presenceKey(mode, label, edge)] ?? 0;
  return clampPresenceDb(auto + offset);
};

/**
 * How much of a boost a range has earned, from 0 to 1.
 *
 * The single number the detector needs, and the only place the ramp is
 * described in maths rather than in pixels. At or below the floor it is zero,
 * so nothing can be lifted; at or above the full line it is one.
 */
export const presenceAllowance = (
  levelDb: number,
  floorDb: number,
  fullDb: number,
): number => {
  if (!Number.isFinite(levelDb)) {
    return 0;
  }
  if (levelDb <= floorDb) {
    return 0;
  }
  if (fullDb <= floorDb || levelDb >= fullDb) {
    return 1;
  }
  return (levelDb - floorDb) / (fullDb - floorDb);
};

/** A range as the measurement knows it: its name, centre and levels. */
export interface IPresenceRange {
  label: string;
  centreFrequency: number;
  /** Where the range is now. */
  liveDb: number;
  /** Where it usually is, which the automatic lines follow. */
  typicalDb?: number;
}

/** How much boost a range has earned right now, between its two lines. */
export const rangeAllowance = (
  offsets: TPresenceOffsets,
  mode: TSmartEqMode,
  range: IPresenceRange,
): number =>
  presenceAllowance(
    range.liveDb,
    presenceLineAt(
      offsets,
      mode,
      'floor',
      range.label,
      range.centreFrequency,
      range.typicalDb,
    ),
    presenceLineAt(
      offsets,
      mode,
      'full',
      range.label,
      range.centreFrequency,
      range.typicalDb,
    ),
  );
