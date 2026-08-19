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

const reportProgress = (
  context: IWalkContext,
  counts: { seen: number; parsed: number; karaokeSkipped: number },
  current: string,
): void => {
  context.onProgress({
    rootId: context.rootId,
    seen: counts.seen,
    parsed: counts.parsed,
    karaokeSkipped: counts.karaokeSkipped,
    current,
    isDone: false,
  });
};

/** What a karaoke check needs from the directory a candidate sits in. */
interface IKaraokeContext {
  dir: string;
  fileNames: readonly string[];
  // A folder of three hundred UltraStar songs must not read the same .txt
  // three hundred times; this holds one verdict per sibling name for the
  // lifetime of a single directory's discovery.
  textCache: Map<string, boolean>;
}

/**
 * True when `name` is a karaoke song and must not enter the library — it
 * belongs to the Karaoke tab instead. A `.lrc`/`.elrc` sibling is certain
 * proof; a `.txt` sibling is not (a tracklist is as common as a chart), so
 * that case alone is read and classified, once per distinct sibling name.
 */
const resolveKaraokeSkip = async (
  name: string,
  ctx: IKaraokeContext,
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
 * One media file discovery has decided is worth parsing, carried from phase
 * one into phase two. `dirFileNames` rides along so phase two's folder-art
 * lookup does not have to re-list a directory it has already listed once.
 */
interface ICandidateFile {
  filePath: string;
  name: string;
  kind: 'audio' | 'video';
  dir: string;
  dirFileNames: readonly string[];
}

interface IDiscoverState {
  candidates: ICandidateFile[];
  // A real total by the time discovery finishes -- not an estimate that
  // parsing can ever move past. This is what phase two's percentage is
  // computed against.
  seen: number;
  karaokeSkipped: number;
  cancelled: boolean;
}

interface IListedDirectory {
  subdirectories: string[];
  fileEntries: fs.Dirent[];
}

/**
 * Lists one directory, splitting its entries into subdirectories worth
 * recursing into and files worth examining. Shared by discovery only —
 * parsing never lists a directory itself, it works from what discovery
 * already found.
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
const listDirectory = async (
  dir: string,
): Promise<IListedDirectory | undefined> => {
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch (error) {
    // A folder that vanished or denies access between listing and reading it
    // must not end a scan of everything else under the root.
    // eslint-disable-next-line no-console -- this project's one sanctioned console sink; see libraryIndex.ts
    console.error(`Could not read library folder ${dir}`, error);
    return undefined;
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
  return { subdirectories, fileEntries };
};

/**
 * Phase one: walks the whole tree and decides which files are worth parsing,
 * without reading a single tag or a single piece of artwork -- just
 * directory listings, name filtering, and the karaoke `.txt` content check,
 * which needs directory context anyway and is one small text read per
 * distinct sibling name rather than per file. Cheap next to what phase two
 * does with each candidate.
 *
 * This is what makes phase two's progress honest: by the time it starts,
 * `state.seen` is `state.candidates.length` and will never move again, so
 * `parsed / seen` is a real fraction of a real total rather than a moving
 * target that can run backwards when a new directory turns up more files
 * than the one just finished.
 */
const discoverDirectory = async (
  dir: string,
  context: IWalkContext,
  state: IDiscoverState,
): Promise<void> => {
  if (state.cancelled || context.isCancelled()) {
    // A user who starts a scan of the wrong drive should not have to wait
    // for a full tree walk before Stop does anything -- checked per
    // directory here, same as the per-file check further down.
    state.cancelled = true;
    return;
  }
  const listed = await listDirectory(dir);
  if (!listed) {
    return;
  }
  const { subdirectories, fileEntries } = listed;
  const fileNames = fileEntries.map((entry) => entry.name);
  const karaokeCtx: IKaraokeContext = {
    dir,
    fileNames,
    textCache: new Map<string, boolean>(),
  };

  for (let index = 0; index < fileEntries.length; index += 1) {
    const entry = fileEntries[index];
    const kind = libraryFileKind(entry.name);
    if (kind) {
      if (context.isCancelled()) {
        state.cancelled = true;
        return;
      }
      // eslint-disable-next-line no-await-in-loop -- one file at a time by design; see the module comment.
      const isKaraoke = await resolveKaraokeSkip(entry.name, karaokeCtx);
      if (isKaraoke) {
        state.karaokeSkipped += 1;
      } else {
        state.candidates.push({
          filePath: path.join(dir, entry.name),
          name: entry.name,
          kind,
          dir,
          dirFileNames: fileNames,
        });
        state.seen += 1;
      }
      // `parsed` is always 0 here -- parsing has not started. The renderer
      // reads that as "still discovering" and shows an indeterminate bar
      // instead of a percentage computed against a total still climbing.
      reportProgress(
        context,
        { seen: state.seen, parsed: 0, karaokeSkipped: state.karaokeSkipped },
        path.basename(dir),
      );
    }
  }

  for (let index = 0; index < subdirectories.length; index += 1) {
    if (state.cancelled) {
      return;
    }
    // eslint-disable-next-line no-await-in-loop -- one directory at a time by design; see the module comment.
    await discoverDirectory(
      path.join(dir, subdirectories[index]),
      context,
      state,
    );
  }
};

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
}

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

