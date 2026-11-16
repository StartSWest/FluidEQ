/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useEffectEvent } from 'react';

/**
 * How close to the window's side the pointer has to come for a full-screen
 * panel to open: the very edge, as an auto-hiding taskbar is reached. Wider,
 * the lowest band of the curve, which lives at the plot's left, would pull
 * the drawer out every time it was dragged.
 */
export const EDGE_OPENS_PX = 3;

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
 * the panel's edge. Only pointer moves decide, so nothing opens or shuts on
 * its own while the pointer rests.
 */
const useEdgeOpensPanels = ({
  isActive,
  isLeftOpen,
  isRightOpen,
  setLeftOpen,
  setRightOpen,
}: IEdgePanels) => {
  const onMove = useEffectEvent((event: PointerEvent) => {
    if (event.pointerType === 'touch') {
      return;
    }
    if (event.clientX <= EDGE_OPENS_PX) {
      if (!isLeftOpen) {
        setLeftOpen(true);
      }
      return;
    }
    if (event.clientX >= window.innerWidth - 1 - EDGE_OPENS_PX) {
      if (!isRightOpen) {
        setRightOpen(true);
      }
      return;
    }
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
    window.addEventListener('pointermove', listener, { passive: true });
    return () => window.removeEventListener('pointermove', listener);
  }, [isActive]);
};

export default useEdgeOpensPanels;
