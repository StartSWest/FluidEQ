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
 * One question to the Library's store, kept answered as the library changes.
 *
 * The rail's counts, the status line's totals and each open branch of the
 * folder tree all ask something small that a scan changes every batch. A scan
 * republishes the store dozens of times a minute, so each of them asks at
 * most once at a time: a change that lands while an answer is out is caught
 * when it comes back (`version` older than the store's) and asked again once,
 * the way `useLibraryList` keeps its pages. Never one ask per change.
 */

import { useEffect, useRef, useState } from 'react';
import type {
  ILibraryAnswers,
  TLibraryRequest,
} from '../../common/library/query';
import { useLibrary } from './LibraryContext';

interface IHeld<T> {
  key: string;
  value: T;
}

/**
 * The answer to `request`, or nothing until the first one arrives (and
 * nothing at all while `request` is absent). A different question drops the
 * old answer at once rather than showing it under the new one's name.
 */
export const useLibraryAnswer = <R extends TLibraryRequest>(
  request: R | undefined,
): ILibraryAnswers[R['type']] | undefined => {
  const { summary } = useLibrary();
  const { version } = summary;
  const key = request === undefined ? '' : JSON.stringify(request);
  const [held, setHeld] = useState<
    IHeld<ILibraryAnswers[R['type']]> | undefined
  >(undefined);
  /**
   * The ask in flight: which question, the store version it was asked at,
   * and whether the store moved while it was out. One object per ask, so an
   * answer can tell whether it is still the one being waited for.
   */
  const inflightRef = useRef<
    { key: string; version: number; isStale: boolean } | undefined
  >(undefined);
  const requestRef = useRef(request);
  requestRef.current = request;
  const keyRef = useRef(key);
  keyRef.current = key;
  const versionRef = useRef(version);
  versionRef.current = version;
  const isMountedRef = useRef(false);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Asks the question on screen now, or — when that very question is already
   * out — marks it to be asked again once its answer is back. Read through a
   * ref so an answer always re-asks the CURRENT question, whichever render
   * started it.
   */
  const askRef = useRef<() => void>(() => undefined);
  askRef.current = () => {
    const asked = requestRef.current;
    const askedKey = keyRef.current;
    if (asked === undefined) {
      return;
    }
    const inflight = inflightRef.current;
    if (inflight !== undefined && inflight.key === askedKey) {
      inflight.isStale = true;
      return;
    }
    const marker = {
      key: askedKey,
      version: versionRef.current,
      isStale: false,
    };
    inflightRef.current = marker;
    window.electron.ipcRenderer
      .queryLibrary(asked)
      .then((answer) => {
        if (inflightRef.current === marker) {
          inflightRef.current = undefined;
        }
        // An answer to a question the window has stopped asking is dropped.
        if (!isMountedRef.current || marker.key !== keyRef.current) {
          return undefined;
        }
        setHeld({ key: marker.key, value: answer });
        if (marker.isStale || marker.version < versionRef.current) {
          askRef.current();
        }
        return undefined;
      })
      .catch((error: unknown) => {
        if (inflightRef.current === marker) {
          inflightRef.current = undefined;
        }
        // eslint-disable-next-line no-console -- context-rich error before it is dropped; the last answer stays on screen
        console.error('Could not ask the library', asked, error);
      });
  };

  useEffect(() => {
    askRef.current();
  }, [key, version]);

  return held !== undefined && held.key === key ? held.value : undefined;
};

/** Every album, artist and genre, as their shelves list them unnarrowed. */
const COUNT_QUERIES = {
  album: {
    type: 'page',
    query: { shelf: 'albums', scope: {}, direction: 'asc' },
    offset: 0,
    limit: 0,
  },
  artist: {
    type: 'page',
    query: { shelf: 'artists', scope: {}, direction: 'asc' },
    offset: 0,
    limit: 0,
  },
  genre: {
    type: 'page',
    query: { shelf: 'genres', scope: {}, direction: 'asc' },
    offset: 0,
    limit: 0,
  },
} as const satisfies Record<string, TLibraryRequest>;

export interface ILibraryShelfCounts {
  album?: number;
  artist?: number;
  genre?: number;
  song: number;
  video: number;
}

/**
 * How many of each thing the library holds, for the rail beside each shelf
 * and the status line's totals. Songs and videos come with the summary the
 * window always holds; the three groupings are each a page of nothing, whose
 * `total` is the count.
 */
export const useShelfCounts = (): ILibraryShelfCounts => {
  const { summary } = useLibrary();
  const isEmpty = summary.trackCount === 0;
  const albums = useLibraryAnswer(isEmpty ? undefined : COUNT_QUERIES.album);
  const artists = useLibraryAnswer(isEmpty ? undefined : COUNT_QUERIES.artist);
  const genres = useLibraryAnswer(isEmpty ? undefined : COUNT_QUERIES.genre);
  return {
    album: isEmpty ? 0 : albums?.total,
    artist: isEmpty ? 0 : artists?.total,
    genre: isEmpty ? 0 : genres?.total,
    song: Math.max(0, summary.trackCount - summary.videoCount),
    video: summary.videoCount,
  };
};
