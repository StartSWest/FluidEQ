/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The rack presets the listener starred, which the picker files first.
 *
 * Ids only, factory and saved alike, in the order they were starred. Kept
 * beside the saved presets rather than in the DSP settings for the same
 * reason those are: nothing that replaces the rack — a preset, Reset, an
 * import — may take them with it. An id that no longer names anything (a
 * saved preset since deleted, a factory one retired) is simply never shown;
 * it is dropped the next time the list is written.
 */

const STORAGE_KEY = 'fluideq.dsp.favouritePresets.v1';
export const DSP_PRESETS_CHANGED = 'fluideq-dsp-presets-changed';
export const DEFAULT_DSP_FAVOURITES = [
  'balanced',
  'warm',
  'punch',
  'gaming',
  'movie',
  'podcast',
];

/** More than anyone will star, and a bound on what storage can hand back. */
const FAVOURITES_MAX = 64;

export const readFavouriteDspPresets = (): string[] => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return [...DEFAULT_DSP_FAVOURITES];
    }
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return [
      ...new Set(
        parsed.filter(
          (id): id is string => typeof id === 'string' && id !== '',
        ),
      ),
    ].slice(0, FAVOURITES_MAX);
  } catch {
    // Unreadable storage is the same answer as none: a star is a convenience
    // and losing the list must not cost the session.
    return [];
  }
};

/**
 * Star `id`, or take its star away; the list as it now stands. `known` is
 * every id the picker can show, so the stars of presets that are gone go
 * with this write.
 */
export const toggleFavouriteDspPreset = (
  id: string,
  known: readonly string[],
): string[] => {
  const current = readFavouriteDspPresets().filter((one) =>
    known.includes(one),
  );
  let next = current;
  if (current.includes(id)) {
    next = current.filter((one) => one !== id);
  } else if (known.includes(id)) {
    next = [...current, id].slice(-FAVOURITES_MAX);
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Quota or a locked profile. The star still shows for this visit, which
    // is the part the listener is looking at.
  }
  window.dispatchEvent(new Event(DSP_PRESETS_CHANGED));
  return next;
};
