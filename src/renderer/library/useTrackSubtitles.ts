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

import { useCallback, useEffect, useState } from 'react';
import type { ILibrarySubtitlesAnswer } from '../../common/library/subtitles';
import type { ILibraryTrack } from '../../common/library/types';

/** Answers kept: a session's watching, a few languages each. */
const KEPT = 16;

/**
 * By video, file and pick, and only answers that found subtitles: a video
 * with none is asked again the next time, so a subtitle file put beside it
 * while the app runs is found then.
 */
const cache = new Map<string, ILibrarySubtitlesAnswer>();

const remember = (key: string, answer: ILibrarySubtitlesAnswer) => {
  cache.delete(key);
  cache.set(key, answer);
  if (cache.size > KEPT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) {
      cache.delete(oldest);
    }
  }
};

export type TTrackSubtitles = (
  { state: 'reading' } | { state: 'ready'; answer: ILibrarySubtitlesAnswer }
) & {
  /** Asks main again past the cache, because a subtitle file was just kept
   * beside the video. What is shown stays until the new answer lands. */
  reload: () => void;
};

/**
 * The video's subtitles as main reads them (`library-track-subtitles`), by
 * id: `wanted` names the file the viewer picked, `preferred` the languages
 * to open in when nothing is picked. While another language is being read,
 * the one before stays on screen rather than the tab going blank.
 */
export const useTrackSubtitles = (
  track: ILibraryTrack,
  wanted: string | undefined,
  preferred: readonly string[],
): TTrackSubtitles => {
  const trackId = track.id;
  const preferredKey = preferred.join(',');
  const key = `${trackId}|${track.sizeBytes}|${track.mtimeMs}|${
    wanted ?? ''
  }|${preferredKey}`;
  const [held, setHeld] = useState<
    { key: string; answer: ILibrarySubtitlesAnswer } | undefined
  >(undefined);
  const [asked, setAsked] = useState(0);

  const reload = useCallback(() => {
    [...cache.keys()]
      .filter((cached) => cached.startsWith(`${trackId}|`))
      .forEach((cached) => cache.delete(cached));
    setAsked((count) => count + 1);
  }, [trackId]);

  useEffect(() => {
    if (cache.has(key)) {
      return undefined;
    }
    let isCurrent = true;
    window.electron.ipcRenderer
      .libraryTrackSubtitles(
        trackId,
        wanted,
        preferredKey === '' ? [] : preferredKey.split(','),
      )
      .then((answer) => {
        const settled = answer ?? { files: [], looked: [] };
        if (settled.files.length > 0) {
          remember(key, settled);
        }
        if (isCurrent) {
          setHeld({ key, answer: settled });
        }
        return undefined;
      })
      .catch((error: unknown) => {
        // eslint-disable-next-line no-console -- context-rich error before it is dropped; the tab says nothing was found
        console.error(
          'Could not read the subtitles of a video',
          trackId,
          error,
        );
        if (isCurrent) {
          setHeld({ key, answer: { files: [], looked: [] } });
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [key, trackId, wanted, preferredKey, asked]);

  const answer =
    cache.get(key) ??
    // The tab is keyed by video, so anything held is this video's: the
    // language before, until the one picked has been read.
    held?.answer;
  return answer === undefined
    ? { state: 'reading', reload }
    : { state: 'ready', answer, reload };
};
