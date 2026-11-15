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

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { type ILyricsWord, reachedIndex } from '../../common/library/lyrics';

/**
 * How far past the clock's last reading a word may be lit. The player's
 * clock arrives a few times a second, and a word lasts about as long; past
 * this, a clock that has stopped reporting (a pause on its way) never runs
 * the words on by themselves.
 */
const MAX_AHEAD_MS = 1000;

/**
 * The last word of the active line reached, for Enhanced LRC's and SYLT's
 * word stamps. The clock's own reading decides it; while the song plays,
 * each painted frame carries the reading forward by the time since it
 * arrived, so a word lights when it is sung rather than at the next reading.
 * The frames run only while there are words to light and the song plays.
 */
export const useSungWord = (
  words: readonly ILyricsWord[] | undefined,
  positionMs: number,
  isPlaying: boolean,
): number => {
  const reading = useRef({ positionMs, at: 0 });
  useLayoutEffect(() => {
    reading.current = { positionMs, at: performance.now() };
  }, [positionMs]);
  const [ahead, setAhead] = useState<{ reading: number; index: number }>({
    reading: positionMs,
    index: -1,
  });

  useEffect(() => {
    if (words === undefined || !isPlaying) {
      return undefined;
    }
    let frame = 0;
    const paint = (now: number) => {
      const { positionMs: readingMs, at } = reading.current;
      const carried = Math.min(MAX_AHEAD_MS, Math.max(0, now - at));
      const index = reachedIndex(words, readingMs + carried);
      setAhead((held) =>
        held.reading === readingMs && held.index === index
          ? held
          : { reading: readingMs, index },
      );
      frame = requestAnimationFrame(paint);
    };
    frame = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frame);
  }, [words, isPlaying]);

  if (words === undefined) {
    return -1;
  }
  const fromClock = reachedIndex(words, positionMs);
  // A frame's estimate counts only for the reading it was carried from: a
  // seek backwards lands at once, never held up by where the frames got to.
  return isPlaying && ahead.reading === positionMs
    ? Math.max(fromClock, ahead.index)
    : fromClock;
};
