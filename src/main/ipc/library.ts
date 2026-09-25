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
  app,
  BrowserWindow,
  OpenDialogOptions,
  dialog,
  ipcMain,
  shell,
} from 'electron';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  ILibraryIndex,
  ILibraryRoot,
  ILibraryScanProgress,
  ILibraryTrack,
} from '../../common/library/types';
import {
  emptyLibraryIndex,
  isNormalizationAnalysis,
  readLibraryIndex,
  trackPathById,
  writeLibraryIndexSoon,
} from '../library/libraryIndex';
import { replaceRootTracks, upsertTracks } from '../library/libraryIndexTracks';
import { libraryFileKind } from '../../common/library/files';
import {
  buildProvisionalTrack,
  trackIdForPath,
} from '../library/libraryScanDiscovery';
import scanLibraryRootOffThread from '../library/scanHost';
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
 * Every handler below reads and writes this one in-memory copy and asks for
 * it to be saved after each change (`saveIndex`). `handleLibraryMedia` --
 * registered separately in `main.ts`, inside `whenReady`, next to
 * `setUpVideoBrowser` -- reads the same copy through
 * {@link libraryIndexSnapshot} to resolve a track id to a path.
 *
 * `isScanning` is shared by every entry point that can start a walk -- adding
 * a root, a dropped folder, an explicit rescan, and the automatic launch
 * rescan -- so at most one directory is ever being walked at a time;
 * concurrent walks would race on the same in-memory index. `scanAbort` is the
 * running walk's cancel: a signal and not a flag, because the worker's host
 * has to pass a Stop on the moment it is pressed (`scanHost.ts`).
 */
let currentIndex: ILibraryIndex = emptyLibraryIndex();
let indexWasReset = false;
let isScanning = false;
let scanAbort: AbortController | undefined;

/** Whether `currentIndex` is the one on disk yet; see `indexReady`. */
let isIndexLoaded = false;

/**
 * Resolves once the index has been read, reading it on the first call.
 *
 * Not at registration, which `main.ts` does at module scope before the window
 * exists: reading and parsing a library of fourteen thousand songs there
 * (10-40 MB of file, by how it was written) held up the first window on every
 * launch. The first request
 * that needs the index waits for it instead -- the launch rescan once the
 * window is on screen, or the Library opening. Replaced by
 * `registerLibraryIpc`, which knows where the index lives.
 */
let indexReady: () => Promise<void> = () => Promise.resolve();

/**
 * Asks for the index to be written. Requests collapse into one write at a
 * time (`writeLibraryIndexSoon`); a failure is logged by the writer, and the
 * next change asks again.
 */
const saveIndex = (userDataDir: string): void => {
  writeLibraryIndexSoon(userDataDir, () => currentIndex).catch(() => undefined);
};

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

/**
 * Read by `handleLibraryMedia` to resolve a `fluideq-media://track/<id>`
 * request; the first one waits for the index to be read.
 */
export const libraryIndexSnapshot = (): Promise<ILibraryIndex> =>
  indexReady().then(() => currentIndex);

/**
 * Whether `child` is `parent` or lies under it.
 *
 * Compared as resolved paths with a separator appended, so `C:\Music2` is not
 * read as being inside `C:\Music`; case-insensitively, because Windows paths
 * are.
 */
const isInsideDirectory = (parent: string, child: string): boolean => {
  const from = path.resolve(parent).toLowerCase();
  const to = path.resolve(child).toLowerCase();
  return (
    to === from ||
    to.startsWith(from.endsWith(path.sep) ? from : from + path.sep)
  );
};

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
 * Scans one root by id, folding the result back into `currentIndex`, and
 * answers whether that changed anything that is saved or shown.
 *
 * A root whose folder does not exist right now -- an unplugged drive, a
 * folder deleted outside the app -- is marked `isOffline` and left exactly as
 * it was otherwise. Its tracks are never dropped here: doing that would mean
 * the library empties itself every time a USB drive happens to be out at
 * launch, which is worse than showing stale tracks for a folder that is
 * temporarily gone.
 *
 * The time of the scan is kept but is not a change: nothing reads `lastScanAt`
 * back, and recording it cost the launch rescan of an unchanged library a
 * write of the whole index and a copy of it to the window. It reaches the disk
 * with the next change that does.
 */
