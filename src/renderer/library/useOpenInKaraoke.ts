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
import { useLibraryPlayerSessionIfAny } from './player/LibraryPlayerContext';
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
  // None in a panel shown without a player: the song is sent from its start.
  const player = useLibraryPlayerSessionIfAny();
  // Read at the press, not when the hook last rendered: the clock moves on.
  const playerRef = useRef(player);
  playerRef.current = player;
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
        // THE SONG CARRIES ON IN THE MAKER (Ivan, 2026-11-15: "the same
        // song playing in the same position, like continuing from the
        // Library to the Karaoke, so it looks seamless"): where the Library
        // has it, read as the bytes arrive, and the Library paused in the
        // same breath so the two never play at once.
        const now = playerRef.current;
        const isThisSong = now !== undefined && now.track?.id === track.id;
        if (isThisSong && now.isPlaying) {
          now.toggle();
        }
        sendSongToKaraokeMaker({
          audio,
          ...(isThisSong
            ? {
                continueAt: {
                  positionMs: now.readPositionMs(),
                  isPlaying: now.isPlaying,
                },
              }
            : {}),
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
