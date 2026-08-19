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

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  ILibraryScanProgress,
  ILibraryTrack,
} from '../../common/library/types';
import {
  isLibraryPlayable,
  isUltraStarText,
  karaokeLyricCandidates,
  libraryFileKind,
  libraryTitleFromFileName,
} from '../../common/library/files';
import { findFolderArt, readLibraryTags } from './libraryMetadata';
import { storeArtwork } from './libraryArtwork';

export interface IScanOptions {
  rootId: string;
  rootPath: string;
  userDataDir: string;
  known: readonly ILibraryTrack[];
  onProgress: (progress: ILibraryScanProgress) => void;
  isCancelled: () => boolean;
}

export interface IScanResult {
  tracks: ILibraryTrack[];
  karaokeSkipped: number;
  wasCancelled: boolean;
}

// Neither dotfiles nor caches of a dependency tree hold anything a music
// library should show, and both are common enough (`.git`, `.DS_Store`,
// a stray `node_modules` under a project folder someone pointed the scanner
// at) to be worth skipping by name rather than reading into.
const SKIPPED_DIRECTORY_NAMES = new Set(['node_modules']);

/** Sha1 of the lowercased absolute path, truncated to 16 hex characters. */
export const trackIdForPath = (filePath: string): string =>
  crypto
    .createHash('sha1')
    .update(filePath.toLowerCase())
    .digest('hex')
    .slice(0, 16);

/**
 * The whole of the incremental rescan: a file is re-read only when its size
 * or modified time moved, or it has no known track at all. Getting this
 * wrong toward re-parsing too much makes a rescan of an unchanged folder as
 * slow as the first scan; getting it wrong toward too little leaves an
 * edited file showing stale tags forever.
 */
export const shouldReparse = (
  existing: ILibraryTrack | undefined,
  stat: { size: number; mtimeMs: number },
): boolean =>
  existing === undefined ||
  existing.sizeBytes !== stat.size ||
  existing.mtimeMs !== stat.mtimeMs;

interface IWalkContext {
  rootId: string;
  userDataDir: string;
  knownByPath: Map<string, ILibraryTrack>;
  onProgress: (progress: ILibraryScanProgress) => void;
  isCancelled: () => boolean;
}

interface IWalkState {
  tracks: ILibraryTrack[];
  karaokeSkipped: number;
  seen: number;
  parsed: number;
  cancelled: boolean;
}

interface IFolderArtCache {
  computed: boolean;
  id: string | undefined;
}

/** Everything about the directory a single file is being read out of. */
interface IDirectoryContext {
  rootId: string;
  userDataDir: string;
  dir: string;
  fileNames: readonly string[];
  folderArt: IFolderArtCache;
  // A folder of three hundred UltraStar songs must not read the same .txt
  // three hundred times; this holds one verdict per sibling name for the
  // lifetime of a single directory's processing.
  textCache: Map<string, boolean>;
}

const reportProgress = (
  context: IWalkContext,
  state: IWalkState,
  current: string,
): void => {
  context.onProgress({
    rootId: context.rootId,
    seen: state.seen,
    parsed: state.parsed,
    karaokeSkipped: state.karaokeSkipped,
    current,
    isDone: false,
  });
};

/**
 * True when `name` is a karaoke song and must not enter the library — it
 * belongs to the Karaoke tab instead. A `.lrc`/`.elrc` sibling is certain
 * proof; a `.txt` sibling is not (a tracklist is as common as a chart), so
 * that case alone is read and classified, once per distinct sibling name.
 */
const resolveKaraokeSkip = async (
  name: string,
  ctx: IDirectoryContext,
): Promise<boolean> => {
  const { certain, needsContentCheck } = karaokeLyricCandidates(
    name,
    ctx.fileNames,
  );
  if (certain.length > 0) {
    return true;
  }
  const candidate = needsContentCheck[0];
  if (candidate === undefined) {
    return false;
  }
  const cached = ctx.textCache.get(candidate);
  if (cached !== undefined) {
    return cached;
  }
  let isChart = false;
  try {
    const contents = await fs.promises.readFile(
      path.join(ctx.dir, candidate),
      'utf8',
    );
    isChart = isUltraStarText(contents);
  } catch (error) {
    // An unreadable sibling is not proof of anything about the song beside
    // it; keep the track rather than lose an album to a permissions error on
    // its tracklist file. The path is the one fact worth a bug report.
    // eslint-disable-next-line no-console -- this project's one sanctioned console sink; see libraryIndex.ts
    console.error(`Could not read ${candidate} beside ${name}`, error);
  }
  ctx.textCache.set(candidate, isChart);
  return isChart;
};

/**
 * Resolves the one cover image a directory contributes to every track in it,
 * reading and caching it at most once no matter how many tracks share it.
 */
