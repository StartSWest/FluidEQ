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
import crypto from 'crypto';
import fs from 'fs';
// Imported rather than the ambient global: under the jsdom test environment,
// global `setTimeout` is jsdom's browser-style version, whose return value has
// no `.unref()`. This process only ever runs under real Node (the Electron
// main process never sees jsdom), so importing it directly from `timers`
// reaches Node's own implementation regardless of what a test replaced the
// global with.
import { setTimeout as scheduleTimeout } from 'timers';
import {
  ILibraryIndex,
  ILibraryRoot,
  ILibraryScanProgress,
} from '../../common/library/types';
import {
  emptyLibraryIndex,
  loadLibraryIndex,
  saveLibraryIndex,
  trackPathById,
} from '../library/libraryIndex';
import { scanLibraryRootOffThread } from '../library/scanHost';

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

/**
 * What these handlers need from the process around them.
 *
 * The library channels touch the userData directory -- where the index and
 * its cached artwork live -- and the main window, where scan progress and
 * index changes are sent. `getMainWindow` is a function for the same reason
 * as in `karaoke.ts`: the window is created, destroyed and recreated over the
 * life of the process, so a reference captured at registration would be the
 * first one forever. Here it also has to tolerate being called before any
 * window exists at all, since `registerLibraryIpc` runs at module scope in
 * `main.ts`, ahead of `app.whenReady()`.
 */
export interface ILibraryIpcDeps {
  userDataDir: string;
  getMainWindow: () => BrowserWindow | null;
}

/**
 * The library index, held here rather than reloaded on every request.
 *
 * Every handler below reads and writes this one in-memory copy and saves it
 * to disk after each change. `handleLibraryMedia` -- registered separately in
 * `main.ts`, inside `whenReady`, next to `setUpVideoBrowser` -- reads the same
 * copy through {@link libraryIndexSnapshot} to resolve a track id to a path.
 *
 * `isScanning`/`cancelRequested` are this module's stand-in for an
 * `AbortController`: `scanLibraryRoot` already takes a plain `isCancelled`
 * function rather than a signal object, so a boolean polled from it is all a
 * cancel needs to be. `isScanning` is shared by every entry point that can
 * start a walk -- adding a root, a dropped folder, an explicit rescan, and
 * the automatic launch rescan -- so at most one directory is ever being
 * walked at a time; concurrent walks would race on the same in-memory index.
 */
let currentIndex: ILibraryIndex = emptyLibraryIndex();
let indexWasReset = false;
let isScanning = false;
let cancelRequested = false;

/**
 * Roots that asked to be scanned while a walk was already running.
 *
 * `requestScan` is what fills this in, for every caller that must not lose a
 * request just because it lost the race for `isScanning` -- adding a root
 * from the dialog or a drop. `library-scan-start` and the launch rescan
 * deliberately do not go through `requestScan`: the brief calls for those to
 * be dropped, not queued, when a scan is already running. `performScan`
 * drains this set itself once the walk it is already doing finishes; nothing
 * else ever starts a scan on the strength of this set being non-empty.
 */
const pendingRescanRootIds = new Set<string>();

/** Read by `handleLibraryMedia` to resolve a `fluideq-media://track/<id>` request. */
export const libraryIndexSnapshot = (): ILibraryIndex => currentIndex;

const buildRoot = (rootPath: string): ILibraryRoot => ({
  id: crypto.randomUUID(),
  path: rootPath,
  addedAt: Date.now(),
  trackCount: 0,
  karaokeSkipped: 0,
});

const setRoot = (rootId: string, patch: Partial<ILibraryRoot>): void => {
  currentIndex = {
    ...currentIndex,
    roots: currentIndex.roots.map((root) =>
      root.id === rootId ? { ...root, ...patch } : root,
    ),
  };
};

/**
 * Scans one root by id, folding the result back into `currentIndex`.
 *
 * A root whose folder does not exist right now -- an unplugged drive, a
 * folder deleted outside the app -- is marked `isOffline` and left exactly as
 * it was otherwise. Its tracks are never dropped here: doing that would mean
 * the library empties itself every time a USB drive happens to be out at
 * launch, which is worse than showing stale tracks for a folder that is
 * temporarily gone.
 */
