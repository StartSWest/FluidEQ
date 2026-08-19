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
  discoverDirectory,
  IDiscoverState,
  IWalkContext,
} from './libraryScanDiscovery';
import { IParseState, parseCandidates } from './libraryScanParse';

// Re-exported so nothing downstream has to know the scan is split across
// three files -- `shouldReparse` and `trackIdForPath` are actually defined
// in `libraryScanParse.ts`, next to the only code that uses them.
export { shouldReparse, trackIdForPath } from './libraryScanParse';

export interface IScanOptions {
  rootId: string;
  rootPath: string;
  userDataDir: string;
  known: readonly ILibraryTrack[];
  onProgress: (progress: ILibraryScanProgress) => void;
  /** Called during phase two with a batch of newly-resolved tracks -- both
   * freshly parsed ones and known ones carried forward unchanged -- so a
   * caller can publish partial results while the walk is still running. See
   * `parseCandidates` in libraryScanParse.ts for the batching rule. A batch
   * is never a duplicate of one already sent for this call: each candidate
   * contributes to at most one batch. */
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
 * behind it, is correctly absent either way: it is a new file the scan did
 * not get to, and the next scan will find it. Without this, `scanOneRoot` in
 * `src/main/ipc/library.ts` -- which replaces a root's tracks with this
 * result wholesale rather than merging it -- would read a cancelled rescan
 * as "these are the only tracks left" and delete everything this run had not
 * yet revisited, even files that had not changed at all.
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

  const parsedPaths = new Set(parseState.tracks.map((track) => track.path));
  const unconfirmedKnown = wasCancelled
    ? options.known.filter((track) => !parsedPaths.has(track.path))
    : [];
  const tracks = [...parseState.tracks, ...unconfirmedKnown];

  return {
    tracks,
    karaokeSkipped: discovered.karaokeSkipped,
    wasCancelled,
  };
};
