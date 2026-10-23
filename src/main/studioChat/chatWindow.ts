/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';

/**
 * The window the Studio's chat talks to: its page while it is open, and the
 * chat's handlers, each answering that page alone (any other is handed
 * `refused`) and all taken away again when the chat goes.
 */
const createChatWindow = (
  getMainWindow: () => BrowserWindow | null | undefined,
) => {
  const pageOf = () => {
    const window = getMainWindow();
    return window && !window.isDestroyed() ? window.webContents : undefined;
  };
  /** Only the app's own window may drive the chat, never another page. */
  const fromWindow = (event: IpcMainInvokeEvent) => pageOf() === event.sender;
  const channels: string[] = [];

  return {
    pageOf,
    fromWindow,
    handle: <T>(channel: string, refused: T, listener: (arg: unknown) => T) => {
      channels.push(channel);
      ipcMain.handle(channel, (event, arg: unknown) =>
        fromWindow(event) ? listener(arg) : refused,
      );
    },
    dispose: () => {
      channels.forEach((channel) => ipcMain.removeHandler(channel));
    },
  };
};

export default createChatWindow;
