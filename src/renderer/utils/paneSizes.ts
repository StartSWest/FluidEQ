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
 * **Held as a share of the window, not as a number of pixels.** Pixels are what
 * the divider is dragged in, but they are the wrong thing to remember: a split
 * set on a 4K monitor is most of a laptop screen, and the app is routinely
 * moved between the two — a docked machine, an external display unplugged, a
 * window snapped to half the screen. Storing pixels meant every one of those
 * changed the *proportion* on screen while pretending to preserve the setting,
 * and the clamp that kept the panes on screen then wrote the squashed value
 * back, so the original was gone for good. Dragging the divider once on a small
 * window and then maximising made it lurch somewhere else again. A share
 * survives all of it: the same split, wherever it is shown.
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

/** The share, 0..1. */
const EDITOR_SHARE_KEY = 'fluideq.editorShare';

/**
 * What the old builds wrote: a flat pixel height.
 *
 * Read once and converted, so somebody who has had this app for a while keeps
 * roughly the split they chose instead of being reset to the default. Removed
 * as it is read — leaving it would mean converting it again on the next start
 * and undoing whatever they have done since.
 */
const LEGACY_EDITOR_HEIGHT_KEY = 'fluideq.editorHeight';

/**
 * How the window is divided the very first time it opens: seven parts to the
 * editor above, three to the graph below.
 *
 * Seventy is where the editing goes: bands, voicing, a video. The graph is a
 * reading of what those are doing and thirty per cent of a window is plenty to
 * read it in — and it is the pane with a mouse-friendly divider right above it
 * for anyone who disagrees.
 */
const EDITOR_DEFAULT_SHARE = 0.7;

/**
 * The height the two panes actually divide between them.
 *
 * The titlebar and the tab strip are not part of the split, so counting them
 * would make the editor's seventy per cent quietly larger than seventy per cent
 * of what is on screen.
 */
const splittableHeight = () => {
  const viewport = typeof window === 'undefined' ? 0 : window.innerHeight || 0;
  // No window to measure — a test environment, or a render before layout. A
  // stand-in that is never seen by a user, since the first real read happens
  // with a window present.
  return viewport > 0 ? viewport - CHROME_ALLOWANCE : 614;
};

/**
 * The tallest a lone pane may be: the space to divide, less what the pane below
 * it needs.
 *
 * Derived rather than declared, so it follows the window instead of a number
 * somebody picked on a different monitor. On a very short window it collapses
 * to the minimum, which is the honest answer — there is no room to give.
 */
const ceilingForSinglePane = () =>
  Math.max(PANE_MIN_HEIGHT, splittableHeight() - PANE_MIN_HEIGHT);

/** Floor only. Used where a second pane is absorbing the difference. */
export const clampToMinimum = (value: number) =>
  Math.max(PANE_MIN_HEIGHT, Math.round(value));

/** Floor and the derived ceiling. Used where a pane moves on its own. */
export const clampToWindow = (value: number) =>
  Math.min(ceilingForSinglePane(), clampToMinimum(value));

const clampShare = (share: number) => Math.min(0.95, Math.max(0.05, share));

const readStoredShare = (): number => {
  try {
    const stored = Number(window.localStorage.getItem(EDITOR_SHARE_KEY));
    if (Number.isFinite(stored) && stored > 0) {
      return clampShare(stored);
    }

    const legacy = Number(
      window.localStorage.getItem(LEGACY_EDITOR_HEIGHT_KEY),
    );
    if (Number.isFinite(legacy) && legacy > 0) {
      window.localStorage.removeItem(LEGACY_EDITOR_HEIGHT_KEY);
      return clampShare(legacy / splittableHeight());
    }
  } catch {
    // Storage can be unavailable; the default is a perfectly good split.
  }
  return EDITOR_DEFAULT_SHARE;
};

let editorShare = readStoredShare();

const editorListeners = new Set<() => void>();

/**
 * The share as pixels for the window as it is right now.
 *
 * Clamped on the way out, never on the way in. That is the whole of the fix:
 * a window too short to honour the share shows a clamped split for as long as
 * it is that short, and the share itself is untouched — so making the window
 * big again restores exactly what was set rather than whatever the smallest
 * size it ever had happened to allow.
 */
export const getEditorHeight = () =>
  clampToWindow(Math.round(splittableHeight() * editorShare));

/**
 * Set from a drag, in pixels, converted straight back to a share.
 *
 * Compared as pixels rather than as shares because pixels are what the caller
 * has and what the screen shows; two pointer positions a fraction of a per cent
 * apart are the same divider position and are not worth a re-render.
 */
export const setEditorHeight = (next: number) => {
  const value = clampToMinimum(next);
  if (value === getEditorHeight()) {
    return;
  }
  editorShare = clampShare(value / splittableHeight());
  editorListeners.forEach((listener) => listener());
};

/**
 * Remember it, once the drag is over.
 *
 * Written on release rather than on every move: a drag across the window is
 * hundreds of pointer events, and localStorage is synchronous.
 */
export const commitPaneSizes = () => {
  try {
    window.localStorage.setItem(EDITOR_SHARE_KEY, String(editorShare));
  } catch {
    // Not worth failing a drag over.
  }
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
    getEditorHeight,
    // Server snapshot for useSyncExternalStore. Never rendered to a user, so it
    // does not need the window it has no access to.
    () => 430,
  );

/**
 * Redraw at the new size when the window changes.
 *
 * Only a notification: the share is not touched, so the panes keep their
 * proportion across a resize, a move to another monitor and a maximise. This
 * used to write a clamped pixel height back into the store, which is how a
 * window briefly made small permanently lost the split it had.
 */
if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => {
    editorListeners.forEach((listener) => listener());
  });
}
