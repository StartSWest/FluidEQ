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
 * right at the edge, it needs a bit more range"). Sixteen is reached by
 * heading for the side; the plot's own controls start further in than that
 * (its level labels take the first 50px), so dragging the lowest band does
 * not pull the drawer out.
 */
export const EDGE_OPENS_PX = 16;

/**
 * How long the pointer has to stay at an edge before its panel opens (Ivan,
 * 2026-11-16: "a second in the corner before the side panels come out ...
 * if I'm moving the mouse to another screen I don't want the panel"). The
 * one duration here is the request itself, not a guess at when something is
 * ready: it is waited on as an animation of the document on the page's own
 * timeline (`Element.animate`, its `finished`), cancelled the moment the
 * pointer leaves the edge or the window.
 */
export const EDGE_DWELL_MS = 1000;

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
  // The edge being waited at, and the wait itself.
  const armed = useRef<IEdgeWait>(undefined);
  const disarm = () => cancelWait(armed);

  const arm = (side: TEdge) => {
    if (armed.current?.side === side) {
      return;
    }
    disarm();
    const wait = document.documentElement.animate([{}, {}], {
      duration: EDGE_DWELL_MS,
    });
    armed.current = { side, wait };
    wait.finished
      .then(() => {
        if (armed.current?.wait === wait) {
          armed.current = undefined;
          if (side === 'left') {
            setLeftOpen(true);
          } else {
            setRightOpen(true);
          }
        }
        return undefined;
      })
      // Cancelled: the pointer left the edge, which is the answer "no".
      .catch(() => undefined);
  };

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
    if (event.buttons !== 0) {
      return;
    }
    if (
      event.target instanceof Element &&
      event.target.closest(FLOATING_SURFACES)
    ) {
      return;
    }
    if (isLeftOpen && hasLeft(leftPanel(), event, 'left')) {
      setLeftOpen(false);
    }
    if (isRightOpen && hasLeft(rightPanel(), event, 'right')) {
      setRightOpen(false);
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
    const stop = () => cancelWait(armed);
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
