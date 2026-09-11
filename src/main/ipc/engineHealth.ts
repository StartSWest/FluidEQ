/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import path from 'path';
import { ipcMain, type BrowserWindow } from 'electron';
import {
  ENGINE_HEALTH_CHANGED_CHANNEL,
  ENGINE_HEALTH_CHANNEL,
  NO_ENGINE_HEALTH,
  type IEngineHealth,
} from '../../common/engineHealth';
import {
  createEngineHealthMonitor,
  type IEngineHealthMonitor,
} from '../engineHealth';
import { getFluidEngineConfigDir } from '../registry';

/**
 * What the FluidEQ Engine says about each output, over IPC: a fresh read on
 * request, and every change after that pushed to the window as it happens.
 *
 * The monitor starts on the first request rather than at registration, so a
 * machine running Equalizer APO — whose window never asks — watches nothing.
 */

export interface IEngineHealthIpcDeps {
  getMainWindow: () => BrowserWindow | null;
  /** `%ProgramData%\FluidEQ\engine`, where the engine writes its statuses. */
  root?: string;
}

export const registerEngineHealthIpc = ({
  getMainWindow,
  root = path.dirname(getFluidEngineConfigDir()),
}: IEngineHealthIpcDeps): void => {
  // Lives as long as the process: the window can ask again after any reload.
  let monitor: IEngineHealthMonitor | undefined;

  const push = (health: IEngineHealth) => {
    const window = getMainWindow();
    if (window && !window.isDestroyed()) {
      window.webContents.send(ENGINE_HEALTH_CHANGED_CHANNEL, health);
    }
  };

  ipcMain.handle(ENGINE_HEALTH_CHANNEL, async (): Promise<IEngineHealth> => {
    if (process.platform !== 'win32') {
      return NO_ENGINE_HEALTH;
    }
    monitor ??= createEngineHealthMonitor(root, push);
    // Never rejects — see `readEngineHealth` — but a handler that throws is
    // a rejection in the window, and the window asks from an event handler.
    return monitor.read().catch(() => NO_ENGINE_HEALTH);
  });
};
