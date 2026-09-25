/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { act } from '@testing-library/react';
import { setTransportSource } from 'renderer/audio/transportSource';

/**
 * A player playing for `ms`, reporting where it is once a second.
 *
 * The song memory's clock is those reports (`useSongEqClock`): a song only
 * settles, reaches its floor and counts down as a player says it is playing.
 * The fake clock moves between reports the way the real one would, and each
 * report is its own `act`, so the clock's effect runs on every one of them
 * rather than once on the last. Needs fake timers.
 */
const playFor = async (ms: number): Promise<void> => {
  for (let played = 0; played < ms; played += 1000) {
    const step = Math.min(1000, ms - played);
    // eslint-disable-next-line no-await-in-loop -- each report lands before the next, as a player's do
    await act(async () => {
      jest.advanceTimersByTime(step);
      setTransportSource({
        owner: 'library',
        title: 'Playing',
        isPlaying: true,
        positionMs: played + step,
        durationMs: ms,
        toggle: () => undefined,
      });
      await Promise.resolve();
    });
  }
  // Whatever the last report started — a lookup, a checkpoint — settles.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

export default playFor;
