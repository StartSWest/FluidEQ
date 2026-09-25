/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The songs these ids name, read from the store and kept current.
 *
 * What the player, the queue and Up Next know about songs, and all they know:
 * the ones they are holding, asked for by id (`tracks`), and asked for again
 * whenever the library changes — a loudness measured, a tag re-read, a root
 * removed. The window used to answer every one of these from its own copy of
 * the whole library.
 *
 * THREE ANSWERS, NOT TWO. A song is `ILibraryTrack` once read, `null` once
 * the store has said it has no such song, and absent until it has been asked.
 * The difference between the last two is the difference between "the song
 * was removed, stop playing it" and "not read yet, carry on": a launch reads
 * the queue's songs a moment after it restores the queue, and a player that
 * took a song it had not read yet for one that was gone stopped itself on
 * every start.
 *
 * The last answer stays until the next one lands, so a scan batch changes the
 * songs in place instead of dropping them for the length of a round trip.
 */

import { useEffect, useMemo, useState } from 'react';
import type { ILibraryTrack } from '../../common/library/types';
import { useLibrary } from './LibraryContext';

export type TLibraryTrackLookup = ReadonlyMap<string, ILibraryTrack | null>;

const NOTHING: TLibraryTrackLookup = new Map();

export const useLibraryTracks = (
  ids: readonly string[],
): TLibraryTrackLookup => {
  const { summary, isIndexLoaded } = useLibrary();
  const { version } = summary;
  // One ask per distinct set, whatever order or repeats the caller holds it
  // in: a queue that names a song twice is still asking for one song.
  const wanted = useMemo(() => Array.from(new Set(ids)).sort(), [ids]);
  const key = wanted.join('\n');
  const [known, setKnown] = useState<TLibraryTrackLookup>(NOTHING);

  useEffect(() => {
    // Before the store has answered anything at all, a song it cannot find
    // is one it has not been asked about yet.
    if (!isIndexLoaded || wanted.length === 0) {
      return undefined;
    }
    let isCurrent = true;
    window.electron.ipcRenderer
      .queryLibrary({ type: 'tracks', ids: wanted })
      .then((tracks) => {
        if (!isCurrent) {
          return undefined;
        }
        const found = new Map<string, ILibraryTrack | null>(
          wanted.map((id) => [id, null]),
        );
        tracks.forEach((track) => found.set(track.id, track));
        setKnown(found);
        return undefined;
      })
      .catch((error: unknown) => {
        // eslint-disable-next-line no-console -- context-rich error before it is dropped; the last answer stays
        console.error('Could not read songs from the library', error);
      });
    return () => {
      isCurrent = false;
    };
    // `wanted` is what `key` spells; the key is the dependency so an equal
    // set in a new array does not ask again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version, isIndexLoaded]);

  return known;
};
