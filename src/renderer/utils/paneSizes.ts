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
 * that asymmetry is the whole design.
 *
 * It is the height outright, on every tab. The EQ tab used to treat it as a
 * ceiling instead — asking for its content height and merely stopping here —
 * which let a folded reference picker pull the divider up by itself. That was
 * one clever behaviour on one of four tabs, and the price was a handle that
 * sometimes stayed where it was put and sometimes drifted, depending on which
 * tab happened to be open. Every panel scrolls when its content does not fit,
 * so none of them needs to be measured.
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

/**
 * How the window is divided the very first time it opens: seven parts to the
 * editor above, three to the graph below.
 *
 * A share rather than a number of pixels. It used to be a flat 430, which is
 * about forty per cent of a 1080p window, a quarter of a tall one and most of a
 * laptop's — so the split somebody met on opening the app depended entirely on
 * the monitor they happened to have. A ratio lands the same way everywhere.
 *
 * Seventy is where the editing goes: bands, voicing, a video. The graph is a
 * reading of what those are doing and thirty per cent of a window is plenty to
 * read it in — and it is the pane with a mouse-friendly divider right above it
 * for anyone who disagrees.
 */
const EDITOR_DEFAULT_SHARE = 0.7;

/**
 * That share, in pixels, for this window.
 *
 * Measured against the space the two panes actually divide rather than against
 * the whole window: the titlebar and the tab strip are not part of the split,
 * and counting them would make the editor's seventy per cent quietly larger
 * than seventy per cent of what is on screen.
 */
const defaultEditorHeight = () => {
  const viewport = typeof window === 'undefined' ? 0 : window.innerHeight || 0;
  if (viewport <= 0) {
    // No window to measure — a test environment, or a render before layout.
    // The old fixed height is a reasonable stand-in and is never seen by a
    // user, since the first real read happens with a window present.
    return 430;
  }
  return clampToWindow(
    Math.round((viewport - CHROME_ALLOWANCE) * EDITOR_DEFAULT_SHARE),
  );
};

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

let editorHeight = readStored(EDITOR_STORAGE_KEY, defaultEditorHeight());

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
    // Server snapshot for useSyncExternalStore. Never rendered to a user,
    // so it does not need the window it has no access to.
    () => 430,
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
