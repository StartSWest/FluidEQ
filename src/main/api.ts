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
import type { ISystemMediaSnapshot } from './systemMedia';
import type {
  IKaraokeRestoredFileBytes,
  IKaraokeRestoredSession,
  IKaraokeSessionSnapshot,
} from '../common/karaoke/sessionPersistence';
import type {
  IKaraokeMakerExportRequest,
  IKaraokeMakerExportResult,
} from '../common/karaoke/makerPersistence';
import type { IKaraokeMakerProject } from '../common/karaoke/makerProject';
import { VIDEO_DOWNLOAD_REVEAL } from '../common/videoDownloads';
import type {
  ILibraryIndex,
  ILibraryNormalizationAnalysis,
  ILibraryScanProgress,
  ILibraryTrack,
} from '../common/library/types';
import type { ILibraryPlaylists } from '../common/library/playlists';
import type {
  ILanHostDetails,
  ILanRemoteComputer,
  ILanRemoteAudioChunk,
  ILanRemoteAudioSignal,
  TLanRestoreResult,
  TLanSavedRole,
} from '../common/remoteAudio';
import { dspHostBridge } from './dspHost/bridge';

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
 * Tell the main process which language the window is in.
 *
 * Only the tray menu needs it — everything else the main process says reaches
 * the user through the renderer, which already knows. The preference lives in
 * the renderer's local storage, so this is the only way it gets across.
 */
const setAppLocale = (locale: string) =>
  ipcRenderer.invoke('window-set-locale', locale) as Promise<void>;

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

const saveKaraokeMakerDraft = (project: IKaraokeMakerProject) =>
  ipcRenderer.invoke('karaoke-maker-draft-save', project) as Promise<void>;

const loadKaraokeMakerDraft = (projectId: string) =>
  ipcRenderer.invoke('karaoke-maker-draft-load', projectId) as Promise<
    IKaraokeMakerProject | undefined
  >;

const deleteKaraokeMakerDraft = (projectId: string) =>
  ipcRenderer.invoke('karaoke-maker-draft-delete', projectId) as Promise<void>;

const exportKaraokeMakerFile = (request: IKaraokeMakerExportRequest) =>
  ipcRenderer.invoke(
    'karaoke-maker-export',
    request,
  ) as Promise<IKaraokeMakerExportResult>;

const revealVideoDownload = (filePath: string) =>
  ipcRenderer.invoke(VIDEO_DOWNLOAD_REVEAL, filePath) as Promise<boolean>;

/**
 * Split a decoded song into a vocal and an instrumental stem.
 *
 * Inference runs in the main process on the native ONNX runtime — the
 * renderer decodes and draws, main computes. Four channels of Float32 samples
 * cross this boundary each way; progress arrives separately through
 * {@link onKaraokeSeparationProgress} because `invoke` has exactly one reply.
 */
const separateKaraokeVocals = (left: Float32Array, right: Float32Array) =>
  ipcRenderer.invoke('karaoke-separate', { left, right }) as Promise<{
    vocalsLeft: Float32Array;
    vocalsRight: Float32Array;
    musicLeft: Float32Array;
    musicRight: Float32Array;
    backend: string;
  }>;

const getKaraokeModelStatus = () =>
  ipcRenderer.invoke('karaoke-models-status') as Promise<{
    separation: { loaded: boolean; bytes: number };
    pitch: { loaded: boolean; bytes: number; downloadedBytes: number };
  }>;

const releaseKaraokePitchModel = () =>
  ipcRenderer.send('karaoke-pitch-release', []);

const detectKaraokePitch = (samples: Float32Array) =>
  ipcRenderer.invoke('karaoke-pitch-f0', samples) as Promise<{
    pitchHz: Float32Array;
    confidence: Float32Array;
    hopSeconds: number;
    /** What counts as a voiced frame differs per model; main says which. */
    voicedThreshold: number;
    model: 'rmvpe' | 'swift-f0';
    /** The bundled model completed the run after the optional fetch failed. */
    rmvpeDownloadFailed?: boolean;
  }>;

