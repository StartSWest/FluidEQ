/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A session-long cache that lets go of what nobody has used for longest.
 *
 * For the module-level maps keyed by something a person keeps producing — a
 * search typed, a song opened, a picture dropped. One entry each for as long as
 * the window is open is a slow leak however small each entry is, and some of
 * these entries are a decoded picture or a page of server results. A `Map`
 * keeps insertion order, so re-inserting an entry whenever it is written or
 * read makes that order a recency order, and the first key is the one to let
 * go: the same arithmetic as the list views' remembered places
 * (`LibraryListView.tsx`).
 *
 * Only for maps that never hold `undefined` as a value: `recallRecent` cannot
 * tell one from a missing entry, and leaves it where it is.
 */

/** Writes `value` as the newest entry, and lets the oldest go past `limit`. */
export const rememberRecent = <K, V>(
  map: Map<K, V>,
  key: K,
  value: V,
  limit: number,
): void => {
  map.delete(key);
  map.set(key, value);
  if (map.size > limit) {
    const oldest = map.keys().next();
    if (!oldest.done) {
      map.delete(oldest.value);
    }
  }
};

/** Reads an entry, and makes it the newest. */
export const recallRecent = <K, V>(map: Map<K, V>, key: K): V | undefined => {
  const value = map.get(key);
  if (value !== undefined) {
    map.delete(key);
    map.set(key, value);
  }
  return value;
};
