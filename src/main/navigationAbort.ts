/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Whether a load was abandoned for a newer navigation of the same window
 * (Chromium's ERR_ABORTED, -3), rather than failing.
 *
 * Not a failure: the navigation that replaced it is already on its way and
 * loads the page itself. In development electronmon reloads the window for
 * every renderer file it sees change, so a change touching thirty files sends
 * thirty reloads, each abandoning the one before; read as failures, the first
 * one handed the window to recovery, whose own `about:blank` was abandoned
 * by the next reload, and recovery gave up with the window blank (Ivan,
 * 2026-11-16: "Initial window load failed ... Window recovery failed;
 * automatic retry stopped").
 */
const isSupersededNavigation = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const { code, errno } = error as { code?: unknown; errno?: unknown };
  return code === 'ERR_ABORTED' || errno === -3;
};

export default isSupersededNavigation;
