/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { app } from 'electron';
import {
  readLinuxAutostart,
  writeLinuxAutostart,
} from './linux/linuxAutostart';

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
  /**
   * A development build, which Windows cannot start: nothing is written and
   * the row is not shown (`isStartableByWindows`).
   */
  unavailable?: boolean;
}

/**
 * The word Windows passes FluidEQ at sign-in, so the launch it makes starts
 * in the tray: running and applying its sound, with no window. Users reported
 * it opening its window at every sign-in (Ivan, 2026-10-29: "it needs to start
 * on the systray with the app closed but the app running in the systray
 * affecting the system audio"). A launch from the Start menu, a shortcut or
 * setup carries no such word and opens the window as it always has.
 */
export const START_IN_TRAY_ARG = '--start-in-tray';

/**
 * Only an installed FluidEQ can be started by Windows. A development build's
 * main process is TypeScript that `dev-main.cjs` compiles as it loads, and
 * its window comes from webpack's dev server, which `pnpm dev` starts and
 * nothing at sign-in does. The entry development used to write — Electron
 * pointed at the checkout — ran `main.ts` as plain JavaScript and put
 * "Cannot use import statement outside a module" on screen at every sign-in
 * (Ivan, 2026-10-29), so development writes none.
 */
const isStartableByWindows = () => app.isPackaged;

/** A packaged build is its own executable, started with nothing else. */
const appLaunch = () => ({ path: process.execPath, args: [] as string[] });

/** The entry Windows starts FluidEQ from: the app, told to start in the tray. */
const command = () => ({ ...appLaunch(), args: [START_IN_TRAY_ARG] });

const UNAVAILABLE: IStartWithWindows = {
  on: false,
  blockedByWindows: false,
  unavailable: true,
};

export const readStartWithWindows = (): IStartWithWindows => {
  if (!isStartableByWindows()) {
    return UNAVAILABLE;
  }
  if (process.platform === 'linux') {
    return readLinuxAutostart();
  }
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
  if (!isStartableByWindows()) {
    return UNAVAILABLE;
  }
  try {
    if (process.platform === 'linux') {
      writeLinuxAutostart(wanted);
    } else {
      app.setLoginItemSettings({ ...command(), openAtLogin: wanted });
    }
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

/**
 * An entry written before the tray's word existed opens the window at every
 * sign-in, and reads as off: Windows compares the whole command. Run once at
 * launch, this rewrites such an entry to the one that starts in the tray,
 * under the same name, so it replaces the old one rather than adding a
 * second. Windows' own Startup apps switch is carried over as it was —
 * Electron's write turns it on unless told otherwise, and an entry somebody
 * switched off there must not come back on because the app was updated.
 * Returns whether an entry was moved.
 */
export const moveStartWithWindowsIntoTray = (logger?: {
  info(message: string): void;
  error(message: string, ...details: unknown[]): void;
}): boolean => {
  if (
    !isStartableByWindows() ||
    app.getLoginItemSettings(command()).openAtLogin
  ) {
    return false;
  }
  const old = app.getLoginItemSettings(appLaunch());
  if (!old.openAtLogin) {
    return false;
  }
  try {
    app.setLoginItemSettings({
      ...command(),
      openAtLogin: true,
      enabled: old.executableWillLaunchAtLogin,
    });
  } catch (error) {
    logger?.error(
      'Could not move the Windows startup entry into the tray',
      error,
    );
    return false;
  }
  const moved = app.getLoginItemSettings(command()).openAtLogin;
  if (moved) {
    logger?.info('The Windows startup entry now starts FluidEQ in the tray');
  }
  return moved;
};
