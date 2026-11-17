/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';

/**
 * WHAT THE BAND POPOVER IS OPENED FROM: the Shift key, where the keyboard
 * is, and whether a press inside the popover is still down. One store, the
 * only thing that reads them; whether the popover is up is worked out from
 * it and the selection in one place (`useBandPopoverState`, Ivan,
 * 2026-11-17: "basically it shows while Shift is held, whether moving or
 * not, as long as a band is selected and in focus"; "it's a single piece of
 * code, don't add patches").
 *
 * - Shift: down from its keydown to its keyup, and up whenever the window
 *   loses the keyboard (a keyup let go in another window never arrives).
 *   Neither counts while typing in a field, nor does a key's repeat.
 * - Focus: the band whose slider, caption or column, or whose graph handle,
 *   has the keyboard; or the popover itself, with any menu it has open.
 *   Read from `focusout`'s `relatedTarget` as well as `focusin`, so a move
 *   between two controls never passes through "nothing focused".
 * - A press that began in the popover — a dial being turned — holds it up
 *   past Shift's release until it is let go.
 * - Escape and the popover's close put it away until Shift is pressed again.
 *
 * Listening only while somebody is subscribed: the EQ page, with the bands
 * or the graph in view.
 */
export type TBandFocus =
  | { kind: 'band'; id: string }
  | { kind: 'graph'; id: string; card: HTMLElement }
  | { kind: 'popover' }
  | undefined;

interface IBandPopoverKeys {
  isShiftDown: boolean;
  isPressInPopover: boolean;
  isDismissed: boolean;
  focus: TBandFocus;
}

const POPOVER = '.eq-flat-editor--popover';

let keys: IBandPopoverKeys = {
  isShiftDown: false,
  isPressInPopover: false,
  isDismissed: false,
  focus: undefined,
};
const listeners = new Set<() => void>();

const update = (patch: Partial<IBandPopoverKeys>) => {
  const next = { ...keys, ...patch };
  if (
    next.isShiftDown === keys.isShiftDown &&
    next.isPressInPopover === keys.isPressInPopover &&
    next.isDismissed === keys.isDismissed &&
    next.focus === keys.focus
  ) {
    return;
  }
  keys = next;
  listeners.forEach((listener) => listener());
};

/** A field being typed into: Shift there is a capital, not the popover. */
const NOT_TYPED = new Set([
  'range',
  'checkbox',
  'radio',
  'button',
  'submit',
  'reset',
  'color',
  'file',
]);
const isTypedInto = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLInputElement && !NOT_TYPED.has(target.type)));

const sameFocus = (a: TBandFocus, b: TBandFocus) =>
  a?.kind === b?.kind &&
  (a?.kind !== 'band' || (b?.kind === 'band' && a.id === b.id)) &&
  (a?.kind !== 'graph' ||
    (b?.kind === 'graph' && a.id === b.id && a.card === b.card));

const focusOf = (target: EventTarget | null): TBandFocus => {
  if (!(target instanceof Element)) {
    return undefined;
  }
  // The popover's menus are portalled out of it; while it is up, a menu is
  // its (the filter list is the only one it has).
  if (
    target.closest(POPOVER) ||
    (target.closest('.dropdown-menu-layer') && document.querySelector(POPOVER))
  ) {
    return { kind: 'popover' };
  }
  const handle = target.closest('.graph-edit-point[data-filter-id]');
  const card = handle?.closest('.graph-wrapper');
  const handleId = handle?.getAttribute('data-filter-id');
  if (handleId && card instanceof HTMLElement) {
    return { kind: 'graph', id: handleId, card };
  }
  const bandId = target
    .closest('.bandWrapper[data-filter-id]')
    ?.getAttribute('data-filter-id');
  return bandId ? { kind: 'band', id: bandId } : undefined;
};

const focusTo = (target: EventTarget | null) => {
  const focus = focusOf(target);
  if (!sameFocus(focus, keys.focus)) {
    update({ focus });
  }
};

const onKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Shift' && !event.repeat && !isTypedInto(event.target)) {
    update({ isShiftDown: true, isDismissed: false });
  }
};

const onKeyUp = (event: KeyboardEvent) => {
  if (event.key === 'Shift' && !isTypedInto(event.target)) {
    update({ isShiftDown: false });
  }
};

const onBlur = (event: FocusEvent) => {
  // The window's own blur, not a control's bubbling up to it.
  if (event.target === window) {
    update({ isShiftDown: false, isPressInPopover: false });
  }
};

const onFocusIn = (event: FocusEvent) => focusTo(event.target);
const onFocusOut = (event: FocusEvent) => focusTo(event.relatedTarget);

const onPointerDown = (event: PointerEvent) =>
  update({
    isPressInPopover:
      event.target instanceof Element && Boolean(event.target.closest(POPOVER)),
  });

const onPointerUp = () => update({ isPressInPopover: false });

let listening: AbortController | undefined;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  if (!listening) {
    listening = new AbortController();
    const options = { capture: true, signal: listening.signal };
    window.addEventListener('keydown', onKeyDown, options);
    window.addEventListener('keyup', onKeyUp, options);
    window.addEventListener('blur', onBlur, options);
    window.addEventListener('focusin', onFocusIn, options);
    window.addEventListener('focusout', onFocusOut, options);
    window.addEventListener('pointerdown', onPointerDown, options);
    window.addEventListener('pointerup', onPointerUp, options);
    window.addEventListener('pointercancel', onPointerUp, options);
    focusTo(document.activeElement);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      listening?.abort();
      listening = undefined;
      update({ isShiftDown: false, isPressInPopover: false, focus: undefined });
    }
  };
};

const snapshot = () => keys;

export const useBandPopoverKeys = (): IBandPopoverKeys =>
  useSyncExternalStore(subscribe, snapshot);

/** Escape, or the popover's close: away until Shift is pressed again. */
export const dismissBandPopover = () => update({ isDismissed: true });