const onKaraokePitchProgress = (
  listener: (progress: {
    stage: string;
    fraction: number;
    /** Present only while downloading; see karaokePitch.ts. */
    loadedBytes?: number;
    totalBytes?: number;
    file?: string;
  }) => void,
) => {
  const wrapped = (
    _event: IpcRendererEvent,
    progress: { stage: string; fraction: number },
  ) => listener(progress);
  ipcRenderer.on('karaoke-pitch-progress', wrapped);
  return () => {
    ipcRenderer.removeListener('karaoke-pitch-progress', wrapped);
  };
};

const saveKaraokeStems = (
  key: string,
  vocals: ArrayBuffer,
  instrumental: ArrayBuffer,
) =>
  ipcRenderer.invoke('karaoke-stems-save', {
    key,
    vocals,
    instrumental,
  }) as Promise<void>;

const loadKaraokeStems = (key: string) =>
  ipcRenderer.invoke('karaoke-stems-load', key) as Promise<{
    vocals: Uint8Array;
    instrumental: Uint8Array;
  } | null>;

const releaseKaraokeSeparationModel = () =>
  ipcRenderer.send('karaoke-separate-release', []);

const cancelKaraokeSeparation = () =>
  ipcRenderer.send('karaoke-separate-cancel', []);

const onKaraokeSeparationProgress = (
  listener: (progress: { stage: string; fraction: number }) => void,
) => {
  const wrapped = (
    _event: IpcRendererEvent,
    progress: { stage: string; fraction: number },
  ) => listener(progress);
  ipcRenderer.on('karaoke-separate-progress', wrapped);
  return () => {
    ipcRenderer.removeListener('karaoke-separate-progress', wrapped);
  };
};

/** `wasReset` is `loadLibraryIndex`'s own answer, carried through unchanged. */
const getLibraryIndex = () =>
  ipcRenderer.invoke('library-index-get') as Promise<{
    index: ILibraryIndex;
    wasReset: boolean;
  }>;

/** Opens the OS folder picker and scans whatever the user chose. */
const addLibraryRoot = () =>
  ipcRenderer.invoke('library-root-add') as Promise<ILibraryIndex>;

/** For a dropped folder: main decides what is really a directory. */
const addLibraryRootPaths = (paths: string[]) =>
  ipcRenderer.invoke('library-root-add-paths', paths) as Promise<ILibraryIndex>;

const removeLibraryRoot = (rootId: string) =>
  ipcRenderer.invoke('library-root-remove', rootId) as Promise<ILibraryIndex>;

/** Kicks off a rescan of every root; progress arrives through the two listeners below. */
const rescanLibrary = () =>
  ipcRenderer.invoke('library-scan-start') as Promise<void>;

/**
 * A rescan that hands the scanner no known tracks at all, so every candidate
 * is re-read regardless of whether its size and modified time still match --
 * the escape hatch for a tagger's preserve-mtime option, and for a track
 * whose cached `artId` points at a `userData/library-art` file something
 * outside the app deleted.
 */
const forceRescanLibrary = () =>
  ipcRenderer.invoke('library-scan-force') as Promise<void>;

const cancelLibraryScan = () => ipcRenderer.send('library-scan-cancel', []);

const onLibraryScanProgress = (
  listener: (progress: ILibraryScanProgress) => void,
) => {
  const wrapped = (_event: IpcRendererEvent, progress: ILibraryScanProgress) =>
    listener(progress);
  ipcRenderer.on('library-scan-progress', wrapped);
  return () => {
    ipcRenderer.removeListener('library-scan-progress', wrapped);
  };
};

const onLibraryIndexChanged = (listener: (index: ILibraryIndex) => void) => {
  const wrapped = (_event: IpcRendererEvent, index: ILibraryIndex) =>
    listener(index);
  ipcRenderer.on('library-index-changed', wrapped);
  return () => {
    ipcRenderer.removeListener('library-index-changed', wrapped);
  };
};

/**
 * The tracks one batch of a scan just read, and only those.
 *
 * The whole index used to come down `library-index-changed` for this — every
 * twenty-five files, the entire library re-sent. On fourteen thousand tracks
 * that is five hundred and sixty messages carrying fourteen thousand objects
 * each, which main has to serialise and the renderer has to deserialise before
 * either can do anything else. That is why the window stopped answering for
 * the length of a scan, and it was never about which process did the reading.
 *
 * A batch is twenty-five. The renderer merges them — see `LibraryContext`.
 */