const scanOneRoot = async (
  deps: ILibraryIpcDeps,
  rootId: string,
  force: boolean,
  signal: AbortSignal,
): Promise<boolean> => {
  const root = currentIndex.roots.find((candidate) => candidate.id === rootId);
  if (!root) {
    return false;
  }
  const wasOffline = root.isOffline === true;
  let stat: fs.Stats | undefined;
  try {
    stat = fs.statSync(root.path);
  } catch {
    stat = undefined;
  }
  if (!stat?.isDirectory()) {
    setRoot(rootId, { isOffline: true });
    return !wasOffline;
  }
  setRoot(rootId, { isOffline: false });
  let changed = wasOffline;
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
        // a batch that re-reads one would duplicate it in the view mid-scan.
        // This never deletes: a track this batch does not mention (not yet
        // reached, or on another root entirely) is left exactly as it was.
        // Only the wholesale replace below, which runs once the whole root
        // has been walked, is allowed to remove one.
        const upserted = upsertTracks(currentIndex.tracks, tracks);
        const mergedTracks = upserted.merged;
        currentIndex = { ...currentIndex, tracks: upserted.tracks };
        changed = true;
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
        deps
          .getMainWindow()
          ?.webContents.send('library-tracks-added', mergedTracks);
      },
      isCancelled: () => signal.aborted,
      signal,
    });
    // The root can be removed by the user while its own walk is still in
    // flight; dropping the result here rather than writing it back avoids
    // resurrecting a root nobody asked to keep any more.
    if (currentIndex.roots.some((candidate) => candidate.id === rootId)) {
      const replaced = replaceRootTracks(
        currentIndex.tracks,
        rootId,
        result.tracks,
      );
      if (replaced) {
        currentIndex = { ...currentIndex, tracks: replaced };
        changed = true;
      }
      changed =
        changed ||
        root.trackCount !== result.tracks.length ||
        root.karaokeSkipped !== result.karaokeSkipped;
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
  return changed;
};

/**
 * Walks every root named in `rootIds`, one at a time, then saves and
 * broadcasts the result if the walk changed it. A second call while one is
 * already running is a no-op -- see the module comment on `isScanning`.
 *
 * A walk that found every file as it was saves nothing and sends nothing. The
 * launch rescan is exactly that almost every time, and it used to end in a
 * write of the whole index and a copy of the whole library to the window --
 * the hitch a few seconds after every launch. Whatever did change mid-walk has
 * reached the window already, batch by batch; the full index follows only
 * when something did, which is also the only way a removed file leaves it.
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
  const abort = new AbortController();
  scanAbort = abort;
  try {
    let batch: string[] = [...rootIds];
    while (batch.length > 0) {
      let changed = false;
      for (let index = 0; index < batch.length; index += 1) {
        if (abort.signal.aborted) {
          break;
        }
        // eslint-disable-next-line no-await-in-loop -- one root walked at a time by design; see the module comment on isScanning.
        const rootChanged = await scanOneRoot(
          deps,
          batch[index],
          force,
          abort.signal,
        );
        changed = changed || rootChanged;
      }
      if (changed) {
        saveIndex(deps.userDataDir);
        deps
          .getMainWindow()
          ?.webContents.send('library-index-changed', currentIndex);
      }
      if (abort.signal.aborted || pendingRescanRootIds.size === 0) {
        break;
      }
      batch = Array.from(pendingRescanRootIds);
      pendingRescanRootIds.clear();
    }
  } finally {
    isScanning = false;
    scanAbort = undefined;
  }
};

/**
 * Starts a scan without making the caller wait for it, logging rather than
 * losing whatever `performScan` itself does not already catch. Every
 * automatic scan in this module goes through this instead of an unawaited
 * `performScan(...)` directly, so that failure is never silently dropped on
 * the floor.
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
  saveIndex(deps.userDataDir);
  requestScan(
    deps,
    newRoots.map((root) => root.id),
  );
  return currentIndex;
};

/** Guards the automatic launch rescan to once per process; see `armLaunchRescan`. */
let launchRescanArmed = false;

/**
 * Starts the one incremental rescan every process gets on its own, timed to
 * the main window's native `show` event rather than to registration, so a
 * full directory walk never competes with the first paint.
 *
 * `registerLibraryIpc` runs before `app.whenReady()`, well before a window
 * exists. This used to poll `getMainWindow` every 250 ms until one did; now
 * Electron's `browser-window-created` says when a window exists, and that
 * window's `show` says when it is on screen. `main.ts` names its window
 * (`setMainWindow`) before showing it, so the first window shown that
 * `getMainWindow` answers with is the main one -- another window shown first,
 * a video's or the wallpaper's, is let go by. A listener holds nothing open,
 * so a process that quits before any window (the second-instance handoff) is
 * not kept by this. `launchRescanArmed` keeps this to one attempt for the life
 * of the process, even if `main.ts` ends up creating more than one window
 * (macOS `activate` can).
 */
