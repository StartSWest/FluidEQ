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
 * Phase two of `scanLibraryRoot`: parses every candidate
 * `libraryScanDiscovery.ts` collected, in the order they were found.
 * `IDiscoverState.seen` never changes here -- it is already a real total --
 * so `parsed / seen` grows monotonically and reaches exactly 100% on the
 * final candidate, with no clamp needed to keep it from moving backwards.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { ILibraryTrack } from '../../common/library/types';
import {
  isLibraryPlayable,
  libraryTitleFromFileName,
} from '../../common/library/files';
import { findFolderArt, readLibraryTags } from './libraryMetadata';
import { storeArtwork } from './libraryArtwork';
import {
  ICandidateFile,
  IDiscoverState,
  IWalkContext,
  reportProgress,
} from './libraryScanDiscovery';

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

export interface IParseState {
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
  let stats: fs.Stats;
  try {
    stats = await fs.promises.stat(candidate.filePath);
  } catch (error) {
    // Discovery and parsing are two separate passes over the tree (see the
    // module comment), and anything can happen to a file in between: a
    // download folder tidying itself, a share dropping, a permissions
    // change. Every other read in the scan chain already tolerates this --
    // `readdir`, the karaoke sibling read, `readLibraryTags`, `storeArtwork`
    // -- this was the one unguarded await left, and letting it reject would
    // abort `scanLibraryRoot` for every other file the root still has.
    // `state.parsed` still advances so `parsed / seen` keeps climbing toward
    // 100% on the last candidate exactly as the module comment promises --
    // one vanished file must not also stall the progress bar.
    // eslint-disable-next-line no-console -- this project's one sanctioned console sink; see libraryIndex.ts
    console.error(`Could not stat ${candidate.filePath}`, error);
    state.parsed += 1;
    return;
  }
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
 * Parses every candidate discovery collected, in the order they were found.
 *
 * Returns whether a cancellation was seen partway through.
 */
export const parseCandidates = async (
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
