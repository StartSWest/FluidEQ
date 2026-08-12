/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
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

import { ipcRenderer, IpcRendererEvent, webUtils } from 'electron';
// Type only, so the preload bundle does not pull `child_process` in behind it.
import type { TMediaTransportAction } from './mediaKeys';
import type {
  IKaraokeRestoredFileBytes,
  IKaraokeRestoredSession,
  IKaraokeSessionSnapshot,
} from '../common/karaoke/sessionPersistence';

export type Channels = string;

const sendMessage = (channel: Channels, args: unknown[]) => {
  ipcRenderer.send(channel, args);
};

const on = (channel: Channels, func: (...args: unknown[]) => void) => {
  const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
    func(...args);
  ipcRenderer.on(channel, subscription);

  return () => ipcRenderer.removeListener(channel, subscription);
};

/**
 * Listen for one message, and hand back the way to stop listening.
 *
 * The unsubscribe matters even though the listener removes itself on delivery,
 * because the message might never come. A request that times out has to take
 * its listener with it or the listener stays registered forever — and worse,
 * it is still first in line, so it will swallow the response to somebody
 * else's request later and every reply after that answers the wrong question.
 *
 * It closes over `subscription` for the same reason `on` does: only the exact
 * function that was registered can be removed, and the wrapper is not the
 * function the caller passed in.
 */
const once = (channel: Channels, func: (...args: unknown[]) => void) => {
  const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
    func(...args);
  ipcRenderer.once(channel, subscription);

  return () => ipcRenderer.removeListener(channel, subscription);
};

// There is no `removeListener` here on purpose.
//
// There was, and it could not work: it built a brand new arrow function and
// asked Electron to remove that, which never matches anything registered, so
// it silently removed nothing at all. Every caller that believed it had
// cleaned up had not. Removal belongs to whoever subscribed, through the
// function `on` and `once` return, because that is the only place the real
// subscription reference exists.

const closeApp = () => {
  ipcRenderer.send('quit-app', []);
};

const openEqualizerApoConfigurator = () =>
  ipcRenderer.invoke('open-equalizer-apo-configurator') as Promise<string>;

const openEqualizerApoSettings = () =>
  ipcRenderer.invoke('open-equalizer-apo-settings') as Promise<string>;

const restartWindowsAudio = () =>
  ipcRenderer.invoke('restart-windows-audio') as Promise<string>;

const minimizeWindow = () =>
  ipcRenderer.invoke('window-minimize') as Promise<void>;

const toggleMaximizeWindow = () =>
  ipcRenderer.invoke('window-toggle-maximize') as Promise<boolean>;

const closeWindow = () => ipcRenderer.invoke('window-close') as Promise<void>;

/**
 * The release notes that shipped with this build.
 *
 * `latest` is the version just installed and nothing else; `all` is the whole
 * file. Which one is right depends on whether the reader asked to see this.
 */
const getChangelog = (scope: 'latest' | 'all') =>
  ipcRenderer.invoke('get-changelog', scope) as Promise<string>;

/** Quit and run the update that has already been downloaded. */
const installUpdate = () =>
  ipcRenderer.invoke('install-update') as Promise<void>;

const isWindowMaximized = () =>
  ipcRenderer.invoke('window-is-maximized') as Promise<boolean>;

/** Real fullscreen. The renderer's own Fullscreen API cannot do this. */
const setWindowFullScreen = (next: boolean) =>
  ipcRenderer.invoke('window-set-full-screen', next) as Promise<boolean>;

/**
 * Press a media key for the whole machine, not for this app's player.
 *
 * A name and never a key code: main keeps the only table that turns one into
 * the other. Nothing comes back — Windows does not say who answered.
 */
const sendMediaTransport = (action: TMediaTransportAction) =>
  ipcRenderer.invoke('media-transport', action) as Promise<void>;

/** Electron removed File.path; this is the supported replacement. */
const getPathForFile = (file: File): string => webUtils.getPathForFile(file);

const saveKaraokeSession = (snapshot: IKaraokeSessionSnapshot) =>
  ipcRenderer.invoke('karaoke-session-save', snapshot) as Promise<void>;

const restoreKaraokeSession = () =>
  ipcRenderer.invoke('karaoke-session-restore') as Promise<
    IKaraokeRestoredSession | undefined
  >;

const readKaraokeSessionFile = (token: string) =>
  ipcRenderer.invoke('karaoke-session-read-file', token) as Promise<
    IKaraokeRestoredFileBytes | undefined
  >;

const clearKaraokeSession = () =>
  ipcRenderer.invoke('karaoke-session-clear') as Promise<void>;

export default {
  /**
   * What this build is running on, read once while the preload has a `process`.
   *
   * The window needs this to decide what to draw, and the transport buttons are
   * the case: they press Windows virtual keys, so on any other platform they
   * would be three controls that do nothing at all. Better not drawn.
   */
  platform: process.platform,
  ipcRenderer: {
    sendMessage,
    on,
    once,
    closeApp,
    openEqualizerApoConfigurator,
    openEqualizerApoSettings,
    restartWindowsAudio,
    minimizeWindow,
    toggleMaximizeWindow,
    closeWindow,
    getChangelog,
    installUpdate,
    isWindowMaximized,
    setWindowFullScreen,
    sendMediaTransport,
    getPathForFile,
    saveKaraokeSession,
    restoreKaraokeSession,
    readKaraokeSessionFile,
    clearKaraokeSession,
  },
};
