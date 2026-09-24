/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Whether this window is a Mac's: AppKit's traffic lights in the strip at its
 * top, and none of the minimise, maximise and close the page draws for
 * Windows (`macWindowChrome.ts` in main).
 */
const runsOnMac = (): boolean => window.electron?.platform === 'darwin';

export default runsOnMac;
