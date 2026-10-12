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

/** A chain's Room copy is the chain's id with this after it (`QUICK_DSP_PRESETS`). */
const ROOM_COPY = '-room';

/**
 * The starred presets in the order of their names as they read in `locale`,
 * whatever order they were starred in, and a chain's Room copy straight after
 * the chain when both are starred (Ivan, 2026-10-12: "sorted always by name
 * and if they have room next to normal" — Gaming, Gaming · Room, then Gaming
 * · Competitive, which by name alone would have come between them). Both
 * pickers list them this way, and their arrows walk them in it. Numbers in a
 * name count as numbers, and case and accents do not part two names.
 */
export const sortFavouritesByName = <T extends { id: string; name: string }>(
  presets: readonly T[],
  locale: string,
): T[] => {
  const collator = new Intl.Collator(locale, {
    sensitivity: 'base',
    numeric: true,
  });
  const byName = [...presets].sort((one, other) =>
    collator.compare(one.name, other.name),
  );
  const ids = new Set(byName.map((preset) => preset.id));
  const isPlacedCopy = (preset: T) =>
    preset.id.endsWith(ROOM_COPY) &&
    ids.has(preset.id.slice(0, -ROOM_COPY.length));
  return byName.flatMap((preset) => {
    if (isPlacedCopy(preset)) {
      return [];
    }
    const copy = byName.find((one) => one.id === `${preset.id}${ROOM_COPY}`);
    return copy ? [preset, copy] : [preset];
  });
};
