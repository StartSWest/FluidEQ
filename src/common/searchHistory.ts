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

/**
 * What has been searched for before, so it need not be typed again.
 *
 * People tune to the same handful of tracks. Somebody checking a crossover
 * will play the same reference recording twenty times across a week, and
 * retyping it every time is the sort of small friction nobody reports and
 * everybody feels.
 *
 * Pure, and free of storage and the DOM, so the ordering and matching rules can
 * be tested without a browser.
 */

/**
 * How many to keep.
 *
 * Enough to cover the tracks somebody actually returns to, few enough that the
 * list stays a memory rather than a log. Past this the oldest goes, which is
 * the right one to lose: a search from a month ago that has not been repeated
 * since is not one being repeated now.
 */
export const MAX_SEARCH_HISTORY = 25;

/** How many to offer at once, so the list never covers the page below it. */
export const MAX_SEARCH_SUGGESTIONS = 6;

const normalise = (term: string) => term.trim().replace(/\s+/g, ' ');

/**
 * Add a search, newest first, without duplicating what is already there.
 *
 * A repeat moves to the front rather than being added again: searching the same
 * thing twice is evidence it matters, not a reason to have it twice. Matching
 * is case-insensitive, so "Hotel California" does not sit beside "hotel
 * california" as though they were different tracks.
 */
export const rememberSearch = (
  history: readonly string[],
  term: string,
): string[] => {
  const cleaned = normalise(term);
  if (!cleaned) {
    return [...history];
  }
  const withoutRepeat = history.filter(
    (entry) => entry.toLocaleLowerCase() !== cleaned.toLocaleLowerCase(),
  );
  return [cleaned, ...withoutRepeat].slice(0, MAX_SEARCH_HISTORY);
};

/** Remove one, for the cross beside it. */
export const forgetSearch = (
  history: readonly string[],
  term: string,
): string[] =>
  history.filter(
    (entry) => entry.toLocaleLowerCase() !== term.toLocaleLowerCase(),
  );

/**
 * What to offer for what has been typed so far.
 *
 * An empty box offers the most recent searches, which is the case that saves
 * the most typing — somebody who has just opened the tab wants the thing they
 * were playing yesterday.
 *
 * Once there is a query, entries that START with it come before entries that
 * merely contain it. Somebody typing "dark" is far more likely to want "dark
 * side of the moon" than "in the dark", and putting prefix matches first means
 * the answer is usually the first row rather than somewhere in a list.
 */
export const suggestSearches = (
  history: readonly string[],
  query: string,
  limit = MAX_SEARCH_SUGGESTIONS,
): string[] => {
  const needle = normalise(query).toLocaleLowerCase();
  if (!needle) {
    return history.slice(0, limit);
  }
  const starts: string[] = [];
  const contains: string[] = [];
  history.forEach((entry) => {
    const value = entry.toLocaleLowerCase();
    if (value === needle) {
      // Already typed in full. Offering it back is a row that does nothing.
      return;
    }
    if (value.startsWith(needle)) {
      starts.push(entry);
    } else if (value.includes(needle)) {
      contains.push(entry);
    }
  });
  return [...starts, ...contains].slice(0, limit);
};
