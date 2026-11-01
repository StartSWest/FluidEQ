/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The window's holds (`common/windowHold.ts`): each piece of work only the
 * window can do holds it for as long as it runs, and main is told the set
 * whenever it changes — so a window hidden in the tray with none is let go,
 * and one with any stays loaded until the last ends.
 *
 * Counted, so two of the same kind — a Maker split and a transcription, say —
 * hold until both have ended.
 *
 * TOLD AFTER EVERYTHING ELSE THE SAME TURN DID. A hold ends in an effect's
 * cleanup, and React runs every cleanup of a commit before any of its new
 * effects: told at once, "nothing holds the window" would reach main ahead of
 * whatever the same commit sends after it — the work that just ended saying
 * so on its way out — and main could let the page go with that still unsent.
 * A microtask runs once the commit's effects have all run, so the holds always
 * come last and main has everything they followed.
 */
import { useEffect } from 'react';
import {
  WINDOW_HOLD_CHANNEL,
  WINDOW_HOLDS,
  type TWindowHold,
} from 'common/windowHold';

const counts = new Map<TWindowHold, number>();
/** What main was last told; `undefined` until the page has said anything. */
let told: string | undefined;
let isBooked = false;

const held = (): TWindowHold[] =>
  WINDOW_HOLDS.filter((hold) => (counts.get(hold) ?? 0) > 0);

const tell = (force: boolean) => {
  isBooked = false;
  const now = held();
  const key = now.join(',');
  if (!force && key === told) {
    return;
  }
  told = key;
  window.electron?.ipcRenderer?.sendMessage?.(WINDOW_HOLD_CHANNEL, [now]);
};

const changed = () => {
  if (told === undefined || isBooked) {
    return;
  }
  isBooked = true;
  queueMicrotask(() => tell(false));
};

/** Hold the window for one piece of work; the answer lets go, once. */
export const holdWindow = (hold: TWindowHold): (() => void) => {
  counts.set(hold, (counts.get(hold) ?? 0) + 1);
  changed();
  let isReleased = false;
  return () => {
    if (isReleased) {
      return;
    }
    isReleased = true;
    counts.set(hold, Math.max(0, (counts.get(hold) ?? 1) - 1));
    changed();
  };
};

/** Hold the window while `isActive`. */
export const useWindowHold = (hold: TWindowHold, isActive: boolean): void => {
  useEffect(() => (isActive ? holdWindow(hold) : undefined), [hold, isActive]);
};

/**
 * The page's first word: what it holds once everything it mounted has said
 * so. Until it is said, main counts the page as holding the window — a page
 * still loading is not idle.
 */
export const announceWindowHolds = (): void => {
  isBooked = true;
  queueMicrotask(() => tell(true));
};

/** Test seam: the register outlives a render. */
export const resetWindowHolds = (): void => {
  counts.clear();
  told = undefined;
  isBooked = false;
};
