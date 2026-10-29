/* FluidEQ — GPL-3.0-or-later */

import { app, ipcMain, type BrowserWindow } from 'electron';
import log from 'electron-log';

/**
 * Chromium's Mac OSCrypt marks the Keychain tried even when deriving its key
 * fails. It never tries again in that process (Electron 43.2.0's restored
 * os_crypt_mac.mm, DeriveKey). Only a user-requested fresh launch retries;
 * changing the account store or weakening encryption cannot repair that cache.
 */
const registerMacKeychainIpc = (getWindow: () => BrowserWindow | null) => {
  if (process.platform !== 'darwin') {
    return;
  }
  let restarting = false;
  ipcMain.handle('mac-restart-for-keychain', (event) => {
    const window = getWindow();
    if (
      !window ||
      window.isDestroyed() ||
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame ||
      !app.isPackaged
    ) {
      // The development session owns its own launch/server lifetime. It must
      // be restarted by its owner, not detached from that session by this UI.
      return false;
    }
    if (restarting) {
      return true;
    }
    // relaunch() queues a new process on EACH call. The main-process guard
    // also covers duplicate IPC while the normal quit path drains writes.
    restarting = true;
    try {
      app.relaunch();
      app.quit();
      return true;
    } catch (error) {
      restarting = false;
      log.error(
        'Could not restart FluidEQ to retry Mac Keychain access',
        error,
      );
      return false;
    }
  });
};

export default registerMacKeychainIpc;
