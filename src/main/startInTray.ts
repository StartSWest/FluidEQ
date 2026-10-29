/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The word the system passes FluidEQ at sign-in, so the launch it makes starts
 * in the tray: running and applying its sound, with no window. Users reported
 * it opening its window at every sign-in (Ivan, 2026-10-29: "it needs to start
 * on the systray with the app closed but the app running in the systray
 * affecting the system audio"). A launch from the Start menu, a shortcut or
 * setup carries no such word and opens the window as it always has.
 *
 * A module of its own because both startup entries write it — Windows' login
 * item (`startWithWindows.ts`) and Linux's autostart file
 * (`linux/linuxAutostart.ts`), which the first imports.
 */
const START_IN_TRAY_ARG = '--start-in-tray';

export default START_IN_TRAY_ARG;
