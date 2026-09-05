/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/**
 * The rules the built-in player runs under.
 *
 * Embedding Chromium in a desktop app means the app now has an attack surface
 * the size of the web, and none of the things a real browser has grown to
 * defend it — no omnibox showing where you actually are, no Safe Browsing, no
 * separate process boundary the user understands. So the player is not given
 * the web: it is given six sites, no silent downloads, no permissions worth
 * having, and a page that tries to leave simply does not. A download only
 * proceeds through the OS Save As dialog and is reported back to FluidEQ.
 *
 * Every one of these is enforced here, in the main process. The renderer half
 * of the player checks the same list, but only so it can say something useful
 * when a link goes nowhere — a compromised renderer could skip its check, and
 * this file is what makes that not matter.
 */

import {
  app,
  BrowserWindow,
  ipcMain,
  session,
  shell,
  WebContents,
} from 'electron';
import log from 'electron-log';
import fs from 'fs';
import path from 'path';
import openExternalIfSafe from './safeExternal';
import {
  HOME_SITE,
  attachedPlayers,
  isAdBlockEnabled,
  setAdBlockEnabled,
  isPermissionGranted,
} from './videoSessionBasics';
import { hardenAttachment, hardenPlayer, hardenPopup } from './videoHardening';
import { VIDEO_BROWSER_PARTITION } from '../common/videoSites';
import {
  VIDEO_AD_BLOCK_CHANGED,
  VIDEO_AD_BLOCK_REQUEST,
} from '../common/videoAdBlock';
import {
  IVideoDownloadUpdate,
  TVideoDownloadPhase,
  VIDEO_DOWNLOAD_CHANGED,
  VIDEO_DOWNLOAD_REVEAL,
} from '../common/videoDownloads';

const completedVideoDownloads = new Set<string>();
let nextVideoDownloadId = 0;

const sendVideoDownloadUpdate = (
  source: WebContents,
  update: IVideoDownloadUpdate,
) => {
  const host = source.hostWebContents;
  if (host && !host.isDestroyed()) {
    host.send(VIDEO_DOWNLOAD_CHANGED, update);
    return;
  }
  BrowserWindow.getAllWindows().forEach((window) => {
    if (!window.isDestroyed()) {
      window.webContents.send(VIDEO_DOWNLOAD_CHANGED, update);
    }
  });
};

const rememberCompletedVideoDownload = (filePath: string) => {
  completedVideoDownloads.add(path.resolve(filePath));
  if (completedVideoDownloads.size > 100) {
    const oldest = completedVideoDownloads.values().next().value;
    if (typeof oldest === 'string') {
      completedVideoDownloads.delete(oldest);
    }
  }
};

const revealVideoDownload = (candidate: unknown) => {
  if (typeof candidate !== 'string') {
    return false;
  }
  const resolved = path.resolve(candidate);
  if (!completedVideoDownloads.has(resolved) || !fs.existsSync(resolved)) {
    return false;
  }
  shell.showItemInFolder(resolved);
  return true;
};

const broadcastAdBlockSetting = () => {
  attachedPlayers.forEach((contents) => {
    if (!contents.isDestroyed()) {
      contents.send(VIDEO_AD_BLOCK_CHANGED, isAdBlockEnabled());
    }
  });
};

/**
 * Lock down the player's session.
 *
 * Separate from the app's own session, so a site's cookies never sit in the
 * same jar as anything FluidEQ stores, and so none of this leaks onto the
 * window's own web contents.
 */
