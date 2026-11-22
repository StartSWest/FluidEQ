/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  clipboard,
  ipcMain,
  type BrowserWindow,
  type IpcMainInvokeEvent,
} from 'electron';
import {
  CLIPBOARD_HAS_TEXT,
  CLIPBOARD_READ_TEXT,
} from '../../common/clipboardText';

/**
 * The clipboard for the window's Paste buttons, read in main rather than
 * through `navigator.clipboard`, which asks a permission of the page and
 * reads nothing while the window is not focused.
 *
 * Answered to the app's own page alone: never to a Media page or a frame
 * inside the window, which could otherwise read whatever was copied.
 */
const registerClipboardTextIpc = (
  getMainWindow: () => BrowserWindow | null,
): { dispose: () => void } => {
  const fromWindow = (event: IpcMainInvokeEvent) => {
    const window = getMainWindow();
    return (
      window !== null &&
      !window.isDestroyed() &&
      event.sender === window.webContents &&
      event.senderFrame === window.webContents.mainFrame
    );
  };

  // Formats only: no text crosses for this question (`common/clipboardText`).
  ipcMain.handle(
    CLIPBOARD_HAS_TEXT,
    (event): boolean =>
      fromWindow(event) && clipboard.availableFormats().includes('text/plain'),
  );
  ipcMain.handle(CLIPBOARD_READ_TEXT, (event): string =>
    fromWindow(event) ? clipboard.readText() : '',
  );

  return {
    dispose: () => {
      ipcMain.removeHandler(CLIPBOARD_HAS_TEXT);
      ipcMain.removeHandler(CLIPBOARD_READ_TEXT);
    },
  };
};

export default registerClipboardTextIpc;
