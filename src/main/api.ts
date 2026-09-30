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
import type {
  IGraphicsPreferenceState,
  TGpuPreference,
} from '../common/graphicsPreference';
import type { IMotionPreferenceState } from './ipc/motionPreference';
import type { TMotionPreference } from './motionPreference';
import type { IStartWithWindows } from './startWithWindows';
import type { IWindowState, TWindowMode } from '../common/windowMode';
// Type only, so the preload bundle does not pull `child_process` in behind it.
import type { TMediaTransportAction } from './mediaKeys';
import type { ISystemMediaSnapshot } from './systemMedia';
import {
  ITaskbarTransportState,
  TASKBAR_TRANSPORT_ACTION,
  TASKBAR_TRANSPORT_STATE,
  TTaskbarTransportAction,
} from '../common/taskbarTransport';
import type { IAudioRestartOutcome } from '../common/audioEngine';
import { VIDEO_DOWNLOAD_REVEAL } from '../common/videoDownloads';
import { dspHostBridge } from './dspHost/bridge';
import karaokeBridge from './karaokeBridge';
import libraryBridge from './libraryBridge';
import remoteAudioBridge from './remoteAudioBridge';
import accountBridge from './accountBridge';
import studioBridge from './studioBridge';
import plusBridge from './plusBridge';
import communityBridge from './communityBridge';
import wallpaperBridge from './wallpaperBridge';
import { engineHealthBridge } from './engineHealthBridge';
import { lightingBridge } from './lightingBridge';
import { outputMirrorBridge } from './outputMirrorBridge';
import { plusTermsNoticeBridge } from './plusTermsNoticeBridge';
import { plusWelcomeBridge } from './plusWelcomeBridge';
import { plusTrialBridge } from './plusTrialBridge';
import { plusReviewBridge } from './plusReviewBridge';
import { makerMonthBridge } from './makerMonthBridge';
import { studioAgentBridge } from './studioAgentBridge';

export type Channels = string;

/**
 * `requestId` is sent when the window waits on a reply: main hands it back
 * beside the reply, which is how the reply finds that request among every
 * other one waiting on the same channel. A message nobody answers carries
 * none, and reaches main exactly as it always did.
 */
const sendMessage = (
  channel: Channels,
  args: unknown[],
  requestId?: number,
) => {
  if (requestId === undefined) {
    ipcRenderer.send(channel, args);
    return;
  }
  ipcRenderer.send(channel, args, requestId);
};

const on = (channel: Channels, func: (...args: unknown[]) => void) => {
  const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
    func(...args);
  ipcRenderer.on(channel, subscription);

  return () => ipcRenderer.removeListener(channel, subscription);
};

// There is no `removeListener` here on purpose, and no `once` either.
//
// There was a `removeListener`, and it could not work: it built a brand new
// arrow function and asked Electron to remove that, which never matches
// anything registered, so it silently removed nothing at all. Every caller
// that believed it had cleaned up had not. Removal belongs to whoever
// subscribed, through the function `on` returns, because that is the only
// place the real subscription reference exists.
//
// `once` served requests, one listener each, and a one-shot listener takes
// whichever message reaches its channel first — somebody else's reply
// included. Requests now wait through `sendRequest`, which matches each reply
// to its request by id over a single `on` per channel.

const closeApp = () => {
  ipcRenderer.send('quit-app', []);
};

const openEqualizerApoConfigurator = () =>
  ipcRenderer.invoke('open-equalizer-apo-configurator') as Promise<string>;

const openEqualizerApoSettings = () =>
  ipcRenderer.invoke('open-equalizer-apo-settings') as Promise<string>;

const restartWindowsAudio = () =>
  ipcRenderer.invoke('restart-windows-audio') as Promise<IAudioRestartOutcome>;

/** A native message box owned by the window; resolves when it is dismissed. */
const showNativeMessage = (message: string) =>
  ipcRenderer.invoke('native-message', message) as Promise<void>;

/** A native OK/Cancel box; true when OK was pressed. */
const confirmNative = (message: string, ok: string, cancel: string) =>
  ipcRenderer.invoke('native-confirm', message, ok, cancel) as Promise<boolean>;

const minimizeWindow = () =>
  ipcRenderer.invoke('window-minimize') as Promise<void>;

const toggleMaximizeWindow = () =>
  ipcRenderer.invoke('window-toggle-maximize') as Promise<boolean>;

