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
import { forgetSearch, rememberSearch } from 'common/searchHistory';

/**
 * One machine-local list of past searches, kept across restarts.
 *
 * Storage and subscriptions only — the ordering and matching rules live in
 * `common/searchHistory`, where they can be tested without a browser.
 *
 * A module store rather than component state because the list has to outlive
 * the input: the Video tab stays mounted but hidden while somebody is moving
 * bands, and the Library's own search box is unmounted outright whenever a
 * drill-in replaces the list it sits above.
 *
 * One store per key, and the keys are deliberately separate: a list of songs
 * somebody owns and a list of things they searched for on the web are not the
 * same list, and offering one as suggestions in the other's box would be a
 * small but real privacy leak between two unrelated features.
 *
 * Local to this machine, and never sent anywhere. It is a record of what
 * somebody has played and looked for, which is exactly the sort of thing the
 * bug reporter is careful not to include.
 */
export interface ISearchHistoryStore {
  /** Note a search that was actually run. */
  add: (term: string) => void;
  /** Drop one, for the cross beside it in the list. */
  remove: (term: string) => void;
  /** Drop the lot. Somebody clearing this means it, so nothing confirms it. */
  clear: () => void;
  /** The list, as one stable array — see `snapshot` below. */
  use: () => readonly string[];
}

/** Handed back until something actually changes: `useSyncExternalStore`
 * compares snapshots by reference, and a fresh array per call is an endless
 * re-render. Shared by every store, since an empty list has no identity worth
 * distinguishing. */
const EMPTY: string[] = [];

export const createSearchHistoryStore = (
  storageKey: string,
): ISearchHistoryStore => {
  const listeners = new Set<() => void>();

  /**
   * Read what was stored, defensively.
   *
   * Anything in localStorage is user-editable and survives across versions, so
   * this treats it as untrusted input: a non-array, or an array with numbers
   * in it, becomes an empty history rather than a crash on the first render.
   */
  const readStored = (): string[] => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        return [];
      }
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.filter(
        (entry): entry is string =>
          typeof entry === 'string' && entry.length > 0,
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
      window.localStorage.setItem(storageKey, JSON.stringify(history));
    } catch {
      // Not worth failing a search over; it just will not be there next time.
    }
    listeners.forEach((listener) => listener());
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  return {
    add: (term: string) => {
      const next = rememberSearch(history, term);
      // Identity is the signal `useSyncExternalStore` uses, so an unchanged
      // list must not be republished — an empty search would otherwise
      // re-render the whole toolbar for nothing.
      if (next.length === history.length && next[0] === history[0]) {
        return;
      }
      publish(next);
    },
    remove: (term: string) => {
      const next = forgetSearch(history, term);
      if (next.length === history.length) {
        return;
      }
      publish(next);
    },
    clear: () => {
      if (history.length === 0) {
        return;
      }
      publish([]);
    },
    use: () =>
      useSyncExternalStore(
        subscribe,
        () => history,
        () => EMPTY,
      ),
  };
};
