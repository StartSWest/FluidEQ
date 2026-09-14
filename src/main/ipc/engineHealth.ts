/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import path from 'path';
import { ipcMain, type BrowserWindow } from 'electron';
import log from 'electron-log';
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
  /** Every change, for main's own listeners — `songProgramme.ts`. */
  onHealth?: (health: IEngineHealth) => void;
}

export interface IEngineHealthIpc {
  /**
   * A fresh read from main's side, which also starts the watch. For a caller
   * that needs to hear the engine's next status without the window asking.
   */
  read: () => Promise<IEngineHealth>;
}

/**
 * One line per output, for the log — everything the engine said about it
 * except the song it just levelled.
 *
 * The song is left out on purpose: it changes at the end of every track, and
 * a log that repeats the same state once a song buries the one line that
 * matters under a playlist. What is here is what answers "the engine is
 * installed and attached and I hear no EQ": whether Windows is running it,
 * whether it is changing the sound, whether it can see FluidEQ at all, and
 * the engine's own sentence for why it is passing through.
 */
export const summariseEngineHealth = (health: IEngineHealth): string[] =>
  health.outputs.map(
    ({ endpoint, locked, processing, owner, reason, problems }) =>
      `engine on ${endpoint}: running=${locked} processing=${processing} ` +
      `sees FluidEQ=${owner}` +
      `${reason ? ` reason="${reason}"` : ''}` +
      `${problems.length ? ` problems=${problems.join(',')}` : ''}`,
  );

export const registerEngineHealthIpc = ({
  getMainWindow,
  root = path.dirname(getFluidEngineConfigDir()),
  onHealth,
}: IEngineHealthIpcDeps): IEngineHealthIpc => {
  // Lives as long as the process: the window can ask again after any reload.
  let monitor: IEngineHealthMonitor | undefined;
  // What was last written to the log, so a status rewritten with the same
  // meaning — the engine rewrites one whenever it reloads — is not logged
  // again. Empty is a state too: the engine's statuses going away is worth
  // exactly one line.
  let logged: string | undefined;

  const record = (health: IEngineHealth) => {
    const lines = summariseEngineHealth(health);
    const text = lines.join('\n');
    if (text === logged) {
      return;
    }
    logged = text;
    log.info(lines.length ? text : 'engine: no output is going through it');
  };

  const push = (health: IEngineHealth) => {
    record(health);
    onHealth?.(health);
    const window = getMainWindow();
    if (window && !window.isDestroyed()) {
      window.webContents.send(ENGINE_HEALTH_CHANGED_CHANNEL, health);
    }
  };

  const read = async (): Promise<IEngineHealth> => {
    if (process.platform !== 'win32') {
      return NO_ENGINE_HEALTH;
    }
    monitor ??= createEngineHealthMonitor(root, push);
    // Never rejects — see `readEngineHealth` — but a handler that throws is
    // a rejection in the window, and the window asks from an event handler.
    const health = await monitor.read().catch(() => NO_ENGINE_HEALTH);
    // The first read is the one nothing pushed, and on a machine where the
    // engine never runs it is the only one there will ever be.
    record(health);
    return health;
  };

  ipcMain.handle(ENGINE_HEALTH_CHANNEL, read);
  return { read };
};
