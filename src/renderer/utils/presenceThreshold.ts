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
import {
  type TPresenceEdge,
  type TPresenceOffsets,
  PRESENCE_MAX_DB,
  PRESENCE_MIN_DB,
  clampPresenceDb as clampDb,
  defaultThresholdDb,
  parsePresenceOffsets,
  presenceKey as keyOf,
  presenceLineAt,
} from 'common/presenceLines';
import { TSmartEqMode, getSmartEqMode } from './smartEqMode';

/**
 * Where somebody has dragged the presence lines on the plot, and the drags
 * that move them. What the lines are, and where they place themselves, is
 * `common/presenceLines.ts`, which the core measures with too.
 */
export { presenceAllowance } from 'common/presenceLines';

// Renamed with the change from positions to displacements. An old absolute
// read as an offset would be nonsense — a line stored at -15 would become
// fifteen decibels BELOW wherever the music put it — and there is no way to
// tell the two apart from the number alone, so the safe migration is not to
// attempt one.
const STORAGE_KEY = 'fluideq.presenceOffsets';

const read = (): TPresenceOffsets => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? parsePresenceOffsets(JSON.parse(stored)) : {};
  } catch {
    return {};
  }
};

let lines: TPresenceOffsets = read();

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

/** Where a line is, in the mode chosen unless another is named. */
export const getPresenceLine = (
  edge: TPresenceEdge,
  label: string,
  centreFrequency: number,
  typicalDb?: number,
  mode: TSmartEqMode = getSmartEqMode(),
): number =>
  presenceLineAt(lines, mode, edge, label, centreFrequency, typicalDb);

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

export const usePresenceLines = (): TPresenceOffsets =>
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
