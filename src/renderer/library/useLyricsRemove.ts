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

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ILibraryLyrics } from '../../common/library/lyrics';
import type { ILyricsRemoveTarget } from '../../common/library/lyricsImport';

/**
 * The lyrics file the words on show came from, where FluidEQ may remove it:
 * the song's own file beside it, or FluidEQ's copy. Nothing for words in the
 * song's tags, which name no file — they are inside the listener's audio
 * file, which FluidEQ never rewrites.
 */
export const removableLyrics = (
  lyrics: ILibraryLyrics,
): ILyricsRemoveTarget | undefined => {
  const extension = lyrics.source === 'lrc' ? '.lrc' : '.txt';
  if (lyrics.kept === true) {
    return { place: 'store', extension };
  }
  return lyrics.fileName === undefined
    ? undefined
    : { place: 'beside', extension };
};

export type TLyricsRemoveState =
  | { state: 'idle' }
  /** Asked what to remove; nothing removed until Remove is pressed. */
  | { state: 'asking'; target: ILyricsRemoveTarget }
  /** The words are in the song itself: said, and nothing offered. */
  | { state: 'inSong' }
  | { state: 'busy' }
  | { state: 'failed' };

export interface ILyricsRemove {
  status: TLyricsRemoveState;
  /** Asks first — or says why these words cannot be removed here. */
  ask: () => void;
  /** Removes the file asked about. */
  confirm: () => void;
  /** Leaves everything as it was. */
  dismiss: () => void;
}

/**
 * "Remove lyrics" for the words on show: asked in the tab, then removed by
 * main from the song's id and the place named (`library-lyrics-remove`),
 * and `onRemoved` reads the song's lyrics again so the tab shows what is left
 * — the next source down, or none.
 */
export const useLyricsRemove = (
  trackId: string,
  lyrics: ILibraryLyrics | undefined,
  onRemoved: () => void,
): ILyricsRemove => {
  const [status, setStatus] = useState<TLyricsRemoveState>({ state: 'idle' });
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const ask = useCallback(() => {
    if (lyrics === undefined) {
      return;
    }
    const target = removableLyrics(lyrics);
    setStatus(
      target === undefined ? { state: 'inSong' } : { state: 'asking', target },
    );
  }, [lyrics]);

  const confirm = useCallback(() => {
    if (status.state !== 'asking') {
      return;
    }
    setStatus({ state: 'busy' });
    window.electron.ipcRenderer
      .removeLibraryTrackLyrics(trackId, status.target)
      .then((result) => {
        if (!isMountedRef.current) {
          return undefined;
        }
        // Gone already is gone: what was asked for is true either way.
        if (result?.state === 'removed' || result?.state === 'missing') {
          setStatus({ state: 'idle' });
          onRemoved();
        } else {
          setStatus({ state: 'failed' });
        }
        return undefined;
      })
      .catch((error: unknown) => {
        // eslint-disable-next-line no-console -- context-rich error before it is dropped; the tab says the lyrics were not removed
        console.error('Could not remove the lyrics of a song', trackId, error);
        if (isMountedRef.current) {
          setStatus({ state: 'failed' });
        }
      });
  }, [onRemoved, status, trackId]);

  const dismiss = useCallback(() => setStatus({ state: 'idle' }), []);

  return { status, ask, confirm, dismiss };
};
