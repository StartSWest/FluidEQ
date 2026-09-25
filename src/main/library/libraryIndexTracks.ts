/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ILibraryTrack } from '../../common/library/types';

/**
 * How a scan's tracks are folded into the index main holds (`ipc/library.ts`).
 *
 * Every function here returns a new array and leaves the one it was given
 * alone, as everything that edits the index does: an array, once built, never
 * changes, and neither does a track (`serializeLibraryIndex` relies on that).
 */

/**
 * A scanned track, keeping a measurement that finished while an older scan
 * was still walking. Size and mtime make this safe: a changed file must be
 * analyzed again rather than inheriting the result cached for its previous
 * bytes.
 */
export const keepCurrentNormalization = (
  track: ILibraryTrack,
  current: ILibraryTrack | undefined,
): ILibraryTrack => {
  if (
    track.normalization ||
    !current?.normalization ||
    current.sizeBytes !== track.sizeBytes ||
    current.mtimeMs !== track.mtimeMs
  ) {
    return track;
  }
  return { ...track, normalization: current.normalization };
};

/**
 * Where each id sits in one array of tracks, kept with the array it describes.
 *
 * A scan's batches are merged one after another, each into the array the
 * last one produced, so the positions are carried from each array to the
 * next and a batch costs its own size. Every batch used to filter the whole
 * index and rebuild it — and build a map of all of it besides — which on a
 * first scan of fourteen thousand songs is five hundred and sixty passes over
 * the library on main. Anything else that edits the index makes a new array,
 * and the next merge starts over from that one.
 */
let positions:
  { tracks: readonly ILibraryTrack[]; at: Map<string, number> } | undefined;

const positionsIn = (tracks: readonly ILibraryTrack[]): Map<string, number> => {
  if (positions?.tracks !== tracks) {
    positions = {
      tracks,
      at: new Map(tracks.map((track, index) => [track.id, index])),
    };
  }
  return positions.at;
};

/**
 * `incoming` merged into `tracks` by id: a track already there is replaced
 * where it stands, a new one goes on the end. Never removes one; only the
 * replacement below, once a root's whole walk is in, is allowed to.
 *
 * Replaced where it stands, not moved to the end: the window merges a batch
 * the same way (`LibraryContext`), so both copies keep one order.
 */
export const upsertTracks = (
  tracks: readonly ILibraryTrack[],
  incoming: readonly ILibraryTrack[],
): { tracks: ILibraryTrack[]; merged: ILibraryTrack[] } => {
  const at = positionsIn(tracks);
  const next = tracks.slice();
  const merged = incoming.map((track) => {
    const index = at.get(track.id);
    const kept = keepCurrentNormalization(
      track,
      index === undefined ? undefined : next[index],
    );
    if (index === undefined) {
      at.set(track.id, next.length);
      next.push(kept);
    } else {
      next[index] = kept;
    }
    return kept;
  });
  positions = { tracks: next, at };
  return { tracks: next, merged };
};

/**
 * One root's tracks replaced by what its finished walk found — or undefined
 * when the walk found exactly what the index holds, in the same order.
 *
 * "Exactly" is the same objects, not equal ones. A walk hands a known track
 * back as the object it was given when its file has not changed
 * (`libraryScanParse.ts`, and `scanHost.ts` for the worker), so an unchanged
 * root costs one pass here and nothing after it: no write of the index, and
 * no copy of the whole library sent to the window.
 *
 * A root that did change keeps its place, where its first track stood. Every
 * root used to be moved to the end as it was walked, which a full rescan
 * turned back into the order of the roots; now that an unchanged root is not
 * touched at all, moving the changed one alone would reorder the library.
 */
export const replaceRootTracks = (
  tracks: readonly ILibraryTrack[],
  rootId: string,
  scanned: readonly ILibraryTrack[],
): ILibraryTrack[] | undefined => {
  const at = positionsIn(tracks);
  const merged = scanned.map((track) => {
    const index = at.get(track.id);
    return keepCurrentNormalization(
      track,
      index === undefined ? undefined : tracks[index],
    );
  });
  const current = tracks.filter((track) => track.rootId === rootId);
  if (
    current.length === merged.length &&
    merged.every((track, index) => track === current[index])
  ) {
    return undefined;
  }
  const first = tracks.findIndex((track) => track.rootId === rootId);
  if (first < 0) {
    return [...tracks, ...merged];
  }
  return [
    ...tracks.slice(0, first),
    ...merged,
    ...tracks.slice(first).filter((track) => track.rootId !== rootId),
  ];
};
