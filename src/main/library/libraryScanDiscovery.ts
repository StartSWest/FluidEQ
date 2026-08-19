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

/**
 * Phase one of `scanLibraryRoot`: walks the whole tree and decides which
 * files are worth parsing, without reading a single tag or a single piece of
 * artwork -- just directory listings, name filtering, and the karaoke `.txt`
 * content check, which needs directory context anyway and is one small text
 * read per distinct sibling name rather than per file. Cheap next to what
 * `libraryScanParse.ts` does with each candidate. The one exception is
 * `buildProvisionalTrack`'s own `stat` call, made only for a file this walk
 * is about to publish as provisional -- still nowhere near a tag or an
 * artwork read.
 *
 * This is what makes phase two's progress honest: by the time `parseCandidates`
 * starts, `IDiscoverState.seen` is `candidates.length` and will never move
 * again, so `parsed / seen` is a real fraction of a real total rather than a
 * moving target. See `libraryScanner.ts` for how the two phases are joined.
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

/** Everything a directory walk shares between discovery and parsing. */
export interface IWalkContext {
  rootId: string;
  userDataDir: string;
  knownByPath: Map<string, ILibraryTrack>;
  onProgress: (progress: ILibraryScanProgress) => void;
  /** Called by both phases: discovery publishes provisional rows for newly
   * found files (see `discoverDirectory`'s own comment), and phase two
   * republishes the same ids once resolved (`parseCandidates`' batching in
   * `libraryScanParse.ts`). Undefined for a caller that only wants the final
   * result. */
  onTracks?: (tracks: readonly ILibraryTrack[]) => void;
  isCancelled: () => boolean;
}

export const reportProgress = (
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

// Neither dotfiles nor caches of a dependency tree hold anything a music
// library should show, and both are common enough (`.git`, `.DS_Store`,
// a stray `node_modules` under a project folder someone pointed the scanner
// at) to be worth skipping by name rather than reading into.
const SKIPPED_DIRECTORY_NAMES = new Set(['node_modules']);

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
export interface ICandidateFile {
  filePath: string;
  name: string;
  kind: 'audio' | 'video';
  dir: string;
  dirFileNames: readonly string[];
}

export interface IDiscoverState {
  candidates: ICandidateFile[];
  // A real total by the time discovery finishes -- not an estimate that
  // parsing can ever move past. This is what phase two's percentage is
  // computed against.
  seen: number;
  karaokeSkipped: number;
  cancelled: boolean;
}

/** Sha1 of the lowercased absolute path, truncated to 16 hex characters.
 * Lives here, not in `libraryScanParse.ts`, so both phases can use the same
 * id without either importing the other -- phase two already imports from
 * this file, and a track's identity is really a phase-one fact (it only ever
 * needs the path) rather than something parsing itself decides. */
export const trackIdForPath = (filePath: string): string =>
  crypto
    .createHash('sha1')
    .update(filePath.toLowerCase())
    .digest('hex')
    .slice(0, 16);

/**
 * A stand-in for a file discovery has found but parsing has not reached yet
 * -- real identity and filesystem facts, no tags, no duration, no `artId`;
 * see `ILibraryTrack.isPending`'s own doc for exactly what the flag promises.
 *
 * Stats the file itself, which is otherwise the one thing this module never
 * does -- the rest of phase one is directory listings, name filtering and the
 * karaoke text check, all cheaper than opening a media file's own bytes. A
 * stat is a single cheap syscall next to that, and `sizeBytes`/`mtimeMs` are
 * what a row needs to show at all before phase two ever reaches it.
 *
 * `album` is read from the file's immediate parent folder name -- the one
 * honest signal available before a single tag has been read, and how music
 * is actually organised on disk (see `discoverDirectory`'s own comment on
 * why this is expected to reshuffle once real tags arrive).
 *
 * Returns `undefined` if the file cannot be stat'd -- the same tolerance
 * `parseCandidate` in `libraryScanParse.ts` already has for a file that
 * vanishes between one pass over the tree and the next, so a file gone before
 * parsing even started never produces a phantom row.
 */
export const buildProvisionalTrack = async (
  candidate: ICandidateFile,
  rootId: string,
): Promise<ILibraryTrack | undefined> => {
  let stats: fs.Stats;
  try {
    stats = await fs.promises.stat(candidate.filePath);
  } catch (error) {
    // eslint-disable-next-line no-console -- this project's one sanctioned console sink; see libraryIndex.ts
    console.error(
      `Could not stat ${candidate.filePath} for a provisional row`,
      error,
    );
    return undefined;
  }
  return {
    id: trackIdForPath(candidate.filePath),
    rootId,
    path: candidate.filePath,
    kind: candidate.kind,
    isPlayable: isLibraryPlayable(candidate.name),
    title: libraryTitleFromFileName(candidate.name),
    album: path.basename(candidate.dir) || undefined,
    sizeBytes: stats.size,
    mtimeMs: stats.mtimeMs,
    addedAt: Date.now(),
    isPending: true,
  };
};

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
 * Walks one directory and recurses into its subdirectories, filling
 * `state.candidates` with every non-karaoke media file found beneath `dir`.
 */
export const discoverDirectory = async (
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
  const candidatesBeforeThisDirectory = state.candidates.length;

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

  // Phase one's own contribution to what the renderer shows before phase two
  // ever runs: every real file this directory just proved exists, published
  // once this directory's own listing is done rather than held back until
  // the whole tree has been walked. Flushed per directory rather than per
  // file (one IPC message per candidate, on top of phase two's own batches,
  // would flood the channel exactly as that module's own comment already
  // explains) and rather than once for the whole walk (which would mean
  // waiting for a multi-hour scan before anything provisional ever appears,
  // defeating the point of publishing early at all). A directory is also the
  // natural unit an album lives in on disk, so one flush reads as a whole
  // provisional album arriving at once instead of trickling in file by file.
  //
  // A candidate whose path is already known is left out on purpose: a
  // rescan's `known` list already holds whatever that path last resolved to
  // -- parsed, or still pending from a previous scan that never got back to
  // it -- and publishing a fresh provisional over an already-established
  // track would flip it back to dimmed on every ordinary rescan, which is
  // exactly the flicker this feature must not cause. `scanOneRoot`'s
  // incremental merge (`src/main/ipc/library.ts`) only ever replaces a track
  // that appears in an incoming batch, so a known track this batch never
  // mentions is simply left exactly as it already was.
  if (context.onTracks) {
    const newCandidates = state.candidates
      .slice(candidatesBeforeThisDirectory)
      .filter((candidate) => !context.knownByPath.has(candidate.filePath));
    if (newCandidates.length > 0) {
      const provisional = (
        await Promise.all(
          newCandidates.map((candidate) =>
            buildProvisionalTrack(candidate, context.rootId),
          ),
        )
      ).filter((track): track is ILibraryTrack => track !== undefined);
      if (provisional.length > 0) {
        context.onTracks(provisional);
      }
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
