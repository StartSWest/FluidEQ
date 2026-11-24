/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import '../styles/NoticeDock.scss';

/**
 * Where every notice that arrives on its own is drawn: one stack in the
 * window's bottom right corner, standing on the bottom bar, newest nearest
 * the corner (Ivan, 2026-11-24: "move all notifications to the bottom right
 * where the fluideq.com is so it doesn't clutter the view on the top right",
 * then "it needs to be on top of the bottom bar, not on top of the
 * fluideq.com").
 *
 * Each notice used to place itself — top right under the titlebar, centred
 * under it for the engine's cards, the two bottom corners for the rest — and
 * a fixed spot does not stack: two notices in one spot were one drawn over
 * the other, which is why half the notice sheets argued about z-index. In
 * one stack they stand one above the other, and none of them has a place of
 * its own any more.
 *
 * `undefined` means no dock at all — a notice rendered alone, in a test —
 * and the notice is then drawn where it is rendered. `null` is the dock not
 * mounted yet, for the one commit before its element exists.
 */
interface INoticeDockContext {
  dock: HTMLElement | null;
  setDock: (dock: HTMLElement | null) => void;
}

const NoticeDockContext = createContext<INoticeDockContext | undefined>(
  undefined,
);

/** The keyframes a docked notice's slot plays as it leaves. */
const DOCK_EXIT = 'row-leave';

/**
 * Lets a notice that has just gone fold out of the stack instead of blinking
 * out, so the notices above it glide down into its place.
 *
 * The notice is removed by whatever showed it, behind its own condition, so
 * there is no element left to animate once React has removed it. As it
 * unmounts, its slot leaves an inert copy of itself where it stood, marked
 * closing so the stylesheet plays the fold, and removed by that animation
 * finishing. Where nothing plays — reduced motion, or a document with no
 * animations — the copy goes at once. The same reasoning as `leaveAsGhost`,
 * for the dock rather than a modal's layer.
 */
const leaveTheDock = (slot: HTMLElement | null) => {
  const dock = slot?.parentElement;
  if (!slot || !dock?.classList.contains('notice-dock__stack')) {
    return;
  }
  const ghost = slot.cloneNode(true);
  if (!(ghost instanceof HTMLElement)) {
    return;
  }
  ghost.inert = true;
  ghost.setAttribute('aria-hidden', 'true');
  // Ids inside the copy would answer for the notice's labels while it folds.
  ghost.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
  ghost.dataset.closing = '';
  slot.after(ghost);
  const leaving = (ghost.getAnimations?.() ?? []).filter(
    (animation) =>
      'animationName' in animation &&
      (animation as CSSAnimation).animationName === DOCK_EXIT,
  );
  if (leaving.length === 0) {
    ghost.remove();
    return;
  }
  // Removed whether the fold finishes or is cancelled: a copy left behind
  // would hold its place in the stack, inert but seen.
  Promise.allSettled(leaving.map((animation) => animation.finished)).then(
    () => ghost.remove(),
    () => ghost.remove(),
  );
};

/**
 * Holds the dock's element for every notice under it. Outside every notice,
 * and around the element itself (`NoticeDock`), which is drawn where the
 * stylesheet can see the window's bottom bar.
 */
export function NoticeDockProvider({ children }: { children: ReactNode }) {
  const [dock, setDock] = useState<HTMLElement | null>(null);
  const value = useMemo(() => ({ dock, setDock }), [dock]);
  return (
    <NoticeDockContext.Provider value={value}>
      {children}
    </NoticeDockContext.Provider>
  );
}

/**
 * The stack itself: an empty column at the corner the notices fill. Two
 * boxes, because the outer one scrolls from its foot: a stack taller than the
 * window keeps its newest notice in view at the corner and lets the oldest go
 * out of view at the top, where one box would have cut off the newest.
 */
export function NoticeDock() {
  const context = useContext(NoticeDockContext);
  return (
    <div className="notice-dock">
      <div ref={context?.setDock} className="notice-dock__stack" />
    </div>
  );
}

/**
 * The dock to portal into: an element, `null` before it is mounted, or
 * `undefined` where there is no dock and a notice draws in place. For a
 * notice that runs its own way out (`PlusToastStack`); a single notice uses
 * `DockedNotice`, which also folds out.
 */
export const useNoticeDock = () => useContext(NoticeDockContext)?.dock;

/**
 * `node` drawn in the dock, or in place where there is none (`useNoticeDock`).
 */
export const intoNoticeDock = (
  node: ReactNode,
  dock: HTMLElement | null | undefined,
) => {
  if (dock === undefined) {
    return node;
  }
  return dock ? createPortal(node, dock) : null;
};

/**
 * One notice, in the dock's stack: it grows its place at the corner, rising
 * into it, and folds out of the stack when whatever showed it takes it away.
 */
export function DockedNotice({ children }: { children: ReactNode }) {
  const dock = useNoticeDock();
  const slot = useRef<HTMLDivElement | null>(null);
  // Read at mount, and again once the dock arrives: the slot is the same
  // element for the notice's whole life in it.
  useLayoutEffect(() => {
    const placed = slot.current;
    return () => leaveTheDock(placed);
  }, [dock]);
  return intoNoticeDock(
    <div ref={slot} className="notice-dock__slot">
      {children}
    </div>,
    dock,
  );
}
