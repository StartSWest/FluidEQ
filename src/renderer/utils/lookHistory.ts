/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { LOOK_HISTORY_KEY, readStored, writeStored } from './graphStorage';

/**
 * The looks the graph played before the one on it, newest first.
 *
 * Kept for one question: where the graph goes when the look on it is deleted
 * (Ivan, 2026-11-27: "when deleting a custom look, please jump back to the
 * previous one instead of jumping to Analyzer always"). Every change of the
 * selection writes the look it leaves at the front (`graphStyle.ts`); a
 * draft the look editor shows is not a selection and never lands here.
 *
 * Never holds the look on the graph, and never one look twice: the list is
 * the order looks were last on, not a log of every press.
 */

/**
 * The last few, and no more. Eight steps back covers a run of the listener's
 * own looks deleted one after another, each going back to the one before,
 * and the scenes passed over because they can no longer play. Anything
 * older is not "the look I had on" to anybody.
 */
export const LOOK_HISTORY_LENGTH = 8;

/**
 * Longer than any id a look has: a member's scene is the longest, at 92
 * (`member:`, an account's UUID, `:` and a 48-character pack id). A longer
 * entry was not written by this store and is dropped on reading.
 */
const MAX_LOOK_ID_LENGTH = 128;

/**
 * What storage holds, as a list this store would have written: strings of a
 * look id's length, each once, at most `LOOK_HISTORY_LENGTH`. Anything else
 * (hand-edited, a future version's shape, no storage at all) reads as a
 * graph with nothing played before, which is what a first launch is.
 */
const readHistory = (): readonly string[] => {
  const stored = readStored(LOOK_HISTORY_KEY);
  if (!stored) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) {
    return [];
  }
  const ids: string[] = [];
  parsed.forEach((entry: unknown) => {
    if (
      ids.length < LOOK_HISTORY_LENGTH &&
      typeof entry === 'string' &&
      entry.length > 0 &&
      entry.length <= MAX_LOOK_ID_LENGTH &&
      !ids.includes(entry)
    ) {
      ids.push(entry);
    }
  });
  return ids;
};

let history: readonly string[] = readHistory();

const keep = (next: readonly string[]) => {
  history = next;
  writeStored(LOOK_HISTORY_KEY, JSON.stringify(next));
};

/** The looks played before the selection, newest first. */
export const getLookHistory = (): readonly string[] => history;

/**
 * The selection moved from `from` to `to`: `from` is now the newest look
 * played before, and `to`, being on the graph, is no longer behind it.
 */
export const noteLookChange = (from: string, to: string): void => {
  if (from === to) {
    return;
  }
  keep(
    [from, ...history.filter((id) => id !== from && id !== to)].slice(
      0,
      LOOK_HISTORY_LENGTH,
    ),
  );
};

/**
 * The newest look played before that `canReturnTo` says can still go on,
 * taken off the list because it is about to be the selection; undefined when
 * none can, and the list is left as it was.
 *
 * A look passed over stays where it is: a scene that cannot play this minute
 * may again, and a deleted look of the listener's own is gone from here
 * already (`forgetLooks`).
 */
export const takeLookToReturnTo = (
  canReturnTo: (id: string) => boolean,
): string | undefined => {
  const back = history.find(canReturnTo);
  if (back !== undefined) {
    keep(history.filter((id) => id !== back));
  }
  return back;
};

/** Every look `isGone` names leaves the list: nothing to go back to. */
export const forgetLooks = (isGone: (id: string) => boolean): void => {
  const next = history.filter((id) => !isGone(id));
  if (next.length !== history.length) {
    keep(next);
  }
};
