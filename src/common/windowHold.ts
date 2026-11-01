/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the window is doing that only the window can do, and so keeps it
 * loaded behind the tray (`main/windowUnload.ts`): a web player or Karaoke
 * playing, the Library playing on the window's own element, and the Karaoke
 * Maker's models at work. The page says which of these it holds every time
 * the set changes; with none, and nothing main holds it for either, a window
 * hidden in the tray is let go and built again when it is opened.
 *
 * Only what the page decides is the page's to say. What main knows first —
 * the desk lights' switch, Share Audio's links, the Studio's door and chat —
 * main holds for itself: a page that said "nothing" before those had reached
 * it would be let go a moment too early.
 */
export const WINDOW_HOLD_CHANNEL = 'window-holds';

export const WINDOW_HOLDS = ['player', 'library-window', 'maker'] as const;

export type TWindowHold = (typeof WINDOW_HOLDS)[number];

const isWindowHold = (value: unknown): value is TWindowHold =>
  WINDOW_HOLDS.includes(value as TWindowHold);

/** The page's holds, each once; anything else is not a report. */
export const parseWindowHolds = (raw: unknown): TWindowHold[] | undefined =>
  Array.isArray(raw) && raw.every(isWindowHold) ? [...new Set(raw)] : undefined;
