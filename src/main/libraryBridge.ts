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

import { ipcRenderer, IpcRendererEvent } from 'electron';
import type {
  ILibraryNormalizationAnalysis,
  ILibraryScanProgress,
} from '../common/library/types';
import type {
  ILibraryAnswers,
  ILibrarySummary,
  TLibraryRequest,
} from '../common/library/query';
import type { ILibraryPlaylists } from '../common/library/playlists';
import type { ILibraryTrackFacts } from '../common/library/trackFacts';
import type { ILibraryLyricsAnswer } from '../common/library/lyrics';
import type {
  ILyricsRemoveTarget,
  TLyricsImportResult,
  TLyricsPickResult,
  TLyricsRemoveResult,
} from '../common/library/lyricsImport';
import type {
  ILibrarySubtitlesAnswer,
  TSubtitleRemoveResult,
} from '../common/library/subtitles';
import type { TSubtitleImportResult } from '../common/library/subtitleImport';

/**
 * The Library's calls: its folders and scans, the page of songs the window
 * draws, a track's bytes and levels, and the playlists.
 */

/**
 * The library's folders, how many songs it has, and the version everything
 * else is read at. The window never holds the songs themselves: it asks for
 * the page it draws (`queryLibrary`).
 */
const getLibrarySummary = () =>
  ipcRenderer.invoke('library-summary-get') as Promise<ILibrarySummary>;

/**
 * One question about the library — a page of a list, where a song sits in
 * it, which letter starts where, some songs by id — answered from the store
 * in main. Typed by the question: the answer is `ILibraryAnswers[type]`.
 */
const queryLibrary = <R extends TLibraryRequest>(request: R) =>
  ipcRenderer.invoke('library-query', request) as Promise<
    ILibraryAnswers[R['type']]
  >;

/** Opens the OS folder picker and scans whatever the user chose. */
const addLibraryRoot = () =>
  ipcRenderer.invoke('library-root-add') as Promise<ILibrarySummary>;

/** For a dropped folder: main decides what is really a directory. */
const addLibraryRootPaths = (paths: string[]) =>
  ipcRenderer.invoke(
    'library-root-add-paths',
    paths,
  ) as Promise<ILibrarySummary>;

/**
 * For music files dropped straight onto the player's queue: their ids in the
 * order they were dropped, so the queue can be added to in the same gesture.
 * A file already known keeps its id.
 */
const queueLibraryFiles = (paths: string[]) =>
  ipcRenderer.invoke('library-queue-files', paths) as Promise<string[]>;

const removeLibraryRoot = (rootId: string) =>
  ipcRenderer.invoke('library-root-remove', rootId) as Promise<ILibrarySummary>;

/** Kicks off a rescan of every root; progress arrives through the listener below. */
const rescanLibrary = () =>
  ipcRenderer.invoke('library-scan-start') as Promise<void>;

/**
 * A rescan that re-reads every file whatever its size and modified time say —
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

/**
 * The library changed — a scan's batch, a folder added or removed, a loudness
 * measured. Carries the new summary, never songs: the window asks again for
 * what it is showing. The whole index used to come down this way, every
 * twenty-five files of a scan, and the window stopped answering for the
 * length of it.
 */
const onLibraryChanged = (listener: (summary: ILibrarySummary) => void) => {
  const wrapped = (_event: IpcRendererEvent, summary: ILibrarySummary) =>
    listener(summary);
  ipcRenderer.on('library-changed', wrapped);
  return () => {
    ipcRenderer.removeListener('library-changed', wrapped);
  };
};

/** Shows the file in Explorer/Finder; an id the library no longer knows does nothing. */
const revealLibraryTrack = (trackId: string) =>
  ipcRenderer.invoke('library-reveal', trackId) as Promise<void>;

/** Opens a Folders-tree folder in Explorer; main opens it only when the
 * song named lies beneath it. */
const revealLibraryFolder = (folderId: string, trackId: string) =>
  ipcRenderer.invoke(
    'library-reveal-folder',
    folderId,
    trackId,
  ) as Promise<void>;

/** The Details pane's facts about a song, read from its file by id. */
const libraryTrackFacts = (trackId: string) =>
  ipcRenderer.invoke('library-track-facts', trackId) as Promise<
    ILibraryTrackFacts | undefined
  >;

