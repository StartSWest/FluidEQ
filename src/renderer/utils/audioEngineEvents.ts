/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Told when the chosen engine may have changed, by whatever changed it.
 *
 * A module-level subscription rather than a DOM event: which engine main is
 * running is application state, not a fact about the window, and every
 * component holding a `useAudioEngineStatus()` snapshot needs to hear about a
 * change without knowing who else might have caused it. The hook itself
 * subscribes and re-fetches on every notification, so calling
 * `notifyAudioEngineChanged()` from anywhere — a dialog that just switched
 * engines, a future settings page — is enough to bring every open snapshot
 * current. No timers: nothing here polls, because the moment worth reacting
 * to is always a specific caller's own success, and that caller can say so.
 */

const listeners = new Set<() => void>();

export const notifyAudioEngineChanged = (): void => {
  listeners.forEach((listener) => listener());
};

export const subscribeAudioEngineChanged = (
  listener: () => void,
): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
