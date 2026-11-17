/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';

/**
 * THE BAND POPOVER IS HELD OPEN BY SHIFT (Ivan, 2026-11-17: "let's not show
 * the popup, only when the user presses Shift while pressing the band it
 * shows, so it doesn't show for nothing"; "and when shift is released it
 * closes"; "also in the graph it appears above if I press shift").
 *
 * A press with Shift on a band's slider, its caption or its column, on a
 * graph handle, or Shift+Enter on either from the keyboard, opens it on that
 * band, and letting Shift go closes it. A plain press selects and drags as it
 * always did and opens nothing.
 *
 * - A press still held when Shift goes up — a dial or a slider being dragged,
 *   the handle the popover opened on — finishes first, and the popover closes
 *   when it is let go.
 * - The window losing the keyboard closes it at once: the Shift that went up
 *   in another window never sends its keyup here, and a press in progress is
 *   not coming back either.
 * - Escape and its own close button close it and keep the selection; a press
 *   elsewhere empties the selection, and the popover goes with it.
 *
 * Shared, because two places open it — the bands and the graph — and one
 * page draws it (`EqBandPopovers`). Where it is drawn is the anchor: against
 * the band's slider, or over the handle on the graph's card, which is the
 * graph's own element (the popover is portalled into it).
 */
export type TBandPopoverAnchor =
  { kind: 'band' } | { kind: 'graph'; card: HTMLElement };

interface IBandPopoverState {
  isOpen: boolean;
  /** Kept after closing, so the way out plays where it was. */
  anchor: TBandPopoverAnchor;
}

let state: IBandPopoverState = { isOpen: false, anchor: { kind: 'band' } };
const listeners = new Set<() => void>();

const publish = (next: IBandPopoverState) => {
  state = next;
  listeners.forEach((listener) => listener());
};

/** A pointer is down, so a released Shift waits for it to come up. */
let isPressed = false;
let closeOnRelease = false;
/** Ends the hold's listeners, all at once. */
let hold: AbortController | undefined;

export const closeBandPopover = () => {
  closeOnRelease = false;
  if (!state.isOpen) {
    return;
  }
  hold?.abort();
  hold = undefined;
  publish({ ...state, isOpen: false });
};

const onPointerDown = () => {
  isPressed = true;
};

const onPointerUp = () => {
  isPressed = false;
  if (closeOnRelease) {
    closeBandPopover();
  }
};

const onKeyUp = (event: KeyboardEvent) => {
  if (event.key !== 'Shift') {
    return;
  }
  if (isPressed) {
    closeOnRelease = true;
    return;
  }
  closeBandPopover();
};

const onBlur = () => {
  isPressed = false;
  closeBandPopover();
};

/**
 * Open it on the band just selected. `byPointer` when a press opened it: that
 * press is still down, and the hold waits for it like any other.
 */
export const openBandPopover = (
  anchor: TBandPopoverAnchor,
  byPointer: boolean,
) => {
  isPressed = byPointer;
  closeOnRelease = false;
  if (!hold) {
    hold = new AbortController();
    const { signal } = hold;
    window.addEventListener('pointerdown', onPointerDown, {
      capture: true,
      signal,
    });
    window.addEventListener('pointerup', onPointerUp, {
      capture: true,
      signal,
    });
    window.addEventListener('pointercancel', onPointerUp, {
      capture: true,
      signal,
    });
    window.addEventListener('keyup', onKeyUp, { capture: true, signal });
    window.addEventListener('blur', onBlur, { signal });
  }
  publish({ isOpen: true, anchor });
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const snapshot = () => state;

export const useBandPopover = (): IBandPopoverState =>
  useSyncExternalStore(subscribe, snapshot);
