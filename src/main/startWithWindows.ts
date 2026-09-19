/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { app } from 'electron';

/**
 * Whether FluidEQ starts with Windows.
 *
 * Nothing is stored by the app: Windows holds the answer, under the current
 * user's own `Run` key, and `app.setLoginItemSettings` writes it there. That
 * is also why this needs no administrator — the key belongs to the person
 * signed in, and a per-user startup entry is theirs to set. Anything that did
 * ask for administrator here would be writing somewhere it has no business:
 * a machine-wide startup entry starts the app for everybody who signs into
 * this computer, which is not what the row in the menu says.
 *
 * Two facts, not one. Windows keeps a second switch of its own — Startup apps
 * in Settings, and the Startup tab of Task Manager — and a person who turns
 * FluidEQ off there has turned it off whatever the `Run` key says. Electron
 * reports that as `executableWillLaunchAtLogin`, and the app may not overrule
 * it: the row says so instead, and points at where it was decided.
 */

export interface IStartWithWindows {
  /** The entry is written: what the row's switch shows. */
  on: boolean;
  /**
   * The entry is written and Windows will not honour it — switched off in
   * Windows' own Startup apps. Never true while `on` is false.
   */
  blockedByWindows: boolean;
  /** The last write failed, and the switch is not what was asked for. */
  failed?: boolean;
}

/**
 * In development `process.execPath` is Electron's own binary, which launches
 * nothing without the app beside it; a packaged build is the app. Registering
 * the wrong command would write an entry that opens an empty Electron at
 * every sign-in, which is worse than refusing.
 */
const command = () =>
  app.isPackaged
    ? { path: process.execPath, args: [] as string[] }
    : { path: process.execPath, args: [app.getAppPath()] };

export const readStartWithWindows = (): IStartWithWindows => {
  const settings = app.getLoginItemSettings(command());
  return {
    on: settings.openAtLogin,
    // `executableWillLaunchAtLogin` answers for the command asked about, and
    // is the only way to see Windows' own switch from here.
    blockedByWindows:
      settings.openAtLogin && !settings.executableWillLaunchAtLogin,
  };
};

export const writeStartWithWindows = (
  wanted: boolean,
  logger?: { error(message: string, ...details: unknown[]): void },
): IStartWithWindows => {
  try {
    app.setLoginItemSettings({ ...command(), openAtLogin: wanted });
  } catch (error) {
    logger?.error(
      'Could not change whether FluidEQ starts with Windows',
      error,
    );
    return { ...readStartWithWindows(), failed: true };
  }
  // Read it back rather than believing the write: the answer the row shows is
  // Windows', and a write that changed nothing must not leave the switch on.
  const now = readStartWithWindows();
  return now.on === wanted ? now : { ...now, failed: true };
};
