/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Which roots are walked, when, and what a walk leaves in the store.
 *
 * One walk at a time, for every way one can start — a folder added, a folder
 * dropped, music dropped on a queue, Rescan, and the one rescan every launch
 * gets. Two walks at once would confirm and sweep the same store against two
 * marks. A root asked for while a walk is under way is queued and walked
 * after it (`request`); a second Rescan while one runs is ignored
 * (`rescanAll`), because it would walk everything the first is walking.
 *
 * A walk writes as it goes: every batch the scan reads lands in the store and
 * the window is told the library changed. Nothing about the root is held
 * here — the old index held every song in main and replaced a root's whole
 * list at the end of its walk.
 */

import fs from 'fs';
import type { ILibraryScanProgress } from '../../common/library/types';
import type { ILibraryStore } from './libraryStore';
import scanLibraryRootOffThread from './scanHost';

export interface ILibraryScanRunnerDeps {
  store: ILibraryStore;
  userDataDir: string;
  sendProgress: (progress: ILibraryScanProgress) => void;
  /** The library changed; the window re-asks for what it shows. */
  announce: () => void;
}

export interface ILibraryScanRunner {
  readonly isScanning: () => boolean;
  /**
   * Walks these roots now, or once the walk under way is done. Settles when
   * the walk that took them has finished.
   */
  readonly request: (rootIds: readonly string[]) => Promise<void>;
  /**
   * Walks every root, unless a walk is already under way. `force` re-reads
   * every file whatever its size and time say (`IWalkContext.force`).
   * Settles when that walk — or the one already running — has finished.
   */
  readonly rescanAll: (force: boolean) => Promise<void>;
  readonly cancel: () => void;
}

export const createLibraryScanRunner = (
  deps: ILibraryScanRunnerDeps,
): ILibraryScanRunner => {
  const { store } = deps;
  let isScanning = false;
  let cancelRequested = false;
  /** The walk running now, for a request that joins it rather than starts. */
  let walk: Promise<void> = Promise.resolve();
  /**
   * Roots asked for while a walk was running, walked by that same walk once
   * it is done (`performScan`'s loop) — never dropped for losing the race.
   */
  const pending = new Set<string>();

  /**
   * One root's walk.
   *
   * A root whose folder is not there right now — an unplugged drive, a
   * folder deleted outside the app — is marked offline and otherwise left
   * exactly as it was: emptying the library every time a USB drive is out at
   * launch would be worse than showing songs from a folder that is briefly
   * gone.
   *
   * Every file the walk finds is confirmed with this walk's mark; a walk
   * that reaches its end then sweeps the root's unconfirmed songs, which are
   * the ones no longer on disk. A cancelled walk sweeps nothing, because
   * what it never reached is not gone.
   */
  const scanOneRoot = async (rootId: string, force: boolean): Promise<void> => {
    const root = store.root(rootId);
    if (!root) {
      return;
    }
    let isDirectory = false;
    try {
      isDirectory = fs.statSync(root.path).isDirectory();
    } catch {
      isDirectory = false;
    }
    if (!isDirectory) {
      store.setRoot(rootId, { isOffline: true });
      deps.announce();
      return;
    }
    store.setRoot(rootId, { isOffline: false });
    const mark = store.beginScan();
    // A root removed while its own walk is in flight takes its songs with it;
    // a batch landing after that must not bring any of them back.
    const isKept = () => store.root(rootId) !== undefined;
    try {
      const result = await scanLibraryRootOffThread({
        rootId,
        rootPath: root.path,
        userDataDir: deps.userDataDir,
        lookupKnown: store.trackByPath,
        force,
        onProgress: deps.sendProgress,
        onTracks: (tracks, confirmed) => {
          if (!isKept()) {
            return;
          }
          // A file listed but not yet read is written unconfirmed: if the
          // walk is cancelled before reading it, it stays (it was seen); if
          // the walk finishes, reading it confirmed it.
          store.upsertTracks(tracks, confirmed ? mark : 0);
          deps.announce();
        },
        onUnchanged: (trackIds) => {
          if (isKept()) {
            store.confirmTracks(trackIds, mark);
          }
        },
        isCancelled: () => cancelRequested,
      });
      if (!isKept()) {
        return;
      }
      if (!result.wasCancelled) {
        store.sweepRoot(rootId, mark);
      }
      store.setRoot(rootId, {
        trackCount: store.rootTrackCount(rootId),
        karaokeSkipped: result.karaokeSkipped,
        lastScanAt: Date.now(),
      });
      deps.announce();
    } catch (error) {
      // One root failing partway — a permissions error, a device pulled
      // mid-walk — must not lose the roots queued behind it, and must not
      // vanish silently either.
      // eslint-disable-next-line no-console -- this project's one sanctioned console sink; see libraryIndex.ts
      console.error(`Could not scan library root ${root.path}`, error);
      // The window decides "still scanning" from the last progress event's
      // `isDone` alone, so a throw with no terminal event would pin the scan
      // strip on, Rescan disabled and Stop inert, for the rest of the
      // session. The counts are not real; nothing reads them once it is done.
      deps.sendProgress({
        rootId,
        seen: 0,
        parsed: 0,
        karaokeSkipped: 0,
        isDone: true,
      });
    }
  };

  /**
   * Walks `rootIds` one at a time, then whatever was queued meanwhile, all
   * under one `isScanning` — a loop rather than a call to itself, so there is
   * no gap where a second walk could start between the two.
   */
  const performScan = async (
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
          // eslint-disable-next-line no-await-in-loop -- one root walked at a time by design; see the module comment.
          await scanOneRoot(batch[index], force);
        }
        if (cancelRequested || pending.size === 0) {
          break;
        }
        batch = Array.from(pending);
        pending.clear();
      }
    } finally {
      isScanning = false;
      cancelRequested = false;
    }
  };

  /** Starts a walk, and logs what it did not catch: nobody waits on a walk
   * to find out it failed. */
  const runInBackground = (
    rootIds: readonly string[],
    force: boolean,
  ): Promise<void> => {
    walk = performScan(rootIds, force).catch((error: unknown) => {
      // eslint-disable-next-line no-console -- this project's one sanctioned console sink; see libraryIndex.ts
      console.error('Library scan failed', error);
    });
    return walk;
  };

  return {
    isScanning: () => isScanning,
    request: (rootIds) => {
      if (rootIds.length === 0) {
        return Promise.resolve();
      }
      if (isScanning) {
        rootIds.forEach((rootId) => pending.add(rootId));
        return walk;
      }
      return runInBackground(rootIds, false);
    },
    rescanAll: (force) => {
      if (isScanning) {
        return walk;
      }
      return runInBackground(
        store.roots().map((root) => root.id),
        force,
      );
    },
    cancel: () => {
      cancelRequested = true;
    },
  };
};