const onLibraryTracksAdded = (
  listener: (tracks: readonly ILibraryTrack[]) => void,
) => {
  const wrapped = (_event: IpcRendererEvent, tracks: ILibraryTrack[]) =>
    listener(tracks);
  ipcRenderer.on('library-tracks-added', wrapped);
  return () => {
    ipcRenderer.removeListener('library-tracks-added', wrapped);
  };
};

/** Shows the file in Explorer/Finder; an id the index no longer knows does nothing. */
const revealLibraryTrack = (trackId: string) =>
  ipcRenderer.invoke('library-reveal', trackId) as Promise<void>;

/**
 * The whole audio file, so the player can hold it as a blob and seek inside
 * it without a round trip — see the handler's own comment for why that is the
 * difference between a clean jump and a stutter.
 *
 * `undefined` for anything main declines to hand over: an unknown id, a file
 * it could not read, or one past the size cap. Every caller falls back to the
 * streaming `fluideq-media://` URL, which plays perfectly well and only seeks
 * less smoothly.
 */
const libraryTrackBytes = (trackId: string) =>
  ipcRenderer.invoke('library-track-bytes', trackId) as Promise<
    ArrayBuffer | undefined
  >;

/** One cheap stat; unlike normalization this never decodes the audio. */
const libraryTrackSignature = (trackId: string) =>
  ipcRenderer.invoke('library-track-signature', trackId) as Promise<
    { sizeBytes: number; mtimeMs: number } | undefined
  >;

/** Persists a renderer measurement against the exact indexed file identity. */
const setLibraryTrackNormalization = (
  trackId: string,
  analysis: ILibraryNormalizationAnalysis,
  signature: { sizeBytes: number; mtimeMs: number },
) =>
  ipcRenderer.invoke(
    'library-track-normalization-set',
    trackId,
    analysis,
    signature,
  ) as Promise<boolean>;

/**
 * The playlists, and whether the file holding them had to be thrown away.
 *
 * `wasReset` answers the same question `getLibraryIndex`'s does and is worth
 * as much: a scan puts the songs back, but nothing puts back a playlist, so
 * the one moment it can be said is the moment it is noticed.
 */
const getLibraryPlaylists = () =>
  ipcRenderer.invoke('library-playlists-get') as Promise<{
    playlists: ILibraryPlaylists;
    wasReset: boolean;
  }>;

/** Every mutator answers with the whole set — see `ipc/libraryPlaylists.ts`. */
const createLibraryPlaylist = (name: string, trackIds: readonly string[]) =>
  ipcRenderer.invoke(
    'library-playlist-create',
    name,
    trackIds,
  ) as Promise<ILibraryPlaylists>;

const renameLibraryPlaylist = (playlistId: string, name: string) =>
  ipcRenderer.invoke(
    'library-playlist-rename',
    playlistId,
    name,
  ) as Promise<ILibraryPlaylists>;

const deleteLibraryPlaylist = (playlistId: string) =>
  ipcRenderer.invoke(
    'library-playlist-delete',
    playlistId,
  ) as Promise<ILibraryPlaylists>;

const addTracksToLibraryPlaylist = (
  playlistId: string,
  trackIds: readonly string[],
) =>
  ipcRenderer.invoke(
    'library-playlist-tracks-add',
    playlistId,
    trackIds,
  ) as Promise<ILibraryPlaylists>;

const removeTracksFromLibraryPlaylist = (
  playlistId: string,
  trackIds: readonly string[],
) =>
  ipcRenderer.invoke(
    'library-playlist-tracks-remove',
    playlistId,
    trackIds,
  ) as Promise<ILibraryPlaylists>;

const onLibraryPlaylistsChanged = (
  listener: (playlists: ILibraryPlaylists) => void,
) => {
  const wrapped = (_event: IpcRendererEvent, playlists: ILibraryPlaylists) =>
    listener(playlists);
  ipcRenderer.on('library-playlists-changed', wrapped);
  return () => {
    ipcRenderer.removeListener('library-playlists-changed', wrapped);
  };
};

const startRemoteAudioLanHost = () =>
  ipcRenderer.invoke('remote-audio-lan-host') as Promise<ILanHostDetails>;

const getSavedRemoteAudioLanRole = () =>
  ipcRenderer.invoke('remote-audio-lan-saved-role') as Promise<
    TLanSavedRole | undefined
  >;