const scanOneRoot = async (
  deps: ILibraryIpcDeps,
  rootId: string,
  force: boolean,
): Promise<void> => {
  const root = currentIndex.roots.find((candidate) => candidate.id === rootId);
  if (!root) {
    return;
  }
  let stat: fs.Stats | undefined;
  try {
    stat = fs.statSync(root.path);
  } catch {
    stat = undefined;
  }
  if (!stat?.isDirectory()) {
    setRoot(rootId, { isOffline: true });
    return;
  }
  setRoot(rootId, { isOffline: false });
  // A force rescan hands the walk nothing to compare against, so every
  // candidate is re-read regardless of whether its size and mtime still
  // match — the escape hatch for a tagger's preserve-mtime option, and for
  // `artId` itself: `storeArtwork` trusts a cached id forever on a bare
  // `existsSync` (see its own comment), so if anything ever clears
  // `userData/library-art` from outside the app, every affected cover would
  // otherwise render blank permanently, with no ordinary rescan able to
  // notice and re-derive it.
  const known = force
    ? []
    : currentIndex.tracks.filter((track) => track.rootId === rootId);
  try {
    const result = await scanLibraryRootOffThread({
      rootId,
      rootPath: root.path,
      userDataDir: deps.userDataDir,
      known,
      onProgress: (progress) => {
        deps
          .getMainWindow()
          ?.webContents.send('library-scan-progress', progress);
      },
      onTracks: (tracks) => {
        // Same guard as the final merge below: a root removed while its own
        // walk is still in flight must not have a mid-scan batch resurrect
        // it in the index.
        if (!currentIndex.roots.some((candidate) => candidate.id === rootId)) {
          return;
        }
        // Upsert by id, not a concat -- during a rescan `currentIndex`
        // already holds this root's previously-known tracks, so appending
        // a batch that reconfirms one unchanged would duplicate it in the
        // view mid-scan. This never deletes: a track this batch does not
        // mention (not yet reached, or on another root entirely) is left
        // exactly as it was. Only the wholesale replace below, which runs
        // once the whole root has been walked, is allowed to remove one.
        const batchIds = new Set(tracks.map((track) => track.id));
        currentIndex = {
          ...currentIndex,
          tracks: [
            ...currentIndex.tracks.filter((track) => !batchIds.has(track.id)),
            ...tracks,
          ],
        };
        // The batch, and not the index it was just merged into.
        //
        // This used to send `currentIndex` — the whole library, every
        // twenty-five files. On fourteen thousand tracks that is five hundred
        // and sixty messages carrying fourteen thousand objects each: main
        // serialises all of it and the renderer deserialises all of it before
        // either can do anything else, and that is the window going
        // unresponsive for the length of a scan. It was never about which
        // process did the reading — that has been a `utilityProcess` all
        // along.
        //
        // Sending the twenty-five that actually changed leaves main's copy
        // authoritative for anything that asks for it later, and gives the
        // renderer the same information for three orders of magnitude less
        // work. It merges them itself; see `LibraryContext`.
        deps.getMainWindow()?.webContents.send('library-tracks-added', tracks);
      },
      isCancelled: () => cancelRequested,
    });
    // The root can be removed by the user while its own walk is still in
    // flight; dropping the result here rather than writing it back avoids
    // resurrecting a root nobody asked to keep any more.
    if (currentIndex.roots.some((candidate) => candidate.id === rootId)) {
      currentIndex = {
        ...currentIndex,
        tracks: [
          ...currentIndex.tracks.filter((track) => track.rootId !== rootId),
          ...result.tracks,
        ],
      };
      setRoot(rootId, {
        trackCount: result.tracks.length,
        karaokeSkipped: result.karaokeSkipped,
        lastScanAt: Date.now(),
      });
    }
  } catch (error) {
    // One root failing partway through -- a permissions error, a device
    // pulled mid-walk -- must not lose every other root queued behind it, and
    // must not vanish silently either.
    // eslint-disable-next-line no-console -- this project's one sanctioned console sink; see libraryIndex.ts
    console.error(`Could not scan library root ${root.path}`, error);
    // `LibraryContext.tsx`'s `isScanning` is derived solely from the last
    // `progress.isDone` it received (see its own comment) -- with no event
    // sent here, whatever throw broke `scanLibraryRoot` also leaves the
    // renderer believing this root's walk never finished: the strip stays
    // pinned, Rescan stays disabled, Stop stays inert, for the rest of the
    // session. The counts are not real -- the walk stopped at an unknown
    // point -- but `isDone: true` is what actually unwedges the UI, and
    // nothing downstream of a scan progress event reads these counts once
    // `isDone` is true.
    const terminal: ILibraryScanProgress = {
      rootId,
      seen: 0,
      parsed: 0,
      karaokeSkipped: 0,
      isDone: true,
    };
    deps.getMainWindow()?.webContents.send('library-scan-progress', terminal);
  }
};

