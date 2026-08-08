/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
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
 * Detail's promise, enforced where it can be seen rather than only in the maths.
 *
 * Detail exists to open up the mids and highs *without touching the bottom*.
 * The solver already refuses to fund that by cutting the bass — it anchors
 * there instead of on loudness — but nothing stopped it lifting the bass either,
 * and a mode that quietly adds low end is not the mode it says it is.
 *
 * So in Detail the bass floor goes to the top of the plot. The trace cannot get
 * above it, no boost is ever allowed there, and the reason is visible: the red
 * line is sitting at the ceiling of the bass band.
 */
const DETAIL_BASS_CEILING_HZ = 150;

const marginsFor = (mode: TSmartEqMode, centreFrequency: number) => {
  if (mode === 'detail' && centreFrequency <= DETAIL_BASS_CEILING_HZ) {
    return { floor: -99, ramp: 0 };
  }
  return MODE_MARGINS[mode] ?? MODE_MARGINS.smart;
};

const clampDb = (db: number) =>
  Math.max(PRESENCE_MIN_DB, Math.min(PRESENCE_MAX_DB, db));

export const defaultThresholdDb = (
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
 * Keyed by mode, range and edge, because each mode keeps its own pair.
 *
 * Dragging a line in Target says something about Target. Detail has a different
 * appetite for correction and a different promise to keep, and inheriting a
 * number set for another mode would break both quietly.
 */
const STORAGE_KEY = 'fluideq.presenceLines';

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
          value >= PRESENCE_MIN_DB &&
          value <= PRESENCE_MAX_DB,
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

/** The stored line for one edge of one range in one mode, or its default. */
export const getPresenceLine = (
  edge: TPresenceEdge,
  label: string,
  centreFrequency: number,
  mode: TSmartEqMode = getSmartEqMode(),
): number => {
  const stored = lines[keyOf(mode, label, edge)];
  return stored === undefined
    ? defaultThresholdDb(edge, mode, centreFrequency)
    : stored;
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
  mode: TSmartEqMode = getSmartEqMode(),
) => {
  const next = clampDb(db);
  const otherEdge: TPresenceEdge = edge === 'floor' ? 'full' : 'floor';
  const other = getPresenceLine(otherEdge, label, centreFrequency, mode);

  const pushed =
    edge === 'floor'
      ? Math.max(other, next + PRESENCE_MIN_GAP_DB)
      : Math.min(other, next - PRESENCE_MIN_GAP_DB);

  const update: TLines = {
    ...lines,
    [keyOf(mode, label, edge)]: next,
    [keyOf(mode, label, otherEdge)]: clampDb(pushed),
  };
  lines = update;
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
  mode: TSmartEqMode = getSmartEqMode(),
) => {
  const floor = getPresenceLine('floor', label, centreFrequency, mode);
  const full = getPresenceLine('full', label, centreFrequency, mode);
  const room = Math.max(
    PRESENCE_MIN_DB - floor,
    Math.min(PRESENCE_MAX_DB - full, deltaDb),
  );
  if (room === 0) {
    return;
  }
  lines = {
    ...lines,
    [keyOf(mode, label, 'floor')]: floor + room,
    [keyOf(mode, label, 'full')]: full + room,
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
