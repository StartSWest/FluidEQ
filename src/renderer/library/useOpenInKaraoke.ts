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
import type { ILibraryTrack } from '../../common/library/types';
import { sendSongToKaraokeMaker } from './karaokeHandoff';
import {
  canSendTrackToKaraoke,
  syncedLyricsAsKaraokeFile,
  trackAsKaraokeFile,
} from './libraryToKaraoke';

export type TOpenInKaraokeState = 'idle' | 'busy' | 'failed';

/**
 * "Open in Karaoke": the song and the words on show, handed to the Karaoke
 * tab's Maker (`karaokeHandoff.ts`) — timed words as the `.lrc` beside the
 * song, so the Maker starts from their sync; plain words for its lyric
 * editor to time. App switches to the tab when the request lands.
 *
 * `canOpen` is false for a song the Karaoke tab cannot play (video, or a
 * container it has no decoder for), where the action is not offered.
 */
export const useOpenInKaraoke = (
  track: ILibraryTrack,
  lyrics: ILibraryLyrics | undefined,
) => {
  const [state, setState] = useState<TOpenInKaraokeState>('idle');
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const open = useCallback(() => {
    if (lyrics === undefined) {
      return;
    }
    setState('busy');
    trackAsKaraokeFile(track)
      .then((audio) => {
        if (audio === undefined) {
          // Main declined the bytes: unreadable, or past the size cap.
          if (isMountedRef.current) {
            setState('failed');
          }
          return undefined;
        }
        sendSongToKaraokeMaker({
          audio,
          ...(lyrics.kind === 'synced'
            ? { lyrics: syncedLyricsAsKaraokeFile(track, lyrics.lines) }
            : { plainText: lyrics.text }),
          origin: {
            trackId: track.id,
            timedInTags: lyrics.kind === 'synced' && lyrics.source === 'tags',
          },
        });
        if (isMountedRef.current) {
          setState('idle');
        }
        return undefined;
      })
      .catch((error: unknown) => {
        // eslint-disable-next-line no-console -- context-rich error before it is dropped; the tab says the song could not be opened
        console.error('Could not open a song in Karaoke', track.id, error);
        if (isMountedRef.current) {
          setState('failed');
        }
      });
  }, [lyrics, track]);

  return {
    canOpen: lyrics !== undefined && canSendTrackToKaraoke(track),
    state,
    open,
  };
};
