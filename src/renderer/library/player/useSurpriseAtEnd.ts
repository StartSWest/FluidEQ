/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * WHEN NOTHING IS LEFT TO PLAY, SURPRISE ME PRESSES ITSELF (Ivan,
 * 2026-11-14: "when there is nothing next up to play and the song ends, it
 * hits the Surprise me button again, so it jumps into the next one").
 *
 * The same press, not a second path: `surprise` from `useSurprise` draws the
 * song, starts it, keeps the listener's picks behind it and moves the draw
 * over the shelf (which plays only while the shelf is on screen, so an
 * unattended one costs nothing hidden). Keep playing then carries on in the
 * new song's style, as after a press.
 *
 * Part of Keep playing, not a switch of its own. Keep playing is how a
 * listener says "keep the music going" (on by default) or "stop where my
 * list stops" (Ivan, 2026-10-25: "only when that option is on"), and an
 * automatic surprise with it off would overrule that. With it on, more of
 * the genre comes first; this is what follows when even that ran out — a
 * genre heard to the end, or a song whose genre had nothing more.
 *
 * Asked by `useTrackEnd` only when the last song ended with repeat off, so a
 * listener's pause or stop never reaches it: neither ends a song. Never after
 * a film. And a library with nothing it can play answers null, which stops
 * the player as it always stopped — one ask per song's end, never a loop.
 */
import { useCallback } from 'react';
import type { ILibraryTrack } from '../../../common/library/types';

/** Whether the end of this song is one Surprise me answers. */
export const surprisesAtEnd = (options: {
  isContinuationOn: boolean;
  endedKind: ILibraryTrack['kind'] | undefined;
}): boolean => options.isContinuationOn && options.endedKind === 'audio';

export const useSurpriseAtEnd = (options: {
  isContinuationOn: boolean;
  trackById: ReadonlyMap<string, ILibraryTrack>;
  surprise: () => Promise<string | null>;
  /** What the player does at the end of its list when nothing follows. */
  stop: () => void;
}): ((endedTrackId: string) => boolean) => {
  const { isContinuationOn, trackById, surprise, stop } = options;
  return useCallback(
    (endedTrackId: string) => {
      if (
        !surprisesAtEnd({
          isContinuationOn,
          endedKind: trackById.get(endedTrackId)?.kind,
        })
      ) {
        return false;
      }
      surprise()
        .then((picked) => {
          // Nothing in the library can be played: the end is the end.
          if (picked === null) {
            stop();
          }
          return undefined;
        })
        .catch((error: unknown) => {
          // eslint-disable-next-line no-console -- context-rich error before it is dropped; the player stops as it would have
          console.error('Surprise me could not follow the last song', error);
          stop();
        });
      return true;
    },
    [isContinuationOn, stop, surprise, trackById],
  );
};
