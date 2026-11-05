/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import path from 'path';
import { app, globalShortcut, ipcMain, type BrowserWindow } from 'electron';
import log from 'electron-log';
import {
  ENGINE_KEY_GET,
  ENGINE_KEY_PRESSED,
  ENGINE_KEY_SET,
  engineKeyProblem,
  TEngineKeyAnswer,
} from '../common/engineKey';
import { scheduleWrite } from './asyncWriter';

/** Electron's `globalShortcut`, as much of it as the key uses. */
export interface IShortcuts {
  register: (accelerator: string, callback: () => void) => boolean;
  unregister: (accelerator: string) => void;
}

const FILE = 'engine-key.json';

/**
 * The on/off key held system-wide (`common/engineKey.ts`), and kept in a file
 * of its own so it is held again from the next launch. Main only holds the
 * key and says it was pressed: the window turns the engine off and on, the
 * same way its power switch does, so there is one switch and not two.
 */
export const createEngineKey = (
  filePath: string,
  shortcuts: IShortcuts,
  onPress: () => void,
) => {
  let held = '';

  /** Holds `accelerator` in place of whatever is held; '' holds none. */
  const hold = (accelerator: string): boolean => {
    if (held !== '') {
      shortcuts.unregister(held);
      held = '';
    }
    if (accelerator === '') {
      return true;
    }
    let taken = false;
    try {
      taken = !shortcuts.register(accelerator, onPress);
    } catch (error) {
      log.warn('The on/off key could not be held', accelerator, error);
      taken = true;
    }
    if (!taken) {
      held = accelerator;
    }
    return !taken;
  };

  const saved = (): string => {
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const accelerator =
        typeof parsed === 'object' && parsed !== null
          ? (parsed as Record<string, unknown>).accelerator
          : undefined;
      return typeof accelerator === 'string' &&
        engineKeyProblem(accelerator) === undefined
        ? accelerator
        : '';
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        log.warn('Could not read the on/off key', error);
      }
      return '';
    }
  };

  return {
    /** The key held now; '' for none, or one another program took first. */
    current: (): string => held,

    /** The saved key held again, as the window opens. */
    start: (): void => {
      const accelerator = saved();
      if (accelerator !== '' && !hold(accelerator)) {
        log.warn('Another program holds the on/off key', accelerator);
      }
    },

    /** A new key held and kept, or none; the old one kept when it fails. */
    set: async (accelerator: unknown): Promise<TEngineKeyAnswer> => {
      if (typeof accelerator !== 'string') {
        return { ok: false, problem: 'invalid' };
      }
      const problem =
        accelerator === '' ? undefined : engineKeyProblem(accelerator);
      if (problem) {
        return { ok: false, problem };
      }
      const before = held;
      if (!hold(accelerator)) {
        hold(before);
        return { ok: false, problem: 'taken' };
      }
      await scheduleWrite(filePath, JSON.stringify({ accelerator }, null, 2));
      return { ok: true, accelerator };
    },

    /** Lets the key go, for the window closing. */
    stop: (): void => {
      hold('');
    },
  };
};

/** The key for this window: held while it lives, asked about by it alone. */
const installEngineKey = (window: BrowserWindow): void => {
  const key = createEngineKey(
    path.join(app.getPath('userData'), FILE),
    globalShortcut,
    () => {
      if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
        window.webContents.send(ENGINE_KEY_PRESSED);
      }
    },
  );
  key.start();
  const fromWindow = (event: Electron.IpcMainInvokeEvent) =>
    event.sender === window.webContents &&
    event.senderFrame === window.webContents.mainFrame;
  ipcMain.handle(ENGINE_KEY_GET, (event) =>
    fromWindow(event) ? key.current() : '',
  );
  ipcMain.handle(ENGINE_KEY_SET, (event, accelerator: unknown) =>
    fromWindow(event)
      ? key.set(accelerator)
      : { ok: false, problem: 'invalid' },
  );
  window.once('closed', () => {
    key.stop();
    ipcMain.removeHandler(ENGINE_KEY_GET);
    ipcMain.removeHandler(ENGINE_KEY_SET);
  });
};

export default installEngineKey;
