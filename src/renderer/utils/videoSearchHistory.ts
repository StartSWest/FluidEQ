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
import { forgetSearch, rememberSearch } from 'common/searchHistory';

/**
 * The searches this machine has made, kept across restarts.
 *
 * Storage and subscriptions only — the ordering and matching rules live in
 * `common/searchHistory`, where they can be tested without a browser.
 *
 * A module store rather than component state because the list has to outlive
 * the input: the Video tab stays mounted but hidden while somebody is moving
 * bands, and a `useState` inside the search box would still be there, but a
 * store is also what lets the history survive the tab being rebuilt.
 *
 * Local to this machine, and never sent anywhere. It is a list of what somebody
 * has played, which is exactly the sort of thing the bug reporter is careful
 * not to include.
 */
const STORAGE_KEY = 'fluideq.videoSearchHistory';

const listeners = new Set<() => void>();

/**
 * Read what was stored, defensively.
 *
 * Anything in localStorage is user-editable and survives across versions, so
 * this treats it as untrusted input: a non-array, or an array with numbers in
 * it, becomes an empty history rather than a crash on the first render of the
 * tab.
 */
const readStored = (): string[] => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (entry): entry is string => typeof entry === 'string' && entry.length > 0,
    );
  } catch {
    // Unavailable or malformed. An empty history costs a little typing.
    return [];
  }
};

let history: string[] = readStored();

const publish = (next: string[]) => {
  history = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // Not worth failing a search over; it just will not be there next time.
  }
  listeners.forEach((listener) => listener());
};

/** Note a search that was actually run. */
export const addSearchToHistory = (term: string) => {
  const next = rememberSearch(history, term);
  // Identity is the signal `useSyncExternalStore` uses, so an unchanged list
  // must not be republished — an empty search would otherwise re-render the
  // whole toolbar for nothing.
  if (next.length === history.length && next[0] === history[0]) {
    return;
  }
  publish(next);
};

/** Drop one, for the cross beside it in the list. */
export const removeSearchFromHistory = (term: string) => {
  const next = forgetSearch(history, term);
  if (next.length === history.length) {
    return;
  }
  publish(next);
};

/** Drop the lot. Somebody clearing this means it, so nothing confirms it. */
export const clearSearchHistory = () => {
  if (history.length === 0) {
    return;
  }
  publish([]);
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * The list, as one stable array.
 *
 * The same identity is handed back until something actually changes, because
 * `useSyncExternalStore` compares snapshots by reference and a fresh array per
 * call is an endless re-render.
 */
const EMPTY: string[] = [];

export const useSearchHistory = () =>
  useSyncExternalStore(
    subscribe,
    () => history,
    () => EMPTY,
  );