const lockDownSession = () => {
  const videoSession = session.fromPartition(VIDEO_BROWSER_PARTITION);

  // No `setUserAgent` here on purpose. See the note above it in this file.

  videoSession.setPermissionRequestHandler(
    (_contents, permission, callback, details) => {
      // `requestingUrl` is the frame's own address, which is what has to be
      // judged — not the top document's, since the whole point is that a frame
      // deep inside a page is doing the asking.
      const asker = (details as { requestingUrl?: string } | undefined)
        ?.requestingUrl;
      callback(isPermissionGranted(permission, asker));
    },
  );

  videoSession.setPermissionCheckHandler((_contents, permission, origin) =>
    isPermissionGranted(permission, origin),
  );

  // Nothing here may enumerate a HID, serial or USB device.
  videoSession.setDevicePermissionHandler(() => false);

  // The app's own window is allowed to capture system audio — that is the
  // spectrum analyser, and the handler for it is in main.ts. A web page inside
  // the player must never get near that API: it would hand a site a recording
  // of whatever the machine is playing.
  videoSession.setDisplayMediaRequestHandler((_request, callback) => {
    callback({});
  });

  // Every download needs an explicit destination chosen in the OS dialog.
  // FluidEQ never opens the downloaded file; it only reports progress and can
  // reveal the completed file in Explorer after the user asks.
  videoSession.on('will-download', (_event, item, source) => {
    nextVideoDownloadId += 1;
    const id = `video-download-${Date.now()}-${nextVideoDownloadId}`;
    const fileName = path.basename(item.getFilename() || 'download');
    const update = (phase: TVideoDownloadPhase) => {
      const receivedBytes = Math.max(0, item.getReceivedBytes());
      const rawTotalBytes = item.getTotalBytes();
      const totalBytes = rawTotalBytes > 0 ? rawTotalBytes : undefined;
      const savePath = item.getSavePath();
      sendVideoDownloadUpdate(source, {
        id,
        phase,
        fileName,
        filePath: savePath || undefined,
        receivedBytes,
        totalBytes,
        percent:
          totalBytes !== undefined
            ? Math.max(0, Math.min(100, (receivedBytes / totalBytes) * 100))
            : undefined,
      });
    };

    item.setSaveDialogOptions({
      title: 'Save download to your computer',
      defaultPath: path.join(app.getPath('downloads'), fileName),
      buttonLabel: 'Save',
    });
    update('choosing');

    item.on('updated', (_downloadEvent, state) => {
      update(state === 'interrupted' ? 'failed' : 'downloading');
    });
    item.once('done', (_downloadEvent, state) => {
      if (state === 'completed') {
        const savePath = item.getSavePath();
        if (savePath) {
          rememberCompletedVideoDownload(savePath);
          log.info(`Video download saved to ${savePath}`);
        }
        update('completed');
      } else if (state === 'cancelled') {
        update('cancelled');
      } else {
        log.warn(`Video download failed: ${fileName} (${state})`);
        update('failed');
      }
    });
  });
};

/**
 * Wire the player up. Call once, after the app is ready.
 *
 * `session.fromPartition` creates the session on first use, so calling this
 * before `whenReady` would build it too early.
 */
export const setUpVideoBrowser = () => {
  lockDownSession();

  app.on('web-contents-created', (_event, contents) => {
    if (contents.getType() === 'webview') {
      hardenPlayer(contents);
      return;
    }

    // A sign-in popup a player opened. Recognised by its session rather than by
    // its type — it is a `window`, exactly like FluidEQ's own, and the thing
    // that tells the two apart is that a popup inherits the player's partition
    // and nothing else in the application uses that partition.
    if (contents.session === session.fromPartition(VIDEO_BROWSER_PARTITION)) {
      hardenPopup(contents);
      return;
    }

    contents.on('will-attach-webview', hardenAttachment);
  });

  // Asked by each player as it loads, so a reload or a new page starts in
  // whatever state the switch is actually in.
  ipcMain.handle(VIDEO_AD_BLOCK_REQUEST, () => isAdBlockEnabled());
  ipcMain.handle(VIDEO_DOWNLOAD_REVEAL, (_event, filePath: unknown) =>
    revealVideoDownload(filePath),
  );
};

/** Called from the window's IPC handler when the switch moves. */
export const setVideoAdBlockEnabled = (enabled: boolean) => {
  setAdBlockEnabled(enabled);
  broadcastAdBlockSetting();
};

/**
 * Throw away everything the player has accumulated. Every account, at once.
 *
 * THIS IS WHAT MAKES A PERSISTENT SESSION DEFENSIBLE. Before it, the promise was
 * that nothing was kept; now the promise is that nothing is kept that was not
 * asked for and that all of it can be dropped in one press. A store somebody can
 * fill and cannot empty is the version of this feature that should not ship.
 *
 * `clearStorageData()` with no arguments rather than a list of quotas: the
 * default is every type it knows, which is the point. Naming types here would
 * mean this function silently stopped covering whatever Chromium adds next, and
 * the failure would be a login surviving a sign-out — the exact thing it exists
 * to prevent. Cache goes with it, since a cached authenticated page can still
 * show somebody's name and library after their cookies are gone.
 *
 * Every attached player is sent home afterwards. A tab left sitting on a
 * logged-in page would keep rendering it from memory, which looks precisely like
 * the sign-out having failed.
 */
export const clearVideoSession = async () => {
  const videoSession = session.fromPartition(VIDEO_BROWSER_PARTITION);

  await videoSession.clearStorageData();
  await videoSession.clearCache();
  await videoSession.clearAuthCache();

  attachedPlayers.forEach((contents) => {
    if (!contents.isDestroyed()) {
      contents.loadURL(HOME_SITE.home).catch(() => {
        // The player is going away, or already has. Nothing to say about it.
      });
    }
  });
};

/**
 * Open a blocked address in the user's real browser.
 *
 * Reached only from the notice the player shows after refusing to navigate,
 * which prints the address first and needs a press to go anywhere. The scheme
 * is checked rather than trusted: this is an IPC endpoint, so what arrives is
 * whatever the renderer sent. That check now lives in `safeExternal.ts`, which
 * is where the main window's window-open handler reads it from too — it was
 * passing its URL through unchecked while this half was careful.
 */
export const openVideoLinkExternally = (url: string) => {
  openExternalIfSafe(url);
};
