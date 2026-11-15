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
 * The Library's Plays column, counted the way a listener would count it.
 *
 * A play is a song HEARD for half its length or four minutes, whichever comes
 * first — the rule scrobblers settled on. Heard, not reached: the time is
 * added up from the published clock's own steps while the song plays, so a
 * seek past the middle adds nothing, and a song skipped after its intro never
 * gets there. Songs under thirty seconds are never counted (a jingle, an
 * interlude). Once per hearing: only a song started again from the top — a
 * restart, a repeat — can count again.
 *
 * Nothing here waits or polls; the count lands on the tick that crosses the
 * line, and is written through the store's own write path in main.
 */

import { useEffect, useRef } from 'react';

/** Shorter than this is never a play. */
const MIN_COUNTED_MS = 30_000;

/** Long songs count here, however much of them is left. */
const LONGEST_WAIT_MS = 240_000;

/**
 * The longest step between two ticks that is still listening. The clock
 * ticks several times a second; anything larger is a seek, a resume after
 * the window slept, or the song changing under a stale reading.
 */
const LONGEST_HEARD_STEP_MS = 1_500;

/** Back to within this of the top after a play: the song is heard again. */
const RESTART_MS = 2_000;

/** How much of a song of this length makes a play, or nothing for a short one. */
export const playThresholdMs = (durationMs: number): number | undefined =>
  Number.isFinite(durationMs) && durationMs >= MIN_COUNTED_MS
    ? Math.min(durationMs / 2, LONGEST_WAIT_MS)
    : undefined;

interface IHearing {
  trackId: string;
  /** Where the clock stood at the last tick. */
  lastMs: number;
  /** Listened time added up from steps a listener could have heard. */
  heardMs: number;
  isCounted: boolean;
}

/**
 * One more step of a hearing, and whether it just became a play. Exported so
 * the rule can be held by a test without a player around it.
 */
export const stepHearing = (
  hearing: IHearing | undefined,
  tick: {
    trackId: string;
    positionMs: number;
    durationMs: number;
    isPlaying: boolean;
  },
): { hearing: IHearing; isPlay: boolean } => {
  const fresh = (): IHearing => ({
    trackId: tick.trackId,
    lastMs: tick.positionMs,
    heardMs: 0,
    isCounted: false,
  });
  if (hearing === undefined || hearing.trackId !== tick.trackId) {
    return { hearing: fresh(), isPlay: false };
  }
  if (hearing.isCounted && tick.positionMs < RESTART_MS) {
    return { hearing: fresh(), isPlay: false };
  }
  const step = tick.positionMs - hearing.lastMs;
  const heard =
    tick.isPlaying && step > 0 && step <= LONGEST_HEARD_STEP_MS ? step : 0;
  const next = {
    ...hearing,
    lastMs: tick.positionMs,
    heardMs: hearing.heardMs + heard,
  };
  const threshold = playThresholdMs(tick.durationMs);
  if (next.isCounted || threshold === undefined || next.heardMs < threshold) {
    return { hearing: next, isPlay: false };
  }
  return { hearing: { ...next, isCounted: true }, isPlay: true };
};

const usePlayCounter = ({
  trackId,
  positionMs,
  durationMs,
  isPlaying,
}: {
  trackId: string | undefined;
  positionMs: number;
  durationMs: number;
  isPlaying: boolean;
}): void => {
  const hearingRef = useRef<IHearing | undefined>(undefined);

  useEffect(() => {
    if (trackId === undefined) {
      hearingRef.current = undefined;
      return;
    }
    const { hearing, isPlay } = stepHearing(hearingRef.current, {
      trackId,
      positionMs,
      durationMs,
      isPlaying,
    });
    hearingRef.current = hearing;
    if (!isPlay) {
      return;
    }
    window.electron?.ipcRenderer
      ?.noteLibraryTrackPlayed?.(trackId)
      .catch((error: unknown) => {
        // eslint-disable-next-line no-console -- context-rich error before it is dropped; one play goes uncounted
        console.error('Could not count a play', trackId, error);
      });
  }, [trackId, positionMs, durationMs, isPlaying]);
};

export default usePlayCounter;
