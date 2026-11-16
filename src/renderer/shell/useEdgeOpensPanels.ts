/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type RefObject, useEffect, useEffectEvent, useRef } from 'react';

type TEdge = 'left' | 'right';

interface IEdgeWait {
  side: TEdge;
  wait: Animation;
}

/** Stops waiting at an edge, if one was being waited at. */
const cancelWait = (armed: RefObject<IEdgeWait | undefined>) => {
  armed.current?.wait.cancel();
  armed.current = undefined;
};

/**
 * How close to the window's side the pointer has to come for a full-screen
 * panel to open. It was the very edge, 3px, and the pointer had to be pressed
 * against the side to reach it (Ivan, 2026-11-16: "I have to put the mouse
 * right at the edge, it needs a bit more range"; then "more range, about 20
 * pixels"). Twenty-four is reached by
 * heading for the side; the plot's own controls start further in than that
 * (its level labels take the first 50px), so dragging the lowest band does
 * not pull the drawer out.
 */
export const EDGE_OPENS_PX = 24;

/**
 * How long the pointer has to stay at an edge before its panel opens, and
 * away from an open panel before it shuts (Ivan, 2026-11-16: "a second in the
 * corner before the side panels come out ... if I'm moving the mouse to
 * another screen I don't want the panel", then "half a second ... until the
 * mouse has left, half a second"). The durations here are the request
 * itself, not a guess at when something is ready: each is waited on as an
 * animation of the document on the page's own timeline (`Element.animate`,
 * its `finished`), cancelled the moment the pointer goes back.
 */
export const EDGE_DWELL_MS = 500;
export const PANEL_LEAVE_MS = 500;

/**
 * How far past an open panel's edge the pointer may stray before it shuts:
 * a hand overshooting the panel's last control should not lose it.
 */
export const PANEL_LEAVE_PX = 24;

/**
 * Where a control inside a panel puts what it opens, outside the panel's own
 * box: the dropdowns and menus portalled to the body, and any dialog. The
 * pointer over one of them is still using the panel.
 */
const FLOATING_SURFACES =
  '[role="menu"], [role="listbox"], [role="dialog"], .dropdown, .language-picker-menu';

interface IEdgePanels {
  /** Whether the window is in the app's full screen, where this applies. */
  isActive: boolean;
  isLeftOpen: boolean;
  isRightOpen: boolean;
  setLeftOpen: (open: boolean) => void;
  setRightOpen: (open: boolean) => void;
}

const leftPanel = () =>
  document.querySelector<HTMLElement>('.app-workspace.is-app-full > .side-bar');

const rightPanel = () =>
  document.querySelector<HTMLElement>(
    '.app-workspace.is-app-full > .right-content > .right-content__panel',
  );

/** Whether the pointer, at `x`, has left `panel` for the page beside it. */
const hasLeft = (
  panel: HTMLElement | null,
  event: PointerEvent,
  side: 'left' | 'right',
) => {
  if (!panel) {
    return false;
  }
  const box = panel.getBoundingClientRect();
  return side === 'left'
    ? event.clientX > box.right + PANEL_LEAVE_PX
    : event.clientX < box.left - PANEL_LEAVE_PX;
};

/**
 * THE PANELS OF A FULL-SCREEN PICTURE OPEN FROM ITS EDGES (Ivan, 2026-11-16:
 * "remove the handler, and when the user goes to the left or to the right it
 * automatically opens the floating panels"). The pointer at the very left
 * edge opens the left drawer, at the very right edge the sound panel; moving
 * on to the page beyond an open panel shuts it. A panel stays while the
 * pointer is on something it opened outside its own box (a menu, a list, a
 * dialog) and while a button is held, which is a slider being dragged past
 * the panel's edge. A panel opens only once the pointer has stayed at its
 * edge for EDGE_DWELL_MS; crossing the edge on the way to another screen
 * opens nothing.
 */
const useEdgeOpensPanels = ({
  isActive,
  isLeftOpen,
  isRightOpen,
  setLeftOpen,
  setRightOpen,
}: IEdgePanels) => {
  // The edge being waited at to open, and the panel being waited away from
  // to shut, each with its wait.
  const armed = useRef<IEdgeWait>(undefined);
  const leaving = useRef<IEdgeWait>(undefined);
  const disarm = () => cancelWait(armed);
  const stayLeaving = () => cancelWait(leaving);

  const setOpen = (side: TEdge, open: boolean) => {
    if (side === 'left') {
      setLeftOpen(open);
    } else {
      setRightOpen(open);
    }
  };

  /** After `duration` on the same side, unless cancelled, opens or shuts it. */
  const waitThen = (
    slot: RefObject<IEdgeWait | undefined>,
    side: TEdge,
    duration: number,
    open: boolean,
  ) => {
    if (slot.current?.side === side) {
      return;
    }
    cancelWait(slot);
    const wait = document.documentElement.animate([{}, {}], { duration });
    const entry: IEdgeWait = { side, wait };
    slot.current = entry;
    wait.finished
      .then(() => {
        if (slot.current === entry) {
          slot.current = undefined;
          setOpen(side, open);
        }
        return undefined;
      })
      // Cancelled: the pointer went back, which is the answer "no".
      .catch(() => undefined);
  };

  const arm = (side: TEdge) => waitThen(armed, side, EDGE_DWELL_MS, true);
  const leave = (side: TEdge) => waitThen(leaving, side, PANEL_LEAVE_MS, false);

  const onMove = useEffectEvent((event: PointerEvent) => {
    if (event.pointerType === 'touch') {
      return;
    }
    if (event.clientX <= EDGE_OPENS_PX) {
      if (isLeftOpen) {
        disarm();
      } else {
        arm('left');
      }
      return;
    }
    if (event.clientX >= window.innerWidth - 1 - EDGE_OPENS_PX) {
      if (isRightOpen) {
        disarm();
      } else {
        arm('right');
      }
      return;
    }
    disarm();
    if (
      event.buttons !== 0 ||
      (event.target instanceof Element &&
        event.target.closest(FLOATING_SURFACES))
    ) {
      stayLeaving();
      return;
    }
    const isAway =
      (isLeftOpen && hasLeft(leftPanel(), event, 'left') && 'left') ||
      (isRightOpen && hasLeft(rightPanel(), event, 'right') && 'right');
    if (isAway) {
      leave(isAway);
    } else {
      stayLeaving();
    }
  });

  useEffect(() => {
    if (!isActive) {
      return undefined;
    }
    const listener = (event: PointerEvent) => onMove(event);
    // The pointer gone off the window (to another screen) sends no more
    // moves, so its leaving is what cancels the wait.
    const root = document.documentElement;
    const stop = () => {
      cancelWait(armed);
      cancelWait(leaving);
    };
    window.addEventListener('pointermove', listener, { passive: true });
    root.addEventListener('pointerleave', stop);
    window.addEventListener('blur', stop);
    return () => {
      window.removeEventListener('pointermove', listener);
      root.removeEventListener('pointerleave', stop);
      window.removeEventListener('blur', stop);
      stop();
    };
  }, [isActive]);
};

export default useEdgeOpensPanels;