/**
 * Walks every root named in `rootIds`, one at a time, then saves and
 * broadcasts the result. A second call while one is already running is a
 * no-op -- see the module comment on `isScanning`.
 *
 * Before returning, it drains `pendingRescanRootIds`: a root queued by
 * `requestScan` while this walk was already under way is picked up as a
 * further batch of the same walk instead of being left to wait for the next
 * explicit rescan, or for a launch rescan that only ever runs once. Written
 * as a loop over batches, all under one `isScanning = true`, rather than as
 * this function calling itself once it is done -- a batch that queues yet
 * another root while it is draining is caught by the loop condition on its
 * next pass, with no repeated call into this function and no gap where
 * `isScanning` is briefly false and a second, truly concurrent walk could
 * start.
 *
 * `force` applies to every root this call walks, including a further batch
 * drained from `pendingRescanRootIds` before this returns -- see
 * `scanOneRoot`'s own comment for what it changes.
 */
const performScan = async (
  deps: ILibraryIpcDeps,
  rootIds: readonly string[],
  force: boolean,
): Promise<void> => {
  if (isScanning) {
    return;
  }
  isScanning = true;
  cancelRequested = false;
  try {
    let batch: string[] = [...rootIds];
    while (batch.length > 0) {
      for (let index = 0; index < batch.length; index += 1) {
        if (cancelRequested) {
          break;
        }
        // eslint-disable-next-line no-await-in-loop -- one root walked at a time by design; see the module comment on isScanning.
        await scanOneRoot(deps, batch[index], force);
      }
      saveLibraryIndex(deps.userDataDir, currentIndex);
      deps
        .getMainWindow()
        ?.webContents.send('library-index-changed', currentIndex);
      if (cancelRequested || pendingRescanRootIds.size === 0) {
        break;
      }
      batch = Array.from(pendingRescanRootIds);
      pendingRescanRootIds.clear();
    }
  } finally {
    isScanning = false;
    cancelRequested = false;
  }
};

/**
 * Starts a scan without making the caller wait for it, logging rather than
 * losing whatever `performScan` itself does not already catch (a
 * `saveLibraryIndex` write failing, say). Every automatic scan in this module
 * goes through this instead of an unawaited `performScan(...)` directly, so
 * that failure is never silently dropped on the floor.
 */
const runScanInBackground = (
  deps: ILibraryIpcDeps,
  rootIds: readonly string[],
  force = false,
): void => {
  performScan(deps, rootIds, force).catch((error: unknown) => {
    // eslint-disable-next-line no-console -- this project's one sanctioned console sink; see libraryIndex.ts
    console.error('Library scan failed', error);
  });
};

/**
 * Starts a scan, or -- if one is already running -- queues these roots to be
 * picked up by `performScan`'s own drain once it finishes, rather than
 * dropping the request. Used by every caller that must not silently lose a
 * newly added root: `library-root-add` and `library-root-add-paths`.
 * `library-scan-start` and the launch rescan call `runScanInBackground`
 * directly instead, on purpose -- the brief calls for a second explicit
 * rescan request to be ignored, not queued, while one is already running.
 */
const requestScan = (
  deps: ILibraryIpcDeps,
  rootIds: readonly string[],
): void => {
  if (rootIds.length === 0) {
    return;
  }
  if (isScanning) {
    rootIds.forEach((rootId) => pendingRescanRootIds.add(rootId));
    return;
  }
  runScanInBackground(deps, rootIds);
};

/**
 * Adds each path as a new root and starts scanning them, without waiting for
 * the scan to finish.
 *
 * Returning before the walk completes is deliberate: blocking "Add folder"
 * for as long as a large library takes to read would be exactly the silent,
 * unresponsive click the project's UI rules forbid. The caller gets the new
 * roots back immediately, at `trackCount: 0`; `library-scan-progress` and
 * `library-index-changed` carry the rest. Goes through `requestScan`, not
 * `runScanInBackground`, so a root dropped while another is already scanning
 * is queued rather than left at `trackCount: 0` with nothing left to pick it
 * back up -- see `requestScan`.
 */
const addRootsAndScan = (
  deps: ILibraryIpcDeps,
  paths: readonly string[],
): ILibraryIndex => {
  if (paths.length === 0) {
    return currentIndex;
  }
  const newRoots = paths.map(buildRoot);
  currentIndex = {
    ...currentIndex,
    roots: [...currentIndex.roots, ...newRoots],
  };
  saveLibraryIndex(deps.userDataDir, currentIndex);
  requestScan(
    deps,
    newRoots.map((root) => root.id),
  );
  return currentIndex;
};

const LAUNCH_RESCAN_POLL_MS = 250;

/** Guards the automatic launch rescan to once per process; see `armLaunchRescan`. */
let launchRescanArmed = false;

