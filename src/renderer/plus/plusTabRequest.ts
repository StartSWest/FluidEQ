/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * "Show the Plus tab", from anywhere — the graph's notice that the look it is
 * playing has a new version opens that scene's page, and the tabs are
 * `App.tsx`'s. The same shape as `requestAccountPanel`: a module-level request
 * with one listener in practice, dropped when nobody listens.
 */

const listeners = new Set<() => void>();

export const subscribePlusTabRequests = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const requestPlusTab = () => {
  listeners.forEach((listener) => listener());
};
