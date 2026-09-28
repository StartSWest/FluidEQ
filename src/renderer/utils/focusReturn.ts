/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Remember what has focus as a dialog opens, and return a function that
 * gives focus back to it as it was when the dialog closes.
 *
 * "As it was" is the point. Handed back with a plain `focus()`, a control
 * pressed with the pointer came back wearing its keyboard ring whenever the
 * dialog was closed with Escape: the key counts as keyboard use, and Chromium
 * shows the ring on the next focus a script moves. The Preset chip's "i" then
 * stayed lit after its notes were closed (Ivan, 2026-09-27: "fix tooltip
 * icon on preset it sticks"). It comes back ringed only if it was ringed
 * when the dialog took focus from it.
 *
 * Call it before the dialog moves focus anywhere, or the ring read is the
 * dialog's own. Nothing is focused when the opener has left the page, which
 * a menu's preview has by the time a dialog it opened closes.
 */
export default function holdFocusReturn(): () => void {
  const { activeElement } = document;
  const opener =
    activeElement instanceof HTMLElement ? activeElement : undefined;
  const wasRinged = opener?.matches(':focus-visible') ?? false;
  return () => {
    if (opener?.isConnected) {
      opener.focus({ focusVisible: wasRinged });
    }
  };
}
