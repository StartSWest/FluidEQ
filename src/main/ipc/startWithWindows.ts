/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ipcMain } from 'electron';
import {
  readStartWithWindows,
  writeStartWithWindows,
  type IStartWithWindows,
} from '../startWithWindows';

const CHANNELS = ['start-with-windows-get', 'start-with-windows-set'] as const;

/** What the row shows, as the renderer sees it. */
export type TStartWithWindowsState = IStartWithWindows;

/**
 * The tools menu's "Start with Windows" row.
 *
 * Read and write only — the state lives in Windows, so there is nothing to
 * announce and nothing to keep. Every answer is read back from Windows after
 * the write, which is what lets the row show a refusal rather than a switch
 * that lies (`startWithWindows.ts`).
 */
export const registerStartWithWindowsIpc = ({
  logger,
}: {
  logger?: { error(message: string, ...details: unknown[]): void };
} = {}) => {
  ipcMain.handle('start-with-windows-get', (): IStartWithWindows =>
    readStartWithWindows(),
  );

  ipcMain.handle(
    'start-with-windows-set',
    (_event, wanted: unknown): IStartWithWindows =>
      typeof wanted === 'boolean'
        ? writeStartWithWindows(wanted, logger)
        : readStartWithWindows(),
  );

  return {
    dispose: () =>
      CHANNELS.forEach((channel) => ipcMain.removeHandler(channel)),
  };
};