const closeWindow = () => ipcRenderer.invoke('window-close') as Promise<void>;

/**
 * Tell the main process which language the window is in.
 *
 * Only the tray menu needs it — everything else the main process says reaches
 * the user through the renderer, which already knows. The preference lives in
 * the renderer's local storage, so this is the only way it gets across.
 */
const setAppLocale = (locale: string) =>
  ipcRenderer.invoke('window-set-locale', locale) as Promise<void>;

/**
 * The colour the shell's floor is painted in, as `#rrggbb`. The theme decides
 * it and only the document knows it; what the window shows before the page's
 * first frame, and inside the strip a resize opens, is the native window's own
 * background, so it has to cross to main.
 */
const setWindowFloor = (colour: string) =>
  ipcRenderer.invoke('window-set-floor', colour) as Promise<void>;

/** Animated or reduced, as chosen in the tools menu; applies from the next start. */
const motionPreference = () =>
  ipcRenderer.invoke(
    'motion-preference-get',
  ) as Promise<IMotionPreferenceState>;

const setMotionPreference = (motion: TMotionPreference) =>
  ipcRenderer.invoke(
    'motion-preference-set',
    motion,
  ) as Promise<IMotionPreferenceState>;

/** Whether Windows starts FluidEQ when this person signs in. */
const startWithWindows = () =>
  ipcRenderer.invoke('start-with-windows-get') as Promise<IStartWithWindows>;

const setStartWithWindows = (wanted: boolean) =>
  ipcRenderer.invoke(
    'start-with-windows-set',
    wanted,
  ) as Promise<IStartWithWindows>;

/**
 * "Reset all settings": main's half of them (`ipc/settingsReset.ts`). The
 * window forgets its own half after this answers, and reloads.
 */
const resetSettings = () =>
  ipcRenderer.invoke('settings-reset') as Promise<void>;

/** Which graphics card the whole app runs on; applies from the next start. */
const graphicsPreference = () =>
  ipcRenderer.invoke(
    'graphics-preference-get',
  ) as Promise<IGraphicsPreferenceState>;

const setGraphicsPreference = (gpu: TGpuPreference) =>
  ipcRenderer.invoke(
    'graphics-preference-set',
    gpu,
  ) as Promise<IGraphicsPreferenceState>;

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

/**
 * Both window flags at once, for the renderer's first look.
 *
 * The window outlives the page: a renderer reload keeps it exactly as it was
 * while every flag in the page starts again at nothing, and main's own
 * announcement of the state fires on `did-finish-load` — before React has
 * mounted anything that could hear it. Asked for on mount instead, the page
 * meets the window it actually has rather than the one it assumes.
 */
const getWindowState = () =>
  ipcRenderer.invoke('window-get-state') as Promise<IWindowState>;

/**
 * The full app or the player. Answers the mode the window is in afterwards —
 * the one asked for, except in full screen, where there is no size to change.
 */
const setWindowMode = (mode: TWindowMode) =>
  ipcRenderer.invoke('window-set-mode', mode) as Promise<TWindowMode>;

/** The player's Always on top. */
const setWindowPinned = (isPinned: boolean) =>
  ipcRenderer.invoke('window-set-pinned', isPinned) as Promise<void>;

/**
 * The player's height, in the page's CSS pixels: a deck opening or closing,
 * or the player folding to one line and back.
 */
const resizePlayerWindow = (height: number) =>
  ipcRenderer.invoke('window-resize-player', height) as Promise<void>;

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

const setTaskbarTransport = (state: ITaskbarTransportState) =>
  ipcRenderer.invoke(TASKBAR_TRANSPORT_STATE, state) as Promise<void>;

const onTaskbarTransport = (
  listener: (action: TTaskbarTransportAction) => void,
) => {
  const wrapped = (_event: IpcRendererEvent, action: unknown) => {
    if (action === 'previous' || action === 'toggle' || action === 'next') {
      listener(action);
    }
  };
  ipcRenderer.on(TASKBAR_TRANSPORT_ACTION, wrapped);
  return () => {
    ipcRenderer.removeListener(TASKBAR_TRANSPORT_ACTION, wrapped);
  };
};

/**
 * Ask main to report what the rest of the machine is playing, or to stop.
 *
 * On only while the bar has none of this app's own players to show: the
 * watcher is a child process, and one nobody is reading is one that should
 * not be running.
 */
