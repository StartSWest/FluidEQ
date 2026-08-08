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

import { useSyncExternalStore } from 'react';
import { MAX_GAIN, MIN_GAIN } from 'common/constants';
import { REFERENCE_SLOPE_DB_PER_DECADE } from 'common/referenceCurve';

/**
 * The line under which a range is not playing, and so is not corrected.
 *
 * WHAT THIS FIXES. A region is currently measured if it sits within 45 dB of
 * the frame's peak, which a solo passage passes easily — so a guitar intro with
 * no bass instrument in it reads as a record with no bass, and the correction
 * answers by boosting. Measured on a synthetic solo guitar, every mode drove
 * 40 Hz and 50 Hz to +6 dB, their hard limit, where the same material inside a
 * full mix is CUT by two to four. Nine decibels wrong, in the worst direction,
 * pinned at the cap.
 *
 * The gate cannot simply be tightened. Music's own tilt spans about 25 dB
 * across the band, so a threshold tight enough to catch a missing bass guitar
 * throws away the genuine air of acoustic material. There is no single number
 * against the frame peak that separates "quiet because nothing is playing
 * there" from "quiet because that is what this range does".
 *
 * So the line is per range, and it is drawn where it can be seen and moved. The
 * plot already shows the live output against a track-referenced axis —
 * `trackReferenceDb` follows the record with instant attack and slow release,
 * so the trace does not move when somebody touches the volume. A fixed height
 * on that axis therefore already means "this far below what this record has
 * been doing", which is exactly the question, and it survives a volume change.
 * An absolute dBFS threshold would not.
 *
 * ONLY BOOSTS ARE WITHHELD BELOW THE LINE. Cutting a range that was barely
 * heard is harmless — it takes away something nobody could hear anyway. It is
 * the boosts that run away, because a range with no signal in it reports a
 * deficit forever and nothing arrives to contradict it.
 */

/** Chart decibels, which is the axis the live trace is drawn against. */
export const PRESENCE_MIN_DB = MIN_GAIN;
export const PRESENCE_MAX_DB = MAX_GAIN;

/**
 * How far below typical programme a range may fall before it is called absent.
 *
 * Wide enough that no part of a full mix ever dips under its own line during
 * ordinary playing, narrow enough that an instrument dropping out clearly does.
 * Twelve is a starting point rather than a discovery, and it is the number the
 * draggable lines exist to let somebody disagree with.
 */
export const PRESENCE_MARGIN_DB = 12;

/**
 * Where music's own tilt puts a range, before the margin is taken off.
 *
 * Defaulting every range to the same height would be wrong by the width of the
 * tilt: the same line that sits under the bass would sit well above the air,
 * and the top of the spectrum would be declared absent on every record ever
 * made. So the default follows the slope the reference already believes music
 * has, anchored where programme is loudest.
 */
const PROGRAMME_PEAK_HZ = 80;

export const defaultThresholdDb = (centreFrequency: number): number => {
  if (!(centreFrequency > 0)) {
    return PRESENCE_MIN_DB;
  }
  const expected =
    PRESENCE_MAX_DB +
    REFERENCE_SLOPE_DB_PER_DECADE *
      Math.log10(centreFrequency / PROGRAMME_PEAK_HZ);
  return Math.max(
    PRESENCE_MIN_DB,
    Math.min(
      PRESENCE_MAX_DB,
      Math.round((expected - PRESENCE_MARGIN_DB) * 10) / 10,
    ),
  );
};

const STORAGE_KEY = 'fluideq.presenceThresholds';

/** Keyed by range label, because that is what the report and the plot share. */
type TThresholds = Record<string, number>;

const read = (): TThresholds => {
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

let thresholds: TThresholds = read();

const listeners = new Set<() => void>();

const notify = () => {
  listeners.forEach((listener) => listener());
};

const persist = () => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(thresholds));
  } catch {
    // Not worth failing a drag over.
  }
};

export const getPresenceThresholds = (): TThresholds => thresholds;

/** The stored line for a range, or where its default puts it. */
export const getPresenceThreshold = (
  label: string,
  centreFrequency: number,
): number =>
  thresholds[label] === undefined
    ? defaultThresholdDb(centreFrequency)
    : thresholds[label];

export const setPresenceThreshold = (label: string, db: number) => {
  const next = Math.max(PRESENCE_MIN_DB, Math.min(PRESENCE_MAX_DB, db));
  if (thresholds[label] === next) {
    return;
  }
  thresholds = { ...thresholds, [label]: next };
  persist();
  notify();
};

/**
 * One range back to its default, which is what a double click on it means.
 *
 * Deleting the entry rather than writing the default back, so a range that was
 * never touched and one that was put back are the same thing afterwards — and
 * so a later change to how defaults are derived reaches both.
 */
export const resetPresenceThreshold = (label: string) => {
  if (thresholds[label] === undefined) {
    return;
  }
  const next = { ...thresholds };
  delete next[label];
  thresholds = next;
  persist();
  notify();
};

/** All of them, for when somebody has dragged themselves into a hole. */
export const resetPresenceThresholds = () => {
  if (Object.keys(thresholds).length === 0) {
    return;
  }
  thresholds = {};
  persist();
  notify();
};

export const usePresenceThresholds = (): TThresholds =>
  useSyncExternalStore(
    (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => thresholds,
    () => thresholds,
  );