/**
 * Starts the one incremental rescan every process gets on its own, timed to
 * the window's native `show` event rather than to registration.
 *
 * `registerLibraryIpc` runs before `app.whenReady()`, well before a window
 * exists, so there is nothing to attach to yet -- this polls `getMainWindow`
 * until there is, rather than requiring `main.ts` to call back in once the
 * window is up. Each poll is `unref`'d so a process that quits before a
 * window is ever created (the second-instance handoff, for one) is never
 * held open by this alone. Once a window is found, the scan waits for its
 * `show` event -- checking `isVisible` first, in case it was already shown
 * between polls -- so a full directory walk never competes with the first
 * paint. `launchRescanArmed` keeps this to one attempt for the life of the
 * process, even if `main.ts` ends up creating more than one window (macOS
 * `activate` can).
 */
const armLaunchRescan = (deps: ILibraryIpcDeps): void => {
  if (launchRescanArmed) {
    return;
  }
  launchRescanArmed = true;
  const startRescan = (): void => {
    runScanInBackground(
      deps,
      currentIndex.roots.map((root) => root.id),
    );
  };
  const waitForWindow = (): void => {
    const window = deps.getMainWindow();
    if (!window) {
      scheduleTimeout(waitForWindow, LAUNCH_RESCAN_POLL_MS).unref();
      return;
    }
    if (window.isVisible()) {
      startRescan();
      return;
    }
    window.once('show', startRescan);
  };
  waitForWindow();
};

/**
 * Index, roots, scanning and reveal -- everything the Library tab needs from
 * the main process.
 */
export const registerLibraryIpc = (deps: ILibraryIpcDeps): void => {
  const { userDataDir, getMainWindow } = deps;
  const loaded = loadLibraryIndex(userDataDir);
  currentIndex = loaded.index;
  indexWasReset = loaded.wasReset;

  ipcMain.handle('library-index-get', () => ({
    index: currentIndex,
    wasReset: indexWasReset,
  }));

  ipcMain.handle('library-root-add', async () => {
    const window = getMainWindow();
    const dialogOptions: OpenDialogOptions = {
      properties: ['openDirectory', 'multiSelections'],
    };
    const result = window
      ? await dialog.showOpenDialog(window, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);
    if (result.canceled) {
      return currentIndex;
    }
    return addRootsAndScan(deps, result.filePaths);
  });

  ipcMain.handle('library-root-add-paths', (_event, rawPaths: unknown) => {
    // The only channel that takes a path in from the renderer, so it may add
    // a root and nothing more -- never a way to read an arbitrary file. Each
    // candidate has to prove it is a real directory before it is accepted;
    // everything else, a file or a path that no longer exists, is dropped.
    const candidates = Array.isArray(rawPaths)
      ? rawPaths.filter((value): value is string => typeof value === 'string')
      : [];
    const directories = candidates.filter((candidate) => {
      try {
        return fs.statSync(candidate).isDirectory();
      } catch {
        return false;
      }
    });
    return addRootsAndScan(deps, directories);
  });

  ipcMain.handle('library-root-remove', (_event, rawRootId: unknown) => {
    if (typeof rawRootId !== 'string') {
      return currentIndex;
    }
    currentIndex = {
      ...currentIndex,
      roots: currentIndex.roots.filter((root) => root.id !== rawRootId),
      tracks: currentIndex.tracks.filter((track) => track.rootId !== rawRootId),
    };
    saveLibraryIndex(userDataDir, currentIndex);
    return currentIndex;
  });

  ipcMain.handle('library-scan-start', () => {
    if (isScanning) {
      // One scan at a time: a second request while one is running is ignored
      // rather than queued.
      return;
    }
    runScanInBackground(
      deps,
      currentIndex.roots.map((root) => root.id),
    );
  });

  ipcMain.handle('library-scan-force', () => {
    // Same one-at-a-time rule as `library-scan-start` above -- a second
    // request while a walk is already running is ignored rather than
    // queued, force or not.
    if (isScanning) {
      return;
    }
    runScanInBackground(
      deps,
      currentIndex.roots.map((root) => root.id),
      true,
    );
  });

  ipcMain.on('library-scan-cancel', () => {
    cancelRequested = true;
  });

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
    if (typeof rawTrackId !== 'string') {
      return undefined;
    }
    const trackPath = trackPathById(currentIndex, rawTrackId);
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

  ipcMain.handle('library-reveal', (_event, rawTrackId: unknown) => {
    if (typeof rawTrackId !== 'string') {
      return;
    }
    const trackPath = trackPathById(currentIndex, rawTrackId);
    if (trackPath === undefined) {
      // An id the index no longer knows -- nothing to reveal, and nothing to
      // guess at instead.
      return;
    }
    shell.showItemInFolder(trackPath);
  });

  armLaunchRescan(deps);
};