const resolveFolderArt = async (
  ctx: IDirectoryContext,
): Promise<string | undefined> => {
  if (ctx.folderArt.computed) {
    return ctx.folderArt.id;
  }
  ctx.folderArt.computed = true;
  const artName = findFolderArt(ctx.fileNames);
  if (artName === undefined) {
    return undefined;
  }
  const artPath = path.join(ctx.dir, artName);
  try {
    const bytes = await fs.promises.readFile(artPath);
    ctx.folderArt.id = await storeArtwork(ctx.userDataDir, bytes);
  } catch (error) {
    // A folder image that will not read must not fail every track beside it
    // -- the tracks still play with the generated tile Task 4 falls back to.
    // eslint-disable-next-line no-console -- this project's one sanctioned console sink; see libraryIndex.ts
    console.error(`Could not read folder art ${artPath}`, error);
  }
  return ctx.folderArt.id;
};

const buildTrack = async (
  filePath: string,
  name: string,
  kind: 'audio' | 'video',
  addedAt: number,
  stat: { size: number; mtimeMs: number },
  ctx: IDirectoryContext,
): Promise<ILibraryTrack> => {
  const facts = await readLibraryTags(filePath);
  const artId = facts.picture
    ? await storeArtwork(ctx.userDataDir, facts.picture.data)
    : await resolveFolderArt(ctx);
  const title =
    facts.title !== undefined && facts.title.trim().length > 0
      ? facts.title
      : libraryTitleFromFileName(name);
  return {
    id: trackIdForPath(filePath),
    rootId: ctx.rootId,
    path: filePath,
    kind,
    isPlayable: isLibraryPlayable(name),
    title,
    artist: facts.artist,
    albumArtist: facts.albumArtist,
    album: facts.album,
    trackNo: facts.trackNo,
    discNo: facts.discNo,
    year: facts.year,
    genre: facts.genre,
    durationMs: facts.durationMs,
    bitrate: facts.bitrate,
    sampleRate: facts.sampleRate,
    channels: facts.channels,
    codec: facts.codec,
    artId,
    sizeBytes: stat.size,
    mtimeMs: stat.mtimeMs,
    addedAt,
    // Only a real thrown failure in readLibraryTags sets this -- never
    // guessed from an empty tag set, which a plain untagged file has too.
    hasMetadataError: facts.readFailed,
  };
};

/**
 * Resolves one already-identified media file: karaoke exclusion, then either
 * carrying a known track forward or reading it fresh, then a progress tick.
 */
const processFile = async (
  entry: fs.Dirent,
  kind: 'audio' | 'video',
  context: IWalkContext,
  dirCtx: IDirectoryContext,
  state: IWalkState,
): Promise<void> => {
  // `seen` is bumped for the whole directory in `processFiles`, before any of
  // its candidates reach here -- not per file the way `parsed` is below. See
  // that function for why: incrementing both counters in lockstep, one file
  // at a time, is what previously pinned every live progress event at 100%.
  const filePath = path.join(dirCtx.dir, entry.name);
  const isKaraoke = await resolveKaraokeSkip(entry.name, dirCtx);
  if (isKaraoke) {
    state.karaokeSkipped += 1;
  } else {
    const stats = await fs.promises.stat(filePath);
    const statInfo = { size: stats.size, mtimeMs: stats.mtimeMs };
    const existing = context.knownByPath.get(filePath);
    if (existing !== undefined && !shouldReparse(existing, statInfo)) {
      // Carrying the known track forward unchanged is what makes a rescan of
      // an unchanged folder cost one stat per file instead of a full tag read.
      state.tracks.push(existing);
    } else {
      const addedAt = existing?.addedAt ?? Date.now();
      const track = await buildTrack(
        filePath,
        entry.name,
        kind,
        addedAt,
        statInfo,
        dirCtx,
      );
      state.tracks.push(track);
    }
  }
  state.parsed += 1;
  reportProgress(context, state, entry.name);
};

interface IMediaCandidate {
  entry: fs.Dirent;
  kind: 'audio' | 'video';
}

/**
 * Walks the media-kind files of one directory, in place against `state`.
 * Non-media files never reach `processFile` at all; `walkDirectory` only
 * decides which files and folders reach this point.
 *
 * `seen` counts every candidate in this directory the moment it has been
 * listed and filtered -- before any of them is read -- while `parsed` only
 * grows one file at a time as each finishes below. That gap is what makes a
 * live progress event honest: with both counters moving together per file
 * (the previous shape), `seen` and `parsed` were always equal by the time
 * anyone outside this module saw them, and the determinate bar was pinned at
 * 100% for the length of every scan. A directory with more than one file now
 * reports `seen` ahead of `parsed` for every file but its last.
 */