const armLaunchRescan = (deps: ILibraryIpcDeps): void => {
  if (launchRescanArmed) {
    return;
  }
  launchRescanArmed = true;
  const startRescan = (): void => {
    indexReady()
      .then(() =>
        runScanInBackground(
          deps,
          currentIndex.roots.map((root) => root.id),
        ),
      )
      .catch((error: unknown) => {
        // eslint-disable-next-line no-console -- this project's one sanctioned console sink; see libraryIndex.ts
        console.error('Could not start the launch rescan', error);
      });
  };
  const existing = deps.getMainWindow();
  if (existing) {
    if (existing.isVisible()) {
      startRescan();
      return;
    }
    existing.once('show', startRescan);
    return;
  }
  // `app` is absent where this module is loaded outside a real Electron main
  // process -- the IPC tests -- and there is then no window to wait for.
  if (typeof app?.on !== 'function') {
    return;
  }
  const onWindowCreated = (
    _event: Electron.Event,
    window: BrowserWindow,
  ): void => {
    window.once('show', () => {
      if (deps.getMainWindow() !== window) {
        return;
      }
      app.removeListener('browser-window-created', onWindowCreated);
      startRescan();
    });
  };
  app.on('browser-window-created', onWindowCreated);
};

/**
 * Index, roots, scanning and reveal -- everything the Library tab needs from
 * the main process.
 */