interface IParseState {
  tracks: ILibraryTrack[];
  parsed: number;
}

/**
 * Resolves one already-discovered candidate: either carrying a known track
 * forward unchanged, or reading it fresh. No karaoke check here -- that
 * question was already answered in phase one, which is why this list never
 * contains a karaoke song to begin with.
 */
const parseCandidate = async (
  candidate: ICandidateFile,
  context: IWalkContext,
  folderArtByDir: Map<string, IFolderArtCache>,
  state: IParseState,
): Promise<void> => {
  let folderArt = folderArtByDir.get(candidate.dir);
  if (!folderArt) {
    folderArt = { computed: false, id: undefined };
    folderArtByDir.set(candidate.dir, folderArt);
  }
  const dirCtx: IDirectoryContext = {
    rootId: context.rootId,
    userDataDir: context.userDataDir,
    dir: candidate.dir,
    fileNames: candidate.dirFileNames,
    folderArt,
  };
  const stats = await fs.promises.stat(candidate.filePath);
  const statInfo = { size: stats.size, mtimeMs: stats.mtimeMs };
  const existing = context.knownByPath.get(candidate.filePath);
  if (existing !== undefined && !shouldReparse(existing, statInfo)) {
    // Carrying the known track forward unchanged is what makes a rescan of
    // an unchanged folder cost one stat per file instead of a full tag read.
    state.tracks.push(existing);
  } else {
    const addedAt = existing?.addedAt ?? Date.now();
    const track = await buildTrack(
      candidate.filePath,
      candidate.name,
      candidate.kind,
      addedAt,
      statInfo,
      dirCtx,
    );
    state.tracks.push(track);
  }
  state.parsed += 1;
};

/**
 * Phase two: parses every candidate phase one collected, in the order they
 * were found. `discovered.seen` never changes here -- it is already the real
 * total -- so `parsed / seen` grows monotonically and reaches exactly 100%
 * on the final candidate, with no clamp needed to keep it from moving
 * backwards.
 *
 * Returns whether a cancellation was seen partway through.
 */
const parseCandidates = async (
  context: IWalkContext,
  discovered: IDiscoverState,
  state: IParseState,
): Promise<boolean> => {
  const folderArtByDir = new Map<string, IFolderArtCache>();
  for (let index = 0; index < discovered.candidates.length; index += 1) {
    if (context.isCancelled()) {
      return true;
    }
    const candidate = discovered.candidates[index];
    // eslint-disable-next-line no-await-in-loop -- one file at a time by design; see the module comment.
    await parseCandidate(candidate, context, folderArtByDir, state);
    reportProgress(
      context,
      {
        seen: discovered.seen,
        parsed: state.parsed,
        karaokeSkipped: discovered.karaokeSkipped,
      },
      candidate.name,
    );
  }
  return false;
};

/**
 * Walks `rootPath`, returning every music and video file found beneath it
 * minus the karaoke songs that belong to the Karaoke tab instead.
 *
 * Two phases, not one interleaved pass: `discoverDirectory` walks and counts
 * first, `parseCandidates` reads tags and builds tracks second. See
 * `discoverDirectory`'s comment for why -- a single interleaved pass cannot
 * report an honest percentage, because it never knows the total until the
 * walk is over.
 *
 * Cancellation keeps everything parsed so far: `wasCancelled: true` comes
 * back with a partial library, never a lost one. A cancel that lands before
 * a single candidate has been parsed -- anywhere in discovery, or on the very
 * first candidate of parsing -- is the one case that rule cannot honour on
 * its own: nothing new has been confirmed yet, but `options.known` already
 * describes the library as of the last successful scan, and that is handed
 * back rather than an empty list. Without this, cancelling a rescan early
 * would fold back into `currentIndex` as "this root now has zero tracks" --
 * see `scanOneRoot` in `src/main/ipc/library.ts`, which replaces a root's
 * tracks with this result wholesale rather than merging it.
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

  const discovered: IDiscoverState = {
    candidates: [],
    seen: 0,
    karaokeSkipped: 0,
    cancelled: false,
  };
  await discoverDirectory(options.rootPath, context, discovered);

  const parseState: IParseState = { tracks: [], parsed: 0 };
  const cancelledDuringParse = discovered.cancelled
    ? false
    : await parseCandidates(context, discovered, parseState);
  const wasCancelled = discovered.cancelled || cancelledDuringParse;

  options.onProgress({
    rootId: options.rootId,
    seen: discovered.seen,
    parsed: parseState.parsed,
    karaokeSkipped: discovered.karaokeSkipped,
    isDone: true,
  });

  return {
    tracks:
      wasCancelled && parseState.tracks.length === 0
        ? [...options.known]
        : parseState.tracks,
    karaokeSkipped: discovered.karaokeSkipped,
    wasCancelled,
  };
};
