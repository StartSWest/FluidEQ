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

import { useEffect, useState } from 'react';
import type { ILibraryTrackFacts } from '../../common/library/trackFacts';
import type { ILibraryTrack } from '../../common/library/types';

/**
 * Songs whose facts are kept: a session's worth of Details panes, never the
 * library. The oldest goes when a new one comes.
 */
const KEPT = 64;

/** By song and file: a file changed on disk is read again. */
const cache = new Map<string, ILibraryTrackFacts>();

const keyOf = (track: ILibraryTrack) =>
  `${track.id}|${track.sizeBytes}|${track.mtimeMs}`;

const remember = (key: string, facts: ILibraryTrackFacts) => {
  cache.delete(key);
  cache.set(key, facts);
  if (cache.size > KEPT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) {
      cache.delete(oldest);
    }
  }
};

/**
 * The facts main reads from a song's file for the Details pane — asked once
 * per song and file, by id, and kept for the session (`KEPT`). Nothing while
 * they are read, and nothing for a song the library no longer knows.
 */
export const useTrackFacts = (
  track: ILibraryTrack | undefined,
): ILibraryTrackFacts | undefined => {
  const key = track === undefined ? undefined : keyOf(track);
  const [held, setHeld] = useState<
    { key: string; facts: ILibraryTrackFacts } | undefined
  >(undefined);
  const trackId = track?.id;

  useEffect(() => {
    if (key === undefined || trackId === undefined) {
      return undefined;
    }
    const cached = cache.get(key);
    if (cached !== undefined) {
      setHeld({ key, facts: cached });
      return undefined;
    }
    let isCurrent = true;
    window.electron.ipcRenderer
      .libraryTrackFacts(trackId)
      .then((facts) => {
        if (facts === undefined) {
          return undefined;
        }
        remember(key, facts);
        if (isCurrent) {
          setHeld({ key, facts });
        }
        return undefined;
      })
      .catch((error: unknown) => {
        // eslint-disable-next-line no-console -- context-rich error before it is dropped; the pane shows what the library already knows
        console.error('Could not read the facts of a song', trackId, error);
      });
    return () => {
      isCurrent = false;
    };
  }, [key, trackId]);

  if (key === undefined) {
    return undefined;
  }
  return held?.key === key ? held.facts : cache.get(key);
};
