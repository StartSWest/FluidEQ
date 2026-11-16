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

/**
 * Questions on their way, by the same key: the Subtitles tab and the
 * captions over the picture ask for the same file at the same moment, and
 * main reads it once for both.
 */
const asking = new Map<string, Promise<ILibrarySubtitlesAnswer>>();

/** Every reader of a video's subtitles, told when a file was kept beside
 * it, so the captions over the picture learn of it with the tab. */
const changeListeners = new Set<(videoId: string) => void>();

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

const NOTHING: ILibrarySubtitlesAnswer = { files: [], looked: [] };

const ask = (
  key: string,
  videoId: string,
  wanted: string | undefined,
  preferred: readonly string[],
): Promise<ILibrarySubtitlesAnswer> => {
  const pending = asking.get(key);
  if (pending !== undefined) {
    return pending;
  }
  const question = window.electron.ipcRenderer
    .libraryTrackSubtitles(videoId, wanted, preferred)
    .then((answer) => {
      const settled = answer ?? NOTHING;
      if (settled.files.length > 0) {
        remember(key, settled);
      }
      return settled;
    })
    .finally(() => {
      asking.delete(key);
    });
  asking.set(key, question);
  return question;
};

export type TTrackSubtitles = (
  { state: 'reading' } | { state: 'ready'; answer: ILibrarySubtitlesAnswer }
) & {
  /** Asks main again past the cache, for every reader of this video,
   * because a subtitle file was just kept beside it. What is shown stays
   * until the new answer lands. */
  reload: () => void;
};

/**
 * The video's subtitles as main reads them (`library-track-subtitles`), by
 * id: `wanted` names the file the viewer picked, `preferred` the languages
 * to open in when nothing is picked. While another language is being read,
 * the one before stays rather than the captions going blank.
 */
export const useTrackSubtitles = (
  track: ILibraryTrack,
  wanted: string | undefined,
  preferred: readonly string[],
): TTrackSubtitles => {
  const videoId = track.id;
  const preferredKey = preferred.join(',');
  // A pick speaks for itself; the preference only decides while there is
  // none, so two readers with a pick ask one question whatever each prefers.
  const key = `${videoId}|${track.sizeBytes}|${track.mtimeMs}|${
    wanted === undefined ? `?${preferredKey}` : `=${wanted}`
  }`;
  const [held, setHeld] = useState<
    { videoId: string; answer: ILibrarySubtitlesAnswer } | undefined
  >(undefined);
  const [asked, setAsked] = useState(0);

  useEffect(() => {
    const listener = (changed: string) => {
      if (changed === videoId) {
        setAsked((count) => count + 1);
      }
    };
    changeListeners.add(listener);
    return () => {
      changeListeners.delete(listener);
    };
  }, [videoId]);

  const reload = useCallback(() => {
    [...cache.keys()]
      .filter((cached) => cached.startsWith(`${videoId}|`))
      .forEach((cached) => cache.delete(cached));
    [...asking.keys()]
      .filter((pending) => pending.startsWith(`${videoId}|`))
      .forEach((pending) => asking.delete(pending));
    changeListeners.forEach((listener) => listener(videoId));
  }, [videoId]);

  useEffect(() => {
    if (cache.has(key)) {
      return undefined;
    }
    let isCurrent = true;
    ask(
      key,
      videoId,
      wanted,
      preferredKey === '' ? [] : preferredKey.split(','),
    )
      .then((answer) => {
        if (isCurrent) {
          setHeld({ videoId, answer });
        }
        return undefined;
      })
      .catch((error: unknown) => {
        // eslint-disable-next-line no-console -- context-rich error before it is dropped; the tab says nothing was found
        console.error(
          'Could not read the subtitles of a video',
          videoId,
          error,
        );
        if (isCurrent) {
          setHeld({ videoId, answer: NOTHING });
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [key, videoId, wanted, preferredKey, asked]);

  const answer =
    cache.get(key) ??
    // The language before, until the one picked has been read - and only
    // this video's: the stage outlives a change of video.
    (held?.videoId === videoId ? held.answer : undefined);
  return answer === undefined
    ? { state: 'reading', reload }
    : { state: 'ready', answer, reload };
};
