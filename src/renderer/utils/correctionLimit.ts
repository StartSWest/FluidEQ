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
import { MAX_GAIN } from 'common/constants';
import { SMART_EQ_MAX_BOOST_DB } from 'common/smartEq';

/**
 * How far Smart EQ may move any band, in either direction.
 *
 * SYMMETRIC, AND THAT IS A FIX RATHER THAN A SIMPLIFICATION. The limits were
 * +6 up and −9 down, on the sound reasoning that a boost costs headroom and a
 * cut does not. What that reasoning missed is what asymmetry does to a
 * correction that is centred: the anchor subtracts the weighted mean so no pass
 * changes the level, and then the clamps truncate the positive side three
 * decibels sooner than the negative one. What is actually applied therefore has
 * a negative mean even though what was asked for did not.
 *
 * A fraction of a decibel per pass, always downward, invisible in any single
 * one of them. A two-hundred-pass simulation over four records measured where
 * that ends up: the level sinks, and in the fixed-slope modes the spread walks
 * outward until it reaches exactly fifteen decibels — six plus nine — with a
 * band pinned against each rail and the layer no longer following the record at
 * all. See `smartEqDrift.test.ts`, which records both.
 *
 * Symmetric limits cannot introduce that bias, whatever value they take.
 *
 * ONE NUMBER FOR BOTH DIRECTIONS, chosen by whoever is listening. Six is the
 * default and is what the asymmetric pair allowed upward, so nothing gets
 * louder by default. Twenty is the most Equalizer APO will build from a single
 * band, and somebody who asks for it has asked for it.
 */

export const MIN_CORRECTION_LIMIT_DB = 1;
export const MAX_CORRECTION_LIMIT_DB = MAX_GAIN;
export const DEFAULT_CORRECTION_LIMIT_DB = SMART_EQ_MAX_BOOST_DB;

const STORAGE_KEY = 'fluideq.correctionLimit';

const clampLimit = (db: number) =>
  Math.max(MIN_CORRECTION_LIMIT_DB, Math.min(MAX_CORRECTION_LIMIT_DB, db));

const read = (): number => {
  try {
    const stored = Number(window.localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(stored) && stored > 0
      ? clampLimit(stored)
      : DEFAULT_CORRECTION_LIMIT_DB;
  } catch {
    return DEFAULT_CORRECTION_LIMIT_DB;
  }
};

let limitDb = read();

const listeners = new Set<() => void>();

export const getCorrectionLimit = () => limitDb;

export const setCorrectionLimit = (db: number) => {
  const next = Math.round(clampLimit(db) * 10) / 10;
  if (next === limitDb) {
    return;
  }
  limitDb = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(next));
  } catch {
    // Not worth failing a drag over.
  }
  listeners.forEach((listener) => listener());
};

export const useCorrectionLimit = (): number =>
  useSyncExternalStore(
    (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => limitDb,
    () => limitDb,
  );
