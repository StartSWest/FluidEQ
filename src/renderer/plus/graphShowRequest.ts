/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * "Show the graph on the EQ page", from anywhere — the announcement of new
 * scenes plays its first one there. The same shape as `requestPlusTab`: a
 * module-level request with one listener in practice (`App.tsx`), which runs
 * what the gallery's "show on the graph" already runs.
 */

const listeners = new Set<() => void>();

export const subscribeGraphShowRequests = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const requestGraphShow = () => {
  listeners.forEach((listener) => listener());
};
