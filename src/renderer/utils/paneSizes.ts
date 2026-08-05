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
 * How much room the top pane gets, held outside React.
 *
 * The *top* pane, not the graph. The graph takes whatever is left over, and
 * that asymmetry is the whole design:
 *
 *  - On the EQ tab this is a **cap**, not a height. The editor asks for what
 *    its content needs and is only stopped from exceeding this, so folding the
 *    reference picker shortens it and the divider follows the content up on its
 *    own. Nothing has to notice the fold or recompute anything.
 *  - Everywhere else it is the height outright, because those panels have no
 *    natural height to follow — a web page fills whatever it is given, and the
 *    voicing and convolution panels scroll inside themselves.
 *
 * Sizing the graph directly was the obvious way round and it does not work: the
 * graph then has to grow into space the editor did not want, which leaves
 * nothing able to take height back off it, and the divider stops responding to
 * a downward drag. Sizing the pane whose content actually varies keeps the
 * drag meaningful in both directions.
 *
 * A module store rather than a prop for the same reason the graph's look is
 * one: the handle is a sibling of both panes, and threading a layout concern
 * through every component in between buys nothing.
 */

import { useSyncExternalStore } from 'react';

/**
 * Below this a pane has stopped being a pane.
 *
 * Not a design preference: a graph shorter than this cannot show a curve and a
 * player shorter than it cannot show a video, so dragging past it is a way of
 * losing a panel rather than of resizing one.
 */
export const PANE_MIN_HEIGHT = 150;

/**
 * Room to leave for everything that is not the pane being dragged — the
 * titlebar, the tab strip and the workspace padding. Approximate on purpose:
 * it decides how close to the bottom of the window a pane may reach, and being
 * a little conservative costs nothing while being exact would need a measured
 * layout on every pointer move.
 */
const CHROME_ALLOWANCE = 200;

const EDITOR_STORAGE_KEY = 'fluideq.editorHeight';

const EDITOR_DEFAULT_HEIGHT = 430;

/**
 * The tallest a lone pane may be: the window, less what the pane below it needs
 * and the chrome around them.
 *
 * Derived rather than declared, so it follows the window instead of a number
 * somebody picked on a different monitor. On a very short window it collapses
 * to the minimum, which is the honest answer — there is no room to give.
 */
const ceilingForSinglePane = () => {
  const viewport = typeof window === 'undefined' ? 0 : window.innerHeight || 0;
  return Math.max(
    PANE_MIN_HEIGHT,
    viewport - PANE_MIN_HEIGHT - CHROME_ALLOWANCE,
  );
};

/** Floor only. Used where a second pane is absorbing the difference. */
export const clampToMinimum = (value: number) =>
  Math.max(PANE_MIN_HEIGHT, Math.round(value));

/** Floor and the derived ceiling. Used where a pane moves on its own. */
export const clampToWindow = (value: number) =>
  Math.min(ceilingForSinglePane(), clampToMinimum(value));

/**
 * A remembered size, brought back inside what this window can actually show.
 *
 * Clamped against the window rather than only against the minimum, because a
 * size is remembered from whatever window it was set in. A pane dragged tall on
 * a large monitor — or left oversized by an earlier build that allowed it —
 * would otherwise be restored at that height on a laptop screen, putting the
 * divider below the bottom edge and taking with it the only means of dragging
 * it back. A layout nobody can undo is worse than one that does not quite
 * remember.
 */
const readStored = (key: string, fallback: number) => {
  try {
    const stored = Number(window.localStorage.getItem(key));
    return Number.isFinite(stored) && stored > 0
      ? clampToWindow(stored)
      : fallback;
  } catch {
    // Storage can be unavailable; the default is a perfectly good size.
    return fallback;
  }
};

const write = (key: string, value: number) => {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Not worth failing a drag over.
  }
};

let editorHeight = readStored(EDITOR_STORAGE_KEY, EDITOR_DEFAULT_HEIGHT);

const editorListeners = new Set<() => void>();

export const getEditorHeight = () => editorHeight;

export const setEditorHeight = (next: number) => {
  const value = clampToMinimum(next);
  if (value === editorHeight) {
    return;
  }
  editorHeight = value;
  editorListeners.forEach((listener) => listener());
};

/**
 * Remember it, once the drag is over.
 *
 * Written on release rather than on every move: a drag across the window is
 * hundreds of pointer events, and localStorage is synchronous.
 */
export const commitPaneSizes = () => {
  write(EDITOR_STORAGE_KEY, editorHeight);
};

const subscribeEditor = (listener: () => void) => {
  editorListeners.add(listener);
  return () => {
    editorListeners.delete(listener);
  };
};

export const useEditorHeight = () =>
  useSyncExternalStore(
    subscribeEditor,
    () => editorHeight,
    () => EDITOR_DEFAULT_HEIGHT,
  );

/**
 * Keep the panes inside a window that has just changed size.
 *
 * Without this, shrinking the window leaves an editor sized for the old one
 * filling the whole column and squeezing the graph below it to nothing — and,
 * because the divider goes with it, leaves no way to put it right.
 */
if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => {
    setEditorHeight(clampToWindow(editorHeight));
  });
}
