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
  ILibraryScanProgress,
  ILibraryTrack,
} from '../../common/library/types';
import {
  buildProvisionalTrack,
  discoverDirectory,
  IDiscoverState,
  IWalkContext,
} from './libraryScanDiscovery';
import {
  IParseOutcome,
  IParseState,
  parseCandidates,
} from './libraryScanParse';

// Re-exported so nothing downstream has to know the scan is split across
// three files -- `shouldReparse` is defined in `libraryScanParse.ts`, next to
// the only code that uses it; `trackIdForPath` is defined in
// `libraryScanDiscovery.ts` (see that file's own comment on why) and
// re-exported through `libraryScanParse.ts` in turn.
export { shouldReparse, trackIdForPath } from './libraryScanParse';

export interface IScanOptions {
  rootId: string;
  rootPath: string;
  userDataDir: string;
  known: readonly ILibraryTrack[];
  /** See `IWalkContext.storeArtwork`. Optional for pure discovery callers. */
  storeArtwork?: (bytes: Uint8Array) => Promise<string | undefined>;
  onProgress: (progress: ILibraryScanProgress) => void;
  /** Called by both phases with a batch of tracks, so a caller can publish
   * partial results while the walk is still running: phase one
   * (`discoverDirectory` in libraryScanDiscovery.ts) with provisional rows
   * for newly found files, `isPending: true`, flushed once per directory;
   * phase two (`parseCandidates` in libraryScanParse.ts) with the same ids
   * once resolved -- freshly parsed tracks and known ones carried forward
   * unchanged alike, `isPending` unset either way -- batched by size or time,
   * whichever comes first. A caller that upserts by id, as `scanOneRoot` in
   * `src/main/ipc/library.ts` does, sees a provisional row replaced in place
   * by its resolved self; nothing here sends the same id twice within one
   * phase. */
  onTracks?: (tracks: readonly ILibraryTrack[]) => void;
  isCancelled: () => boolean;
}

export interface IScanResult {
  tracks: ILibraryTrack[];
  karaokeSkipped: number;
  wasCancelled: boolean;
}

/**
 * Walks `rootPath`, returning every music and video file found beneath it
 * minus the karaoke songs that belong to the Karaoke tab instead.
 *
 * Two phases, not one interleaved pass: `discoverDirectory`
 * (`libraryScanDiscovery.ts`) walks and counts first, `parseCandidates`
 * (`libraryScanParse.ts`) reads tags and builds tracks second. See
 * `libraryScanDiscovery.ts`'s module comment for why -- a single interleaved
 * pass cannot report an honest percentage, because it never knows the total
 * until the walk is over.
 *
 * Cancellation keeps everything parsed so far: `wasCancelled: true` comes
 * back with a partial library, never a lost one. That promise has two
 * halves, and both are answered by the same rule below rather than as
 * separate special cases: a cancelled scan returns whatever it actually
 * parsed, plus every track `options.known` already had for a path this run
 * never confirmed. "Never confirmed" covers a directory tree discovery never
 * finished walking (nothing was parsed at all, so every known track
 * survives) exactly as it covers parsing stopping four files into a
 * six-file rescan (only the two not yet reached survive alongside the four
 * that were). Both are really the same question -- was this path revisited
 * this run -- so one rule answers it, rather than "empty result, fall back
 * to `known` wholesale" as a special case of something a general rule
 * already covers.
 *
 * A candidate discovery found but parsing never reached, with no known track
 * behind it, is a genuinely new file -- one this run itself proved exists,
 * even though it never got as far as reading its tags. It is not dropped:
 * carried into the result as the same provisional shape
 * `discoverDirectory`'s own per-directory publish already showed the
 * renderer live during the walk (see `buildProvisionalTrack` in
 * `libraryScanDiscovery.ts`), so a cancel never contradicts what was already
 * on screen a moment before Stop was pressed. Without either half of this --
 * the known tracks kept above, or the provisional ones kept here --
 * `scanOneRoot` in `src/main/ipc/library.ts`, which replaces a root's tracks
 * with this result wholesale rather than merging it, would read a cancelled
 * rescan as "these are the only tracks left" and delete everything this run
 * had not yet revisited or confirmed, even files that had not changed at all.
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
    storeArtwork: options.storeArtwork,
    onProgress: options.onProgress,
    onTracks: options.onTracks,
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
  // Discovery cancelling before parsing ever starts is the same "reached
  // nothing" outcome parseCandidates itself reports when it is asked to stop
  // before its own first iteration -- stated as a literal here rather than a
  // call, since parseCandidates cannot run at all once there is no walk left
  // to hand it.
  const parseOutcome: IParseOutcome = discovered.cancelled
    ? { wasCancelled: false, reachedCount: 0 }
    : await parseCandidates(context, discovered, parseState);
  const wasCancelled = discovered.cancelled || parseOutcome.wasCancelled;

  options.onProgress({
    rootId: options.rootId,
    seen: discovered.seen,
    parsed: parseState.parsed,
    karaokeSkipped: discovered.karaokeSkipped,
    isDone: true,
  });

  const parsedPaths = new Set(parseState.tracks.map((track) => track.path));
  const unconfirmedKnown = wasCancelled
    ? options.known.filter((track) => !parsedPaths.has(track.path))
    : [];

  // A cancel can also stop before parsing ever reached a file discovery had
  // already found and published nothing about before -- a genuinely new file,
  // not one of the previously-known paths `unconfirmedKnown` above already
  // carries forward. Dropping it here would lose the one fact this run
  // actually established: the file exists. Rebuilt straight from
  // `discovered.candidates` -- the same source `discoverDirectory`'s own
  // per-directory publish reads from -- rather than trusted to whatever
  // `onTracks` batches happened to reach the renderer, since a directory's
  // batch is only sent once that whole directory's listing finishes and a
  // cancel can land inside one. Filtered by `knownByPath` for the same reason
  // `discoverDirectory`'s own publish is: a path already known is already
  // covered by `unconfirmedKnown`, in full, and must not gain a second,
  // lesser entry beside it.
  const unreachedNewCandidates = wasCancelled
    ? discovered.candidates
        .slice(parseOutcome.reachedCount)
        .filter((candidate) => !knownByPath.has(candidate.filePath))
    : [];
  const provisionalCarriedForward = (
    await Promise.all(
      unreachedNewCandidates.map((candidate) =>
        buildProvisionalTrack(candidate, options.rootId),
      ),
    )
  ).filter((track): track is ILibraryTrack => track !== undefined);

  const tracks = [
    ...parseState.tracks,
    ...unconfirmedKnown,
    ...provisionalCarriedForward,
  ];

  return {
    tracks,
    karaokeSkipped: discovered.karaokeSkipped,
    wasCancelled,
  };
};
