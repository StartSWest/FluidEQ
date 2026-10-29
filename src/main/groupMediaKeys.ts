/* FluidEQ — GPL-3.0-or-later */
import { globalShortcut, ipcMain, type BrowserWindow } from 'electron';
import log from 'electron-log';
import {
  GROUP_MEDIA_COMMAND,
  GROUP_MEDIA_KEYS,
  GROUP_MEDIA_WATCH,
} from '../common/groupMediaTransport';
import type { TRemoteTransportCommand } from '../common/remoteAudio';

let forward: ((command: TRemoteTransportCommand) => boolean) | undefined;

/** Also used by the titlebar/taskbar: synthesizing a media key while we own
 * that key would catch our own output and send the command around again. */
export const forwardGroupMediaCommand = (command: TRemoteTransportCommand) =>
  forward?.(command) === true;

const installGroupMediaKeys = (window: BrowserWindow) => {
  let watching = false;
  const held = new Set<string>();
  const release = () => {
    watching = false;
    held.forEach((key) => globalShortcut.unregister(key));
    held.clear();
  };
  const deliver = (command: TRemoteTransportCommand): boolean => {
    if (
      !watching ||
      window.isDestroyed() ||
      window.webContents.isDestroyed() ||
      window.webContents.isLoadingMainFrame()
    ) {
      return false;
    }
    window.webContents.send(GROUP_MEDIA_COMMAND, command);
    return true;
  };
  forward = deliver;
  ipcMain.handle(GROUP_MEDIA_WATCH, (event, enabled: unknown) => {
    if (
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame
    ) {
      return;
    }
    if (enabled !== true) {
      release();
      return;
    }
    watching = true;
    GROUP_MEDIA_KEYS.forEach(([key, command]) => {
      if (!held.has(key)) {
        try {
          if (globalShortcut.register(key, () => deliver({ command }))) {
            held.add(key);
          } else {
            log.warn('Share Audio media key is unavailable', key);
          }
        } catch (error) {
          log.warn('Could not register Share Audio media key', key, error);
        }
      }
    });
  });
  window.webContents.on('render-process-gone', release);
  window.webContents.on('did-start-navigation', (event) => {
    if (event.isMainFrame && !event.isSameDocument) {
      release();
    }
  });
  window.once('closed', () => {
    release();
    ipcMain.removeHandler(GROUP_MEDIA_WATCH);
    if (forward === deliver) {
      forward = undefined;
    }
  });
};
export default installGroupMediaKeys;
