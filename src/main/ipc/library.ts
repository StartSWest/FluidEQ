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

import {
  BrowserWindow,
  OpenDialogOptions,
  dialog,
  ipcMain,
  shell,
} from 'electron';
import fs from 'fs';
import type { ILibrarySummary } from '../../common/library/query';
import type { ILibraryNormalizationAnalysis } from '../../common/library/types';
import { createLibraryQueries } from '../library/libraryQuery';
import { buildRoot, queueLibraryFiles } from '../library/libraryQueueFiles';
import parseLibraryRequest from '../library/libraryRequestGuard';
import { createLibraryScanRunner } from '../library/libraryScanRunner';
import { openLibraryStore } from '../library/libraryStoreOpen';
import { isLocalRendererPath } from '../rendererPaths';
import onWindowMessage from './windowMessages';

/**
 * The largest file the renderer is handed whole for playback.
 *
 * Generous for music — a CD-length lossless album track lands well under it,
 * and anything above is a recording long enough that holding it in the
 * renderer's heap costs more than the clean seek it buys. Past this, and for
 * video regardless of size, playback falls back to `fluideq-media://` and its
 * byte ranges.
 */
const MAX_PLAYBACK_BLOB_BYTES = 96 * 1024 * 1024;

const isProgrammeEdges = (value: unknown): boolean => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.leadInMs === 'number' &&
    Number.isFinite(candidate.leadInMs) &&
    candidate.leadInMs >= 0 &&
    typeof candidate.endMs === 'number' &&
    Number.isFinite(candidate.endMs) &&
    candidate.endMs >= candidate.leadInMs
  );
};

const isNormalizationAnalysis = (
  value: unknown,
): value is ILibraryNormalizationAnalysis => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    (candidate.edges === undefined || isProgrammeEdges(candidate.edges)) &&
    candidate.version === 2 &&
    typeof candidate.truePeakDbtp === 'number' &&
    Number.isFinite(candidate.truePeakDbtp) &&
    candidate.truePeakDbtp >= -120 &&
    candidate.truePeakDbtp <= 24 &&
    typeof candidate.integratedLufs === 'number' &&
    Number.isFinite(candidate.integratedLufs) &&
    candidate.integratedLufs >= -120 &&
    candidate.integratedLufs <= 24
  );
};

const isFileSignature = (
  value: unknown,
): value is { sizeBytes: number; mtimeMs: number } =>
  typeof value === 'object' &&
  value !== null &&
  'sizeBytes' in value &&
  'mtimeMs' in value &&
  typeof value.sizeBytes === 'number' &&
  typeof value.mtimeMs === 'number';

/**
 * What these handlers need from the process around them.
 *
 * `getMainWindow` is a function because the window is created, destroyed and
 * recreated over the life of the process, and this is registered at module
 * scope in `main.ts`, before any window exists.
 */
export interface ILibraryIpcDeps {
  userDataDir: string;
  getMainWindow: () => BrowserWindow | null;
}

export interface ILibraryIpc {
  /** The file a track id names — the media protocol's one lookup. */
  readonly trackPath: (trackId: string) => string | undefined;
  /**
   * The main window, each time one is made. The first one shown starts the
   * one rescan every launch gets, so a walk of every folder never competes
   * with the first paint.
   */
  readonly watchWindow: (window: BrowserWindow) => void;
}

/**
 * Roots, scanning, the library's questions, and the files behind its songs —
 * everything the Library tab needs from the main process.
 *
 * THE STORE IS NEVER CLOSED. SQLite in WAL mode keeps every committed write
 * through a process exit, and a scan's last batch can still arrive while the
 * app quits: written to a closed handle it would throw in main at the one
 * moment a throw costs most.
 */
