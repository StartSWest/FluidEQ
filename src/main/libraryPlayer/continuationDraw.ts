/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * KEEP PLAYING WHEN THE LIST RUNS OUT.
 *
 * When the last song of the list plays, more of the same genre is drawn from
 * the whole library and appended under a heading of its own. The library does
 * the choosing (`continuation` in `libraryTrackQuestions.ts`); this owns
 * when to ask, and what never to hand back: everything the queue holds, and
 * everything played this session, or a genre of forty songs would start
 * repeating itself inside an hour.
 *
 * NOT A TIMER, and it must never become one: the condition is where the
 * playhead stands (`wantsContinuation`), which changes exactly when the queue
 * does. Each place in the queue asks once, so a library with nothing more to
 * give is not asked again on every press.
 */
import { CONTINUATION_BATCH } from '../../common/library/continuation';
import {
  type ILibraryPlayerState,
  wantsContinuation,
} from '../../common/library/playerState';
import type { ILibraryTrack } from '../../common/library/types';

export interface IContinuationDraw {
  /** A song was heard this session; it is not drawn again. */
  played: (trackId: string) => void;
  /** The songs to append now, or none to ask for. */
  draw: (
    state: ILibraryPlayerState,
    track: ILibraryTrack | undefined,
  ) => readonly string[];
}

export const createContinuationDraw = (
  continuation: (
    seedId: string,
    exclude: readonly string[],
    count: number,
  ) => string[],
): IContinuationDraw => {
  const playedIds = new Set<string>();
  let asked = '';
  return {
    played: (trackId) => {
      playedIds.add(trackId);
    },
    draw: (state, track) => {
      const { queue } = state;
      if (
        !queue ||
        !track ||
        track.kind !== 'audio' ||
        !wantsContinuation(state)
      ) {
        return [];
      }
      const key = [
        track.id,
        queue.position,
        queue.order.length,
        queue.trackIds.length,
      ].join('|');
      if (key === asked) {
        return [];
      }
      asked = key;
      return continuation(
        track.id,
        [...new Set([...queue.trackIds, ...playedIds])],
        CONTINUATION_BATCH,
      );
    },
  };
};
