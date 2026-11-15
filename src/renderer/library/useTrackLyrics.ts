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
import type { ILibraryLyricsAnswer } from '../../common/library/lyrics';
import type { ILibraryTrack } from '../../common/library/types';

/** Songs whose lyrics are kept: a session's listening, never the library. */
const KEPT = 32;

/**
 * By song and file, and only answers that found words: a song with none is
 * asked again the next time it plays, so a lyrics file put beside it while
 * the app runs is found then.
 */
const cache = new Map<string, ILibraryLyricsAnswer>();

const keyOf = (track: ILibraryTrack) =>
  `${track.id}|${track.sizeBytes}|${track.mtimeMs}`;

const remember = (key: string, answer: ILibraryLyricsAnswer) => {
  cache.delete(key);
  cache.set(key, answer);
  if (cache.size > KEPT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) {
      cache.delete(oldest);
    }
  }
};

export type TTrackLyrics =
  { state: 'reading' } | { state: 'ready'; answer: ILibraryLyricsAnswer };

/**
 * The song's lyrics as main reads them (`library-track-lyrics`), by id, for
 * the Lyrics tab: `reading` until the answer lands, then the answer — words,
 * or the places that were looked in. A song the library no longer knows
 * answers as one with nothing found.
 */
export const useTrackLyrics = (track: ILibraryTrack): TTrackLyrics => {
  const key = keyOf(track);
  const [held, setHeld] = useState<
    { key: string; answer: ILibraryLyricsAnswer } | undefined
  >(undefined);
  const trackId = track.id;

  useEffect(() => {
    if (cache.has(key)) {
      return undefined;
    }
    let isCurrent = true;
    window.electron.ipcRenderer
      .libraryTrackLyrics(trackId)
      .then((answer) => {
        const settled = answer ?? { looked: [] };
        if (settled.lyrics !== undefined) {
          remember(key, settled);
        }
        if (isCurrent) {
          setHeld({ key, answer: settled });
        }
        return undefined;
      })
      .catch((error: unknown) => {
        // eslint-disable-next-line no-console -- context-rich error before it is dropped; the tab says nothing was found
        console.error('Could not read the lyrics of a song', trackId, error);
        if (isCurrent) {
          setHeld({ key, answer: { looked: [] } });
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [key, trackId]);

  const answer =
    cache.get(key) ?? (held?.key === key ? held.answer : undefined);
  return answer === undefined
    ? { state: 'reading' }
    : { state: 'ready', answer };
};
