/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { APP_ID } from '../common/branding';

/**
 * The development build's own Windows identity, beside the installed app's.
 *
 * Windows draws a taskbar button from the shortcut that carries the window's
 * application user model ID, not from the window's own icon, and the
 * installer's Start menu shortcut carries `APP_ID`. A `pnpm dev` window under
 * the same id was therefore drawn with the INSTALLED app's icon: the Lagoon
 * icon showed in the tray, which reads the file itself, while the taskbar
 * kept the icon of whatever release was installed (Ivan, 2026-09-26: "it
 * shows in tray but taskbar still old icon"). Under an id of its own there is
 * no shortcut to borrow from, and the window's icon is the one drawn — and
 * the development build and an installed FluidEQ running side by side stop
 * sharing one taskbar button.
 */
export const DEV_APP_ID = `${APP_ID}.dev`;

/** The id for a process that is (or is not) the development build. */
export const appUserModelIdFor = (isDevelopment: boolean): string =>
  isDevelopment ? DEV_APP_ID : APP_ID;

/**
 * This process's id: what the taskbar groups its windows under, and what
 * Windows files its media sessions under, so the system media watcher knows
 * which sessions are its own. `process.defaultApp` is Electron's own word for
 * "started by passing an app to the stock binary", which is `pnpm dev` and
 * never an installed build — and, having no Electron import, it reads the
 * same in the tests, where it is unset.
 */
export const APP_USER_MODEL_ID = appUserModelIdFor(process.defaultApp === true);