export const registerLibraryIpc = (deps: ILibraryIpcDeps): ILibraryIpc => {
  const { userDataDir, getMainWindow } = deps;
  const { store, wasReset } = openLibraryStore(userDataDir);
  const queries = createLibraryQueries(store);

  const summary = (): ILibrarySummary => ({
    version: store.version(),
    roots: store.roots(),
    trackCount: store.trackCount(),
    videoCount: store.videoCount(),
    wasReset,
  });

  /**
   * The library changed: the window is told the new version and summary, and
   * asks again for whatever it is showing. Never the songs themselves — the
   * whole index used to come down this way, every twenty-five files of a scan.
   */
  const announce = (): void => {
    getMainWindow()?.webContents.send('library-changed', summary());
  };

  const scans = createLibraryScanRunner({
    store,
    userDataDir,
    sendProgress: (progress) =>
      getMainWindow()?.webContents.send('library-scan-progress', progress),
    announce,
  });

  /**
   * New roots, scanned without the caller waiting: blocking "Add folder" for
   * as long as a large library takes to read would be exactly the silent,
   * unresponsive click the project's UI rules forbid. Queued behind a walk
   * already running rather than dropped (`request`).
   */
  const addRootsAndScan = (paths: readonly string[]): ILibrarySummary => {
    if (paths.length === 0) {
      return summary();
    }
    const roots = paths.map(buildRoot);
    store.addRoots(roots);
    scans.request(roots.map((root) => root.id));
    return summary();
  };

  ipcMain.handle('library-summary-get', () => summary());

  ipcMain.handle('library-query', (_event, rawRequest: unknown) => {
    const request = parseLibraryRequest(rawRequest);
    if (!request) {
      throw new Error('Not a library question');
    }
    return queries.answer(request);
  });

  ipcMain.handle('library-root-add', async () => {
    const window = getMainWindow();
    const dialogOptions: OpenDialogOptions = {
      properties: ['openDirectory', 'multiSelections'],
    };
    const result = window
      ? await dialog.showOpenDialog(window, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);
    return result.canceled ? summary() : addRootsAndScan(result.filePaths);
  });

  ipcMain.handle('library-root-add-paths', (_event, rawPaths: unknown) => {
    // The one channel that takes a folder in from the window, because a
    // folder dropped on the Library is a real folder the page learned the
    // path of (`webUtils.getPathForFile`). Each candidate has to prove it is
    // a real directory; everything else is dropped.
    //
    // A path on ANOTHER MACHINE is refused before the filesystem is asked
    // anything (`rendererPaths.ts`): `stat` on `\\host\share` authenticates
    // outbound as this user, which would make this channel a way to post
    // somebody's credentials to a host of the caller's choosing. A library on
    // a network share has to be mapped to a drive letter.
    const candidates = Array.isArray(rawPaths)
      ? rawPaths.filter(isLocalRendererPath)
      : [];
    const directories = candidates.filter((candidate) => {
      try {
        return fs.statSync(candidate).isDirectory();
      } catch {
        return false;
      }
    });
    return addRootsAndScan(directories);
  });

  ipcMain.handle('library-queue-files', async (_event, rawPaths: unknown) => {
    const queued = await queueLibraryFiles(store, rawPaths);
    if (queued.trackIds.length > 0) {
      announce();
    }
    scans.request(queued.addedRootIds);
    return queued.trackIds;
  });

  ipcMain.handle('library-root-remove', (_event, rawRootId: unknown) => {
    if (typeof rawRootId === 'string') {
      store.removeRoot(rawRootId);
    }
    return summary();
  });

  // One walk at a time: a second Rescan while one runs is ignored, force or
  // not, because it would walk everything the first is walking.
  // Answered at once: the window follows the walk through its progress, and
  // an ask that waited for the walk would hold the button for its length. A
  // walk logs its own failure (`libraryScanRunner.ts`) and never rejects.
  ipcMain.handle('library-scan-start', () => {
    scans.rescanAll(false);
  });
  ipcMain.handle('library-scan-force', () => {
    scans.rescanAll(true);
  });
  onWindowMessage('library-scan-cancel', () => scans.cancel());

  /**
   * The whole file, for the renderer to hold as a blob.
   *
   * A copy in memory rather than the `fluideq-media://` stream the same track
   * is perfectly capable of serving, and the reason is seeking. A streamed
   * resource makes Chromium abandon the connection, issue a fresh byte range
   * and re-sync the decoder on every jump — heard as a stutter with a moment
   * of the previous passage repeating. A blob is already entirely in memory,
   * so a seek is arithmetic. That is precisely why the Karaoke tab, which has
   * loaded its audio with `URL.createObjectURL` from the start, has always
   * seeked cleanly while this player did not.
   *
   * Audio only and only under the cap. A film is both too large to hold and
   * the one case where streaming is genuinely the right answer, so video
   * keeps the protocol and its byte ranges.
   */
  ipcMain.handle('library-track-bytes', async (_event, rawTrackId: unknown) => {
    const trackPath =
      typeof rawTrackId === 'string' ? store.trackPath(rawTrackId) : undefined;
    if (trackPath === undefined) {
      return undefined;
    }
    try {
      const stats = await fs.promises.stat(trackPath);
      if (stats.size > MAX_PLAYBACK_BLOB_BYTES) {
        return undefined;
      }
      const bytes = await fs.promises.readFile(trackPath);
      // Sliced out of the Buffer rather than handed over as one: a Buffer is
      // a view onto a pooled allocation, and passing it across would carry
      // whatever else currently shares that pool.
      return bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      );
    } catch (error) {
      // eslint-disable-next-line no-console -- this project's one sanctioned console sink; see libraryIndex.ts
      console.error(`Could not read track for playback: ${trackPath}`, error);
      return undefined;
    }
  });

  ipcMain.handle(
    'library-track-signature',
    async (_event, rawTrackId: unknown) => {
      const trackPath =
        typeof rawTrackId === 'string'
          ? store.trackPath(rawTrackId)
          : undefined;
      if (trackPath === undefined) {
        return undefined;
      }
      try {
        const stats = await fs.promises.stat(trackPath);
        return { sizeBytes: stats.size, mtimeMs: stats.mtimeMs };
      } catch {
        return undefined;
      }
    },
  );

  /**
   * A loudness measurement, kept only while the file is the one measured: the
   * window says which bytes it measured, and a file that has changed since
   * is measured again rather than handed an answer for other bytes.
   */
  ipcMain.handle(
    'library-track-normalization-set',
    async (
      _event,
      rawTrackId: unknown,
      rawAnalysis: unknown,
      rawSignature: unknown,
    ) => {
      if (
        typeof rawTrackId !== 'string' ||
        !isNormalizationAnalysis(rawAnalysis) ||
        !isFileSignature(rawSignature)
      ) {
        return false;
      }
      const trackPath = store.trackPath(rawTrackId);
      if (trackPath === undefined) {
        return false;
      }
      try {
        const stats = await fs.promises.stat(trackPath);
        if (
          stats.size !== rawSignature.sizeBytes ||
          stats.mtimeMs !== rawSignature.mtimeMs
        ) {
          return false;
        }
      } catch {
        return false;
      }
      const updated = store.setNormalization(
        rawTrackId,
        rawAnalysis,
        rawSignature,
      );
      if (updated === undefined) {
        return false;
      }
      announce();
      return true;
    },
  );

  ipcMain.handle('library-reveal', (_event, rawTrackId: unknown) => {
    const trackPath =
      typeof rawTrackId === 'string' ? store.trackPath(rawTrackId) : undefined;
    // An id the library no longer knows: nothing to reveal, and nothing to
    // guess at instead.
    if (trackPath !== undefined) {
      shell.showItemInFolder(trackPath);
    }
  });

  // Once per process, on the first window actually shown: a window closed
  // before it ever showed leaves the rescan to the next one.
  let launchRescanStarted = false;
  const startRescan = () => {
    if (!launchRescanStarted) {
      launchRescanStarted = true;
      scans.rescanAll(false);
    }
  };
  return {
    trackPath: store.trackPath,
    watchWindow: (window) => {
      if (launchRescanStarted) {
        return;
      }
      if (window.isVisible()) {
        startRescan();
        return;
      }
      window.once('show', startRescan);
    },
  };
};
