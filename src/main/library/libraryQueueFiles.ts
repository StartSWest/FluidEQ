/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Music files dropped straight onto the player's queue.
 *
 * The Library's own drop takes folders; this takes the files themselves and
 * answers their ids, so the queue can be added to in the same gesture (Ivan,
 * 2026-09-22). A file the library already has keeps its id, so dropping a
 * song twice does not make two of it.
 *
 * WHAT IT WRITES, AND WHY IT IS ENOUGH TO PLAY. A file nobody has scanned gets
 * the row phase one of a scan would give it — real identity, real path, the
 * title from its file name, no tags and no duration (`buildProvisionalTrack`).
 * That is everything playback needs, so the song starts at once; the scan
 * started underneath fills the rest in and the row settles by itself.
 *
 * Its FOLDER becomes a library root, which is what dropping that folder on
 * the Library would have done. A song has to belong to a root or a rescan
 * has nothing to keep it alive, and a listener who drags music into FluidEQ
 * has said, as plainly as anyone can, that this is music they want it to
 * know about.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { libraryFileKind } from '../../common/library/files';
import type { ILibraryRoot, ILibraryTrack } from '../../common/library/types';
import { isLocalRendererPath } from '../rendererPaths';
import { buildProvisionalTrack, trackIdForPath } from './libraryScanDiscovery';
import type { ILibraryStore } from './libraryStore';

export const buildRoot = (rootPath: string): ILibraryRoot => ({
  id: crypto.randomUUID(),
  path: rootPath,
  addedAt: Date.now(),
  trackCount: 0,
  karaokeSkipped: 0,
});

/**
 * Whether `child` is `parent` or lies under it: compared as resolved paths
 * with a separator appended, so `C:\Music2` is not read as inside `C:\Music`,
 * and case-insensitively, because Windows paths are.
 */
const isInsideDirectory = (parent: string, child: string): boolean => {
  const from = path.resolve(parent).toLowerCase();
  const to = path.resolve(child).toLowerCase();
  return (
    to === from ||
    to.startsWith(from.endsWith(path.sep) ? from : from + path.sep)
  );
};

const isPlayableFile = (candidate: string): boolean => {
  if (libraryFileKind(path.basename(candidate)) === undefined) {
    return false;
  }
  try {
    return fs.statSync(candidate).isFile();
  } catch {
    return false;
  }
};

export interface IQueuedFiles {
  /** The dropped songs' ids, in the order they were dropped. */
  trackIds: string[];
  /** Roots made for folders no root covered; the caller scans them. */
  addedRootIds: string[];
}

/**
 * Writes what the store does not have yet and answers every dropped song's id.
 *
 * A path on another machine is refused before the filesystem is asked
 * anything (`rendererPaths.ts`): a `stat` on `\\host\share` authenticates
 * outbound as this user.
 */
export const queueLibraryFiles = async (
  store: ILibraryStore,
  rawPaths: unknown,
): Promise<IQueuedFiles> => {
  const files = (
    Array.isArray(rawPaths) ? rawPaths.filter(isLocalRendererPath) : []
  ).filter(isPlayableFile);
  if (files.length === 0) {
    return { trackIds: [], addedRootIds: [] };
  }

  const roots = store.roots();
  // One root per folder the drop touched that no root covers already.
  const rootFor = new Map<string, string>();
  const addedRoots: ILibraryRoot[] = [];
  const rootIdOf = (directory: string): string => {
    const covering = roots.find((root) =>
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

  // In the order they were dropped, which is the order they are queued in.
  // Each new file is one stat, and every root is decided before any of them
  // runs, so nothing here races anything else.
  const rows = await Promise.all(
    files.map(async (filePath) => {
      const id = trackIdForPath(filePath);
      if (store.track(id) !== undefined) {
        return { id, isKnown: true, row: undefined };
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
      return { id, isKnown: false, row };
    }),
  );
  const addedTracks = rows
    .map((entry) => entry.row)
    .filter((row): row is ILibraryTrack => row !== undefined);
  store.addRoots(addedRoots);
  // Unconfirmed: a scan confirms it, and until one does it is a file seen.
  store.upsertTracks(addedTracks, 0);
  return {
    trackIds: rows
      .filter((entry) => entry.isKnown || entry.row !== undefined)
      .map((entry) => entry.id),
    addedRootIds: addedRoots.map((root) => root.id),
  };
};