const watchSystemMedia = (enabled: boolean) =>
  ipcRenderer.invoke('system-media-watch', enabled) as Promise<void>;

/**
 * Skip, seek, stop, or quieten whatever the machine is playing.
 *
 * Skip and seek are buttons, drawn only where the session said it takes them
 * — the flags travel with each snapshot. `pause` is not a button: it is sent
 * when a player of this app's starts, so the machine's sound gets out of the
 * way exactly as one of our own players would. Play still goes out as a media
 * key, which reaches players that never registered a session at all.
 */
const sendSystemMediaCommand = (
  command: 'next' | 'previous' | 'seek' | 'stop' | 'pause',
  positionMs?: number,
) =>
  ipcRenderer.invoke(
    'system-media-command',
    command,
    positionMs,
  ) as Promise<void>;

/**
 * Quieten every program playing on this machine, sparing the one named.
 *
 * One player at a time, whoever the players are. With a name it is two
 * programs that are both somebody else's — a Netflix tab started over a
 * Spotify album — and the one that just started is spared. With no name it is
 * this app taking the sound: a song started here, or a computer sending over
 * the LAN link, and everything on this machine gets out of the way.
 *
 * This app's own players are never among them: they are stopped through the
 * register, which knows how, and Windows would only be asked about a session
 * they might not even have.
 *
 * Sent only while the "one player at a time" switch is on, and for another
 * program only when it has just gone from silent to playing — one that was
 * already playing is not somebody pressing play.
 */
const pauseOtherSystemPlayers = (exceptApp?: string) =>
  ipcRenderer.invoke('system-media-pause-others', exceptApp) as Promise<void>;

/**
 * The picture for the cover id a reading of the machine's player carried, or
 * nothing when that song has already moved on. Asked once per cover; the
 * readings themselves carry only the id.
 */
const getSystemMediaCover = (id: string) =>
  ipcRenderer.invoke('system-media-cover', id) as Promise<string | undefined>;

/** Whatever the machine is playing now, or nothing. */
const onSystemMedia = (
  listener: (snapshot: ISystemMediaSnapshot | undefined) => void,
) => {
  const wrapped = (
    _event: IpcRendererEvent,
    snapshot: ISystemMediaSnapshot | undefined,
  ) => listener(snapshot);
  ipcRenderer.on('system-media-changed', wrapped);
  return () => {
    ipcRenderer.removeListener('system-media-changed', wrapped);
  };
};

/** Electron removed File.path; this is the supported replacement. */
const getPathForFile = (file: File): string => webUtils.getPathForFile(file);

const revealVideoDownload = (filePath: string) =>
  ipcRenderer.invoke(VIDEO_DOWNLOAD_REVEAL, filePath) as Promise<boolean>;

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
    closeApp,
    openEqualizerApoConfigurator,
    openEqualizerApoSettings,
    restartWindowsAudio,
    showNativeMessage,
    confirmNative,
    minimizeWindow,
    toggleMaximizeWindow,
    closeWindow,
    setAppLocale,
    setWindowFloor,
    motionPreference,
    setMotionPreference,
    startWithWindows,
    setStartWithWindows,
    graphicsPreference,
    setGraphicsPreference,
    resetSettings,
    getChangelog,
    installUpdate,
    isWindowMaximized,
    getWindowState,
    setWindowMode,
    setWindowPinned,
    resizePlayerWindow,
    setWindowFullScreen,
    sendMediaTransport,
    setTaskbarTransport,
    onTaskbarTransport,
    watchSystemMedia,
    getSystemMediaCover,
    sendSystemMediaCommand,
    pauseOtherSystemPlayers,
    onSystemMedia,
    getPathForFile,
    revealVideoDownload,
    // Every feature's calls in a module of its own, spread rather than nested
    // so each one sits beside the calls above: the window reaches all of them
    // the same way, `window.electron.ipcRenderer.<call>`.
    ...dspHostBridge,
    ...karaokeBridge,
    ...libraryBridge,
    ...remoteAudioBridge,
    ...accountBridge,
    ...studioBridge,
    ...plusBridge,
    ...communityBridge,
    ...outputMirrorBridge,
    ...plusTermsNoticeBridge,
    ...plusWelcomeBridge,
    ...plusTrialBridge,
    ...plusReviewBridge,
    ...makerMonthBridge,
    ...studioAgentBridge,
    ...engineHealthBridge,
    ...lightingBridge,
    ...wallpaperBridge,
  },
};