/** The Lyrics tab's words for a song, read from its tags or sidecar by id. */
const libraryTrackLyrics = (trackId: string) =>
  ipcRenderer.invoke('library-track-lyrics', trackId) as Promise<
    ILibraryLyricsAnswer | undefined
  >;

/**
 * Opens the system's file dialog for a `.lrc` or `.txt` and hands back its
 * text for the Lyrics tab to import, or why it cannot be imported.
 */
const pickLibraryLyricsFile = () =>
  ipcRenderer.invoke('library-lyrics-pick') as Promise<TLyricsPickResult>;

/**
 * Keeps lyrics with a song for good: beside it as its own `.lrc` or `.txt`,
 * or in FluidEQ's own folder where the song's folder cannot be written. A
 * lyrics file already there is replaced only when `replace` says so.
 */
const importLibraryTrackLyrics = (
  trackId: string,
  text: string,
  replace: boolean,
) =>
  ipcRenderer.invoke(
    'library-lyrics-import',
    trackId,
    text,
    replace,
  ) as Promise<TLyricsImportResult | undefined>;

/**
 * Removes a lyrics file kept with a song: its own beside it, or FluidEQ's
 * copy. Main builds the path from the id; lyrics in the song's tags are
 * never touched.
 */
const removeLibraryTrackLyrics = (
  trackId: string,
  target: ILyricsRemoveTarget,
) =>
  ipcRenderer.invoke('library-lyrics-remove', trackId, target) as Promise<
    TLyricsRemoveResult | undefined
  >;

/**
 * A video's subtitle files and the lines of one: `wanted` by its file name,
 * or the one main puts first for the `preferred` languages.
 */
const libraryTrackSubtitles = (
  trackId: string,
  wanted: string | undefined,
  preferred: readonly string[],
) =>
  ipcRenderer.invoke(
    'library-track-subtitles',
    trackId,
    wanted,
    preferred,
  ) as Promise<ILibrarySubtitlesAnswer | undefined>;

/** Moves one of a video's subtitle files, named as main listed it, to the
 * Recycle Bin. */
const removeLibrarySubtitle = (trackId: string, fileName: string) =>
  ipcRenderer.invoke(
    'library-subtitles-remove',
    trackId,
    fileName,
  ) as Promise<TSubtitleRemoveResult>;

/** Opens the system's file dialog for a `.srt` or `.vtt` and keeps the file
 * picked beside the video. */
const pickLibrarySubtitlesFile = (trackId: string) =>
  ipcRenderer.invoke(
    'library-subtitles-pick',
    trackId,
  ) as Promise<TSubtitleImportResult>;

/** Keeps a dropped subtitle file's text beside the video, under the
 * video's name and the language the file's own name ends on. */
const importLibrarySubtitles = (
  trackId: string,
  sourceName: string,
  text: string,
) =>
  ipcRenderer.invoke(
    'library-subtitles-import',
    trackId,
    sourceName,
    text,
  ) as Promise<TSubtitleImportResult>;

/** One more play of a song the window heard past half its length. */
const noteLibraryTrackPlayed = (trackId: string) =>
  ipcRenderer.invoke('library-track-played', trackId) as Promise<boolean>;

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
 * `wasReset` answers the same question `getLibrarySummary`'s does and is worth
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

const libraryBridge = {
  getLibrarySummary,
  queryLibrary,
  addLibraryRoot,
  addLibraryRootPaths,
  queueLibraryFiles,
  removeLibraryRoot,
  rescanLibrary,
  forceRescanLibrary,
  cancelLibraryScan,
  onLibraryScanProgress,
  onLibraryChanged,
  revealLibraryTrack,
  revealLibraryFolder,
  noteLibraryTrackPlayed,
  libraryTrackFacts,
  libraryTrackLyrics,
  pickLibraryLyricsFile,
  importLibraryTrackLyrics,
  removeLibraryTrackLyrics,
  libraryTrackSubtitles,
  pickLibrarySubtitlesFile,
  importLibrarySubtitles,
  removeLibrarySubtitle,
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
};

export default libraryBridge;
