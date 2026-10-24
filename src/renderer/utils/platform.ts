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

/**
 * Whether this window is Linux's: one engine, FluidEQ's own, beside the sound
 * server — no Equalizer APO, no Windows prompts, no Windows-only helpers
 * (Dynamic lighting, desktop backgrounds), so their screens are not shown.
 */
export const runsOnLinux = (): boolean => window.electron?.platform === 'linux';
