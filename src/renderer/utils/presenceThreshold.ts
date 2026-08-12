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

import { useSyncExternalStore } from 'react';
import { MAX_GAIN, MIN_GAIN } from 'common/constants';
import { REFERENCE_SLOPE_DB_PER_DECADE } from 'common/referenceCurve';
import { TSmartEqMode, getSmartEqMode } from './smartEqMode';

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

const clampDb = (db: number) =>
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
  return clampDb(
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
  return clampDb(Math.round((bounded + (model - modelFloor)) * 10) / 10);
};

/**
 * Keyed by mode, range and edge, because each mode keeps its own pair.
 *
 * Dragging a line in Target says something about Target. Detail has a different
 * appetite for correction and a different promise to keep, and inheriting a
 * number set for another mode would break both quietly.
 */
// Renamed with the change from positions to displacements. An old absolute
// read as an offset would be nonsense — a line stored at -15 would become
// fifteen decibels BELOW wherever the music put it — and there is no way to
// tell the two apart from the number alone, so the safe migration is not to
// attempt one.
const STORAGE_KEY = 'fluideq.presenceOffsets';

const keyOf = (mode: TSmartEqMode, label: string, edge: TPresenceEdge) =>
  `${mode}:${label}:${edge}`;

type TLines = Record<string, number>;

const read = (): TLines => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return {};
    }
    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }
    // Anything that is not a number in range is dropped rather than trusted: a
    // stored NaN would silently disable the gate for that range.
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        ([, value]) =>
          typeof value === 'number' &&
          Number.isFinite(value) &&
          // A displacement, so it spans the axis in both directions.
          value >= PRESENCE_MIN_DB - PRESENCE_MAX_DB &&
          value <= PRESENCE_MAX_DB - PRESENCE_MIN_DB,
      ) as Array<[string, number]>,
    );
  } catch {
    return {};
  }
};

let lines: TLines = read();

const listeners = new Set<() => void>();

const notify = () => {
  listeners.forEach((listener) => listener());
};

const persist = () => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    // Not worth failing a drag over.
  }
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
export const getPresenceLine = (
  edge: TPresenceEdge,
  label: string,
  centreFrequency: number,
  typicalDb?: number,
  mode: TSmartEqMode = getSmartEqMode(),
): number => {
  const auto = defaultThresholdDb(edge, mode, centreFrequency, typicalDb);
  const offset = lines[keyOf(mode, label, edge)] ?? 0;
  return clampDb(auto + offset);
};

/**
 * Move one line, pushing the other out of the way rather than letting them
 * cross.
 *
 * Inverted lines have no meaning — "full trust below, nothing above" is not a
 * rule anybody could want — and a drag that silently produces one is a drag
 * that produces nonsense. So the other edge is carried along, keeping the
 * minimum gap that stops the ramp collapsing into the cliff it replaced.
 */
export const PRESENCE_MIN_GAP_DB = 2;

export const setPresenceLine = (
  edge: TPresenceEdge,
  label: string,
  db: number,
  centreFrequency: number,
  typicalDb?: number,
  mode: TSmartEqMode = getSmartEqMode(),
) => {
  const next = clampDb(db);
  const otherEdge: TPresenceEdge = edge === 'floor' ? 'full' : 'floor';
  const other = getPresenceLine(
    otherEdge,
    label,
    centreFrequency,
    typicalDb,
    mode,
  );

  const pushed =
    edge === 'floor'
      ? Math.max(other, next + PRESENCE_MIN_GAP_DB)
      : Math.min(other, next - PRESENCE_MIN_GAP_DB);

  // Stored as displacements from where the automatic placement puts each edge,
  // so the line keeps following the record after it has been adjusted. Writing
  // the absolute would freeze it, which is exactly the half of the behaviour a
  // drag is not meant to destroy.
  const autoOf = (which: TPresenceEdge) =>
    defaultThresholdDb(which, mode, centreFrequency, typicalDb);

  lines = {
    ...lines,
    [keyOf(mode, label, edge)]: next - autoOf(edge),
    [keyOf(mode, label, otherEdge)]: clampDb(pushed) - autoOf(otherEdge),
  };
  persist();
  notify();
};

/**
 * One range back to its defaults, which is what a double click means.
 *
 * Both edges together — putting back only the one under the pointer would leave
 * a pair that was never designed as a pair. Deleting the entries rather than
 * writing the defaults in, so a range nobody touched and one that was reset are
 * the same thing afterwards, and a later change to how defaults are derived
 * reaches both.
 */
export const resetPresenceRange = (
  label: string,
  mode: TSmartEqMode = getSmartEqMode(),
) => {
  const floorKey = keyOf(mode, label, 'floor');
  const fullKey = keyOf(mode, label, 'full');
  if (lines[floorKey] === undefined && lines[fullKey] === undefined) {
    return;
  }
  const next = { ...lines };
  delete next[floorKey];
  delete next[fullKey];
  lines = next;
  persist();
  notify();
};

/**
 * Slide both lines together, keeping the gap between them.
 *
 * Dragging the pair is a different intention from dragging either edge, and it
 * is the commoner one: the gap says how gradually a range earns its correction,
 * and having decided that, moving it up or down is a single thought — "trust
 * this range less" — that should not cost two drags and a subtraction to keep
 * the width the same.
 *
 * Clamped as a pair rather than one at a time. Clamping each edge separately
 * would let the leading one hit the ceiling while the other kept coming, so the
 * gap would silently close on the way up and never reopen on the way down.
 */
export const movePresenceRange = (
  label: string,
  deltaDb: number,
  centreFrequency: number,
  typicalDb?: number,
  mode: TSmartEqMode = getSmartEqMode(),
) => {
  const floor = getPresenceLine(
    'floor',
    label,
    centreFrequency,
    typicalDb,
    mode,
  );
  const full = getPresenceLine('full', label, centreFrequency, typicalDb, mode);
  const room = Math.max(
    PRESENCE_MIN_DB - floor,
    Math.min(PRESENCE_MAX_DB - full, deltaDb),
  );
  if (room === 0) {
    return;
  }
  // Added to the existing displacement rather than written as a position, so
  // both lines go on tracking the record after the pair has been moved.
  lines = {
    ...lines,
    [keyOf(mode, label, 'floor')]:
      (lines[keyOf(mode, label, 'floor')] ?? 0) + room,
    [keyOf(mode, label, 'full')]:
      (lines[keyOf(mode, label, 'full')] ?? 0) + room,
  };
  persist();
  notify();
};

/**
 * Whether this range has been moved in this mode, so nothing offers a dead
 * reset.
 *
 * Per range AND per mode, which is the same separation the store itself keeps.
 * A range dragged in Target has nothing to say about the same range in Detail:
 * those modes want different things from it, which is why they hold different
 * numbers, and a reset that crossed the boundary would undo work in one mode to
 * tidy another.
 */
export const hasCustomPresenceRange = (
  label: string,
  mode: TSmartEqMode = getSmartEqMode(),
): boolean =>
  lines[keyOf(mode, label, 'floor')] !== undefined ||
  lines[keyOf(mode, label, 'full')] !== undefined;

/** Every mode at once, for a preferences-level "put it all back". */
export const resetPresenceLines = () => {
  if (Object.keys(lines).length === 0) {
    return;
  }
  lines = {};
  persist();
  notify();
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

export const usePresenceLines = (): TLines =>
  useSyncExternalStore(
    (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => lines,
    () => lines,
  );
