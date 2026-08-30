/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  clampCrossfadeShape,
  ICrossfadeShape,
} from '../../common/dsp/crossfadeShape';

/**
 * Crossfade shapes the user drew and named.
 *
 * The same arrangement as `userPresets.ts` and for the same reasons: stored
 * whole rather than as a reference to a factory entry, kept out of the DSP
 * settings so nothing in the app can overwrite them, and not translated
 * because the user named them. They are a separate list from the EQ presets
 * because they are a separate kind of thing — one is a rack, this is a fade.
 */
export interface ISavedCrossfadeCurve {
  id: string;
  name: string;
  shape: ICrossfadeShape;
}

const STORAGE_KEY = 'fluideq.dsp.crossfadeCurves.v1';

/** Long enough to name a fade, short enough to sit in the picker. */
export const CROSSFADE_CURVE_NAME_MAX = 40;

/** What marks a curve id as the user's rather than one of the four built-ins. */
export const SAVED_CURVE_PREFIX = 'curve:';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * Everything readable out of storage, clamped on the way in.
 *
 * This is JSON from disk that an older build may have written, and a shape
 * with two handles at the same position divides by a zero-width segment inside
 * the interpolation rather than failing where it can be seen.
 */
export const readSavedCrossfadeCurves = (): ISavedCrossfadeCurve[] => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.flatMap((entry): ISavedCrossfadeCurve[] => {
      if (
        !isRecord(entry) ||
        typeof entry.id !== 'string' ||
        typeof entry.name !== 'string'
      ) {
        return [];
      }
      return [
        {
          id: entry.id,
          name: entry.name,
          shape: clampCrossfadeShape(entry.shape),
        },
      ];
    });
  } catch {
    // Unreadable storage is the same answer as none: a saved curve is a
    // convenience and losing the list must not cost the session.
    return [];
  }
};

const write = (curves: readonly ISavedCrossfadeCurve[]): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(curves));
  } catch {
    // Quota or a locked profile. The curve stays live in the panel either way,
    // which is the part the user is looking at.
  }
};

/**
 * Save under a name, replacing any curve that already has it.
 *
 * Replacing rather than appending: two entries with one name in the picker is
 * a list the user cannot use, and overwriting is what the save dialog's
 * existing-name warning already told them would happen.
 */
export const saveCrossfadeCurve = (
  name: string,
  shape: ICrossfadeShape,
): ISavedCrossfadeCurve[] => {
  const trimmed = name.trim().slice(0, CROSSFADE_CURVE_NAME_MAX);
  if (!trimmed) {
    return readSavedCrossfadeCurves();
  }
  const existing = readSavedCrossfadeCurves();
  const match = existing.find(
    (curve) => curve.name.toLowerCase() === trimmed.toLowerCase(),
  );
  const saved: ISavedCrossfadeCurve = {
    id: match?.id ?? `${SAVED_CURVE_PREFIX}${Date.now().toString(36)}`,
    name: trimmed,
    shape: clampCrossfadeShape(shape),
  };
  const next = match
    ? existing.map((curve) => (curve.id === match.id ? saved : curve))
    : [...existing, saved];
  write(next);
  return next;
};

export const deleteCrossfadeCurve = (id: string): ISavedCrossfadeCurve[] => {
  const next = readSavedCrossfadeCurves().filter((curve) => curve.id !== id);
  write(next);
  return next;
};