export const registerLibraryIpc = (deps: ILibraryIpcDeps): void => {
  const { userDataDir, getMainWindow } = deps;
  currentIndex = emptyLibraryIndex();
  indexWasReset = false;
  isIndexLoaded = false;
  let indexLoad: Promise<void> | undefined;
  indexReady = () => {
    indexLoad ??= (async () => {
      const loaded = await readLibraryIndex(userDataDir);
      currentIndex = loaded.index;
      indexWasReset = loaded.wasReset;
      isIndexLoaded = true;
    })();
    return indexLoad;
  };

  const indexReply = () => ({ index: currentIndex, wasReset: indexWasReset });
  // Answered at once when the index is already in memory, which is every
  // request after the first.
  ipcMain.handle('library-index-get', () =>
    isIndexLoaded ? indexReply() : indexReady().then(indexReply),
  );

  ipcMain.handle('library-root-add', async () => {
    const window = getMainWindow();
    const dialogOptions: OpenDialogOptions = {
      properties: ['openDirectory', 'multiSelections'],
    };
    const result = window
      ? await dialog.showOpenDialog(window, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);
    await indexReady();
    if (result.canceled) {
      return currentIndex;
    }
    return addRootsAndScan(deps, result.filePaths);
  });

  ipcMain.handle(
    'library-root-add-paths',
    async (_event, rawPaths: unknown) => {
      // Only waited for while it is still being read: once it is, a drop
      // joins the index in the turn it arrives, as it always has
      // (`libraryIpc.test.ts` drops one from inside another folder's walk).
      if (!isIndexLoaded) {
        await indexReady();
      }
      // The one channel that takes a path in from the window, because a folder
      // dropped on the Library is a real folder the page learned the path of
      // (`webUtils.getPathForFile`). Each candidate has to prove it is a real
      // directory; everything else is dropped.
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
      return addRootsAndScan(deps, directories);
    },
  );

  /**
   * Music files dropped straight onto the player's queue.
   *
   * The Library's own drop takes folders (`library-root-add-paths` above);
   * this one takes the files themselves and hands back their ids, so the
   * queue can be added to in the same gesture (Ivan, 2026-09-22). A file
   * already in the index keeps the id it has, so dropping a song twice does
   * not make two of it.
   *
   * WHAT IT PUTS IN THE INDEX, AND WHY IT IS ENOUGH TO PLAY. A file nobody
   * has scanned gets the same provisional row phase one of a scan would give
   * it — real identity, real path, the title from its file name, no tags and
   * no duration (`buildProvisionalTrack`). That is everything playback needs,
   * so the song starts at once; the scan started underneath fills the rest in
   * and the row settles by itself.
   *
   * Its FOLDER becomes a library root, which is the same thing dropping that
   * folder on the Library would have done. A track has to belong to a root or
   * a rescan has nothing to keep it alive, and a listener who drags music
   * into FluidEQ has said, as plainly as anyone can, that this is music they
   * want it to know about.
   *
   * A path on another machine is refused before the filesystem is asked
   * anything, for the reason `library-root-add-paths` gives.
   */
  ipcMain.handle('library-queue-files', async (_event, rawPaths: unknown) => {
    await indexReady();
    const candidates = Array.isArray(rawPaths)
      ? rawPaths.filter(isLocalRendererPath)
      : [];
    const files = candidates.filter((candidate) => {
      if (libraryFileKind(path.basename(candidate)) === undefined) {
        return false;
      }
      try {
        return fs.statSync(candidate).isFile();
      } catch {
        return false;
      }
    });
    if (files.length === 0) {
      return { index: currentIndex, trackIds: [] };
    }

    const known = new Map(currentIndex.tracks.map((row) => [row.id, row]));
    // One root per folder the drop touched that no root covers already.
    const rootFor = new Map<string, string>();
    const addedRoots: ILibraryRoot[] = [];
    const rootIdOf = (directory: string): string => {
      const covering = currentIndex.roots.find((root) =>
        isInsideDirectory(root.path, directory),
      );
      if (covering) {
        return covering.id;
      }
      const already = rootFor.get(directory.toLowerCase());
      if (already !== undefined) {
        return already;
      }
      const root = buildRoot(directory);
      rootFor.set(directory.toLowerCase(), root.id);
      addedRoots.push(root);
      return root.id;
    };

    // Built in the order the listener dropped them in, which is the order
    // they are queued in. `Promise.all` over the whole drop rather than one
    // await after another: each new file is a single stat, and the roots are
    // decided before any of them run, so nothing here races anything else.
    const rows = await Promise.all(
      files.map(async (filePath) => {
        const id = trackIdForPath(filePath);
        if (known.has(id)) {
          return { id, row: undefined };
        }
        const directory = path.dirname(filePath);
        const name = path.basename(filePath);
        const row = await buildProvisionalTrack(
          {
            filePath,
            name,
            kind: libraryFileKind(name) ?? 'audio',
            dir: directory,
            // Only the artwork lookup reads this, and a provisional row has
            // no artwork; the scan lists the folder properly.
            dirFileNames: [],
          },
          rootIdOf(directory),
        );
        return { id, row };
      }),
    );
    const addedTracks = rows
      .map((entry) => entry.row)
      .filter((row): row is ILibraryTrack => row !== undefined);
    const trackIds = rows
      .filter((entry) => entry.row !== undefined || known.has(entry.id))
      .map((entry) => entry.id);

    if (addedRoots.length || addedTracks.length) {
      currentIndex = {
        ...currentIndex,
        roots: [...currentIndex.roots, ...addedRoots],
        tracks: [...currentIndex.tracks, ...addedTracks],
      };
      saveIndex(deps.userDataDir);
      requestScan(
        deps,
        addedRoots.map((root) => root.id),
      );
    }
    return { index: currentIndex, trackIds };
  });

  ipcMain.handle('library-root-remove', async (_event, rawRootId: unknown) => {
    await indexReady();
    if (typeof rawRootId !== 'string') {
      return currentIndex;
    }
    currentIndex = {
      ...currentIndex,
      roots: currentIndex.roots.filter((root) => root.id !== rawRootId),
      tracks: currentIndex.tracks.filter((track) => track.rootId !== rawRootId),
    };
    saveIndex(userDataDir);
    return currentIndex;
  });

  ipcMain.handle('library-scan-start', async () => {
    await indexReady();
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

  ipcMain.handle('library-scan-force', async () => {
    await indexReady();
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

  onWindowMessage('library-scan-cancel', () => {
    scanAbort?.abort();
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
    await indexReady();
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

  ipcMain.handle(
    'library-track-signature',
    async (_event, rawTrackId: unknown) => {
      if (typeof rawTrackId !== 'string') {
        return undefined;
      }
      await indexReady();
      const trackPath = trackPathById(currentIndex, rawTrackId);
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
        !rawSignature ||
        typeof rawSignature !== 'object' ||
        !('sizeBytes' in rawSignature) ||
        !('mtimeMs' in rawSignature) ||
        typeof rawSignature.sizeBytes !== 'number' ||
        typeof rawSignature.mtimeMs !== 'number'
      ) {
        return false;
      }
      await indexReady();
      const isMeasurable = (track: ILibraryTrack) =>
        track.id === rawTrackId && track.kind === 'audio';
      if (!currentIndex.tracks.some(isMeasurable)) {
        return false;
      }
      const trackPath = trackPathById(currentIndex, rawTrackId);
      if (!trackPath) {
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
      // Found again after the stat, not before it: a scan can merge in while
      // the disk answers, and a position taken earlier could then name
      // another song, which would be given this one's loudness.
      const at = currentIndex.tracks.findIndex(isMeasurable);
      if (at < 0) {
        return false;
      }
      const updated = {
        ...currentIndex.tracks[at],
        sizeBytes: rawSignature.sizeBytes,
        mtimeMs: rawSignature.mtimeMs,
        normalization: rawAnalysis,
      };
      currentIndex = {
        ...currentIndex,
        tracks: currentIndex.tracks.map((track, index) =>
          index === at ? updated : track,
        ),
      };
      saveIndex(userDataDir);
      getMainWindow()?.webContents.send('library-tracks-added', [updated]);
      return true;
    },
  );

  ipcMain.handle('library-reveal', async (_event, rawTrackId: unknown) => {
    if (typeof rawTrackId !== 'string') {
      return;
    }
    await indexReady();
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
