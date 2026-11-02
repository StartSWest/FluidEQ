/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import log from 'electron-log';
import { quitRecipe } from '../engineQuitReset';
import type { TTraySurfaceFactory } from '../trayView';
import { nativeTraySurface } from './nativeTray';
import { findTrayHost, ITrayHostParts, startTrayHost } from './trayHostProcess';
import { ITrayRelaunch, trayHostKey } from './trayHostWire';

export interface INativeTray {
  /** For `setUpTray`: the icon and its menu, drawn by FluidEQ-Tray. */
  surface: TTraySurfaceFactory;
  /** The engine's folder changed: what a quit would have to undo. */
  setConfigPath: (configPath: string) => void;
  /** Main ends with FluidEQ going on; the tray starts it with `relaunch`. */
  leave: (relaunch: ITrayRelaunch) => Promise<boolean>;
}

export interface INativeTrayOptions {
  userDataDir: string;
  /** The engine's line for it to serve; none in a sealed sandbox. */
  ownerPipe?: string;
  /** The engine's folder as the session knows it now. */
  configPath: string;
  /** FluidEQ-Tray ended while FluidEQ runs. */
  onLost: () => void;
  /** Where the program is: beside the app, or in the development build. */
  find?: () => string | undefined;
  parts?: ITrayHostParts;
}

/**
 * FluidEQ-Tray on Windows, running and told what to undo; undefined where it
 * cannot run, which leaves the icon to Electron's tray and the engine's line
 * to main (`engineOwnerPipe.ts`). Awaited before the window, as the engine's
 * line always was: nothing writes an engine configuration before it is held.
 */
export const startNativeTray = async ({
  userDataDir,
  ownerPipe,
  configPath,
  onLost,
  find = findTrayHost,
  parts,
}: INativeTrayOptions): Promise<INativeTray | undefined> => {
  if (process.platform !== 'win32') {
    return undefined;
  }
  const executable = find();
  if (!executable) {
    log.warn('FluidEQ-Tray is not beside the app; Electron draws the tray.');
    return undefined;
  }
  const host = await startTrayHost(
    { executable, key: trayHostKey(userDataDir), ownerPipe },
    parts,
  );
  if (!host) {
    return undefined;
  }
  log.info(`FluidEQ-Tray is running (pid ${host.pid}).`);
  if (ownerPipe && !host.servesOwnerPipe) {
    log.warn(
      'The FluidEQ Engine cannot see FluidEQ end: FluidEQ-Tray could not serve its pipe.',
    );
  }
  // Only once this run has an engine folder, as main's own quit does
  // (`resetActiveEngineForQuit`).
  const setConfigPath = (next: string) =>
    host.setRecipe(next ? quitRecipe(next) : undefined);
  setConfigPath(configPath);
  host.onLost(onLost);
  return {
    surface: nativeTraySurface(host),
    setConfigPath,
    leave: (relaunch) => host.leave(relaunch),
  };
};
