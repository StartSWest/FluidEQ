/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Windows' own Sound page, where the switch FluidEQ cannot reach lives.
 *
 * An output's "Audio enhancements" switch belongs to Windows and to the
 * machine's administrator; while it is off, Windows loads no system effect on
 * that output and the FluidEQ Engine is never run there, however correctly it
 * is installed and attached. The only honest thing the app can do is take the
 * listener to the page that has the switch.
 *
 * Opened through `window.open`, which the main window hands to the external
 * gate (`safeExternal.ts`) — the fixed string below is the only non-web
 * address that gate lets through, and it carries nothing from this window.
 */
export const WINDOWS_SOUND_SETTINGS_URL = 'ms-settings:sound';

export const openWindowsSoundSettings = (): void => {
  window.open(WINDOWS_SOUND_SETTINGS_URL);
};