const processFiles = async (
  fileEntries: readonly fs.Dirent[],
  context: IWalkContext,
  dirCtx: IDirectoryContext,
  state: IWalkState,
): Promise<void> => {
  const candidates: IMediaCandidate[] = [];
  fileEntries.forEach((entry) => {
    const kind = libraryFileKind(entry.name);
    if (kind) {
      candidates.push({ entry, kind });
    }
  });
  state.seen += candidates.length;

  for (let index = 0; index < candidates.length; index += 1) {
    const { entry, kind } = candidates[index];
    if (context.isCancelled()) {
      state.cancelled = true;
      return;
    }
    // eslint-disable-next-line no-await-in-loop -- one directory at a time by design; see the module comment.
    await processFile(entry, kind, context, dirCtx, state);
  }
};

/**
 * Walks one directory and recurses into its subdirectories.
 *
 * A directory symlink nested inside the walk is never followed: `fs.Dirent`'s
 * type reflects the entry itself, never the target it points at, so a
 * symlinked subdirectory already fails `isDirectory()` below without a
 * separate `lstat`. A root that is itself a symlink or a Windows junction is
 * unaffected -- `readdir` resolves the path it is given before listing, so
 * "this root is really on a second drive" scans exactly as a real directory
 * would. What this guards against is a folder cross-linked *into* the tree
 * partway down -- an album symlinked into two genre folders, say -- which
 * would otherwise recurse into a loop or, aimed far enough, walk the whole
 * of `C:\`; the index this feeds has no size ceiling of its own. Every other
 * skip in this module logs what it dropped, so this one does too.
 */
const walkDirectory = async (
  dir: string,
  context: IWalkContext,
  state: IWalkState,
): Promise<void> => {
  if (state.cancelled || context.isCancelled()) {
    // Polled here too, not just per media file below: a subtree with no
    // music between a Stop click and the next candidate file must still
    // notice it was asked to stop before walking the whole thing.
    state.cancelled = true;
    return;
  }
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch (error) {
    // A folder that vanished or denies access between listing and reading it
    // must not end a scan of everything else under the root.
    // eslint-disable-next-line no-console -- this project's one sanctioned console sink; see libraryIndex.ts
    console.error(`Could not read library folder ${dir}`, error);
    return;
  }

  const subdirectories: string[] = [];
  const fileEntries: fs.Dirent[] = [];
  entries.forEach((entry) => {
    if (entry.isSymbolicLink()) {
      // See the module comment above: never followed, and unlike a root
      // that happens to be a junction, this is a link found partway down a
      // walk -- worth a line, since it would otherwise vanish with no sign
      // anything was skipped at all.
      // eslint-disable-next-line no-console -- this project's one sanctioned console sink; see libraryIndex.ts
      console.error(`Skipped symlinked entry ${path.join(dir, entry.name)}`);
      return;
    }
    if (entry.isDirectory()) {
      if (
        entry.name.startsWith('.') ||
        SKIPPED_DIRECTORY_NAMES.has(entry.name)
      ) {
        return;
      }
      subdirectories.push(entry.name);
    } else if (entry.isFile()) {
      fileEntries.push(entry);
    }
  });

  const dirCtx: IDirectoryContext = {
    rootId: context.rootId,
    userDataDir: context.userDataDir,
    dir,
    fileNames: fileEntries.map((entry) => entry.name),
    folderArt: { computed: false, id: undefined },
    textCache: new Map<string, boolean>(),
  };

  await processFiles(fileEntries, context, dirCtx, state);

  for (let index = 0; index < subdirectories.length; index += 1) {
    if (state.cancelled) {
      return;
    }
    // eslint-disable-next-line no-await-in-loop -- one directory at a time by design; see the module comment.
    await walkDirectory(path.join(dir, subdirectories[index]), context, state);
  }
};

/**
 * Walks `rootPath`, returning every music and video file found beneath it
 * minus the karaoke songs that belong to the Karaoke tab instead.
 *
 * Cancellation keeps everything parsed so far: `wasCancelled: true` comes
 * back with a partial library, never a lost one.
 */
export const scanLibraryRoot = async (
  options: IScanOptions,
): Promise<IScanResult> => {
  const knownByPath = new Map<string, ILibraryTrack>();
  options.known.forEach((track) => knownByPath.set(track.path, track));

  const context: IWalkContext = {
    rootId: options.rootId,
    userDataDir: options.userDataDir,
    knownByPath,
    onProgress: options.onProgress,
    isCancelled: options.isCancelled,
  };
  const state: IWalkState = {
    tracks: [],
    karaokeSkipped: 0,
    seen: 0,
    parsed: 0,
    cancelled: false,
  };

  await walkDirectory(options.rootPath, context, state);

  options.onProgress({
    rootId: options.rootId,
    seen: state.seen,
    parsed: state.parsed,
    karaokeSkipped: state.karaokeSkipped,
    isDone: true,
  });

  return {
    tracks: state.tracks,
    karaokeSkipped: state.karaokeSkipped,
    wasCancelled: state.cancelled,
  };
};