const restoreRemoteAudioLan = () =>
  ipcRenderer.invoke('remote-audio-lan-restore') as Promise<
    TLanRestoreResult | undefined
  >;

const joinRemoteAudioLan = (code: string) =>
  ipcRenderer.invoke(
    'remote-audio-lan-join',
    code,
  ) as Promise<ILanRemoteComputer>;

const sendRemoteAudioLanSignal = (message: ILanRemoteAudioSignal) =>
  ipcRenderer.invoke('remote-audio-lan-send', message) as Promise<void>;

const sendRemoteAudioLanAudio = (chunk: ILanRemoteAudioChunk) =>
  ipcRenderer.send('remote-audio-lan-audio-send', chunk);

const stopRemoteAudioLan = (forget = false) =>
  ipcRenderer.invoke('remote-audio-lan-stop', forget) as Promise<void>;

const onRemoteAudioLanSignal = (
  listener: (message: ILanRemoteAudioSignal) => void,
) => {
  const wrapped = (_event: IpcRendererEvent, message: ILanRemoteAudioSignal) =>
    listener(message);
  ipcRenderer.on('remote-audio-lan-signal', wrapped);
  return () => {
    ipcRenderer.removeListener('remote-audio-lan-signal', wrapped);
  };
};

const onRemoteAudioLanAudio = (
  listener: (chunk: ILanRemoteAudioChunk) => void,
) => {
  const wrapped = (_event: IpcRendererEvent, chunk: ILanRemoteAudioChunk) =>
    listener(chunk);
  ipcRenderer.on('remote-audio-lan-audio', wrapped);
  return () => {
    ipcRenderer.removeListener('remote-audio-lan-audio', wrapped);
  };
};

const onRemoteAudioLanError = (listener: () => void) => {
  const wrapped = () => listener();
  ipcRenderer.on('remote-audio-lan-error', wrapped);
  return () => {
    ipcRenderer.removeListener('remote-audio-lan-error', wrapped);
  };
};

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
    setAppLocale,
    getChangelog,
    installUpdate,
    isWindowMaximized,
    setWindowFullScreen,
    sendMediaTransport,
    watchSystemMedia,
    sendSystemMediaCommand,
    onSystemMedia,
    getPathForFile,
    saveKaraokeSession,
    restoreKaraokeSession,
    readKaraokeSessionFile,
    clearKaraokeSession,
    saveKaraokeMakerDraft,
    loadKaraokeMakerDraft,
    deleteKaraokeMakerDraft,
    separateKaraokeVocals,
    cancelKaraokeSeparation,
    releaseKaraokeSeparationModel,
    saveKaraokeStems,
    detectKaraokePitch,
    onKaraokePitchProgress,
    releaseKaraokePitchModel,
    getKaraokeModelStatus,
    loadKaraokeStems,
    onKaraokeSeparationProgress,
    exportKaraokeMakerFile,
    revealVideoDownload,
    getLibraryIndex,
    addLibraryRoot,
    addLibraryRootPaths,
    removeLibraryRoot,
    rescanLibrary,
    forceRescanLibrary,
    cancelLibraryScan,
    onLibraryScanProgress,
    onLibraryIndexChanged,
    onLibraryTracksAdded,
    revealLibraryTrack,
    libraryTrackBytes,
    libraryTrackSignature,
    setLibraryTrackNormalization,
    getLibraryPlaylists,
    createLibraryPlaylist,
    renameLibraryPlaylist,
    deleteLibraryPlaylist,
    addTracksToLibraryPlaylist,
    removeTracksFromLibraryPlaylist,
    onLibraryPlaylistsChanged,
    startRemoteAudioLanHost,
    getSavedRemoteAudioLanRole,
    restoreRemoteAudioLan,
    joinRemoteAudioLan,
    sendRemoteAudioLanSignal,
    sendRemoteAudioLanAudio,
    stopRemoteAudioLan,
    onRemoteAudioLanSignal,
    onRemoteAudioLanAudio,
    onRemoteAudioLanError,
    // Spread rather than nested, so the native engine's calls sit beside every
    // other one here. Its own module because this file is already long enough
    // that a reader has to search it — see the head of `dspHost/bridge.ts`.
    ...dspHostBridge,
  },
};
