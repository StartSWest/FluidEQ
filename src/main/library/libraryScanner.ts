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
  /** See `IWalkContext.lookupKnown`: what the store holds for a path. */
  lookupKnown: (filePath: string) => ILibraryTrack | undefined;
  /** See `IWalkContext.force`. */
  force: boolean;
  /** See `IWalkContext.storeArtwork`. Optional for pure discovery callers. */
  storeArtwork?: (bytes: Uint8Array) => Promise<string | undefined>;
  onProgress: (progress: ILibraryScanProgress) => void;
  /** Called by both phases with a batch of tracks, so a caller can publish
   * partial results while the walk is still running: phase one
   * (`discoverDirectory` in libraryScanDiscovery.ts) with provisional rows
   * for newly found files, `isPending: true`, flushed once per directory,
   * `confirmed` false; phase two (`parseCandidates` in libraryScanParse.ts)
   * with the same ids once resolved, `confirmed` true, batched by size or
   * time, whichever comes first. A caller that upserts by id, as
   * `scanOneRoot` in `libraryScanRunner.ts` does, sees a provisional row
   * replaced in place by its resolved self. */
  onTracks?: (tracks: readonly ILibraryTrack[], confirmed: boolean) => void;
  /** Known files found unchanged, by id: confirmed, not sent again. */
  onUnchanged?: (trackIds: readonly string[]) => void;
  isCancelled: () => boolean;
  /**
   * Aborts with the scan's cancel, for a host that has to pass the cancel on
   * as it happens: the worker's host (`scanHost.ts`) tells its worker at once
   * rather than on the worker's next message, which only comes now and then.
   * The walk itself asks `isCancelled`.
   */
  signal?: AbortSignal;
}

export interface IScanResult {
  /** Files the walk read and found still there, changed or not. */
  found: number;
  karaokeSkipped: number;
  wasCancelled: boolean;
}

/**
 * Walks `rootPath`, publishing every music and video file found beneath it,
 * minus the karaoke songs that belong to the Karaoke tab instead.
 *
 * Two phases, not one interleaved pass: `discoverDirectory`
 * (`libraryScanDiscovery.ts`) walks and counts first, `parseCandidates`
 * (`libraryScanParse.ts`) reads tags and builds tracks second. See
 * `libraryScanDiscovery.ts`'s module comment for why -- a single interleaved
 * pass cannot report an honest percentage, because it never knows the total
 * until the walk is over.
 *
 * NOTHING IS RETURNED BUT COUNTS. Every track goes out as it is found or
 * read (`onTracks`, `onUnchanged`) into the store, and the caller decides
 * from `wasCancelled` whether the root's unconfirmed songs are gone (a
 * finished walk sweeps them, `libraryStore.sweepRoot`) or merely unreached (a
 * cancelled one keeps them). This used to return the root's whole track list
 * — for a library under one root, every song — for main to replace the root
 * with in one go.
 *
 * Cancellation keeps everything established so far, never loses it: what
 * was parsed is in the store, every known track this run did not revisit is
 * left as it was, and a genuinely new file discovery found but parsing never
 * reached is published once more as the provisional row discovery's own
 * per-directory publish would have shown — a directory's batch only goes out
 * once its whole listing finishes, and a cancel can land inside one. Without
 * it the one fact this run established, that the file exists, would be lost.
 */
export const scanLibraryRoot = async (
  options: IScanOptions,
): Promise<IScanResult> => {
  const context: IWalkContext = {
    rootId: options.rootId,
    userDataDir: options.userDataDir,
    lookupKnown: options.lookupKnown,
    force: options.force,
    storeArtwork: options.storeArtwork,
    onProgress: options.onProgress,
    onTracks: options.onTracks,
    onUnchanged: options.onUnchanged,
    isCancelled: options.isCancelled,
  };

  const discovered: IDiscoverState = {
    candidates: [],
    seen: 0,
    karaokeSkipped: 0,
    cancelled: false,
  };
  await discoverDirectory(options.rootPath, context, discovered);

  const parseState: IParseState = { parsed: 0, found: 0 };
  // Discovery cancelling before parsing ever starts is the same "reached
  // nothing" outcome parseCandidates itself reports when it is asked to stop
  // before its own first iteration.
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

  if (wasCancelled) {
    const unreachedNew = discovered.candidates
      .slice(parseOutcome.reachedCount)
      .filter(
        (candidate) => options.lookupKnown(candidate.filePath) === undefined,
      );
    const provisional = (
      await Promise.all(
        unreachedNew.map((candidate) =>
          buildProvisionalTrack(candidate, options.rootId),
        ),
      )
    ).filter((track): track is ILibraryTrack => track !== undefined);
    if (provisional.length > 0) {
      options.onTracks?.(provisional, false);
    }
  }

  return {
    found: parseState.found,
    karaokeSkipped: discovered.karaokeSkipped,
    wasCancelled,
  };
};
