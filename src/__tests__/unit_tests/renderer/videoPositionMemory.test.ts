/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  readVideoPosition,
  writeVideoPosition,
} from '../../../renderer/library/player/playbackMemory';

const KEY = 'fluideq.library.videoPositions';

/**
 * Where each video was left — per video, not per session.
 *
 * The session blob remembers one playhead for whatever was last playing, so a
 * film watched two days ago always restarted. This store is keyed by track,
 * and these are the four things it has to get right: it round-trips, it does
 * not remember the first few seconds, it forgets a video watched to the end,
 * and it does not grow forever.
 */
describe('video position memory', () => {
  beforeEach(() => window.localStorage.clear());

  it('remembers where each video was left, separately', () => {
    writeVideoPosition('film-a', 131_000);
    writeVideoPosition('film-b', 2_400_500.7);
    expect(readVideoPosition('film-a')).toBe(131_000);
    expect(readVideoPosition('film-b')).toBe(2_400_501);
    expect(readVideoPosition('film-c')).toBeUndefined();
  });

  it('treats the first seconds as not started, and a rewind as forgetting', () => {
    writeVideoPosition('film-a', 4_999);
    expect(readVideoPosition('film-a')).toBeUndefined();
    writeVideoPosition('film-a', 90_000);
    expect(readVideoPosition('film-a')).toBe(90_000);
    // A video watched through is written back at nought — see the stage —
    // and comes back to its own beginning next time.
    writeVideoPosition('film-a', 0);
    expect(readVideoPosition('film-a')).toBeUndefined();
  });

  it('keeps the most recently watched when the map is full', () => {
    for (let i = 0; i < 300; i += 1) {
      writeVideoPosition(`film-${i}`, 60_000 + i);
    }
    // Rewatching the oldest moves it to the end of the line, so the trim
    // that follows takes the next-oldest rather than it.
    writeVideoPosition('film-0', 70_000);
    writeVideoPosition('film-new', 80_000);
    expect(readVideoPosition('film-new')).toBe(80_000);
    expect(readVideoPosition('film-0')).toBe(70_000);
    expect(readVideoPosition('film-1')).toBeUndefined();
    expect(readVideoPosition('film-2')).toBe(60_002);
  });

  it('believes nothing that is not a positive number', () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ a: 'far', b: -5, c: Number.NaN, d: 0, e: 12_000 }),
    );
    expect(readVideoPosition('a')).toBeUndefined();
    expect(readVideoPosition('b')).toBeUndefined();
    expect(readVideoPosition('c')).toBeUndefined();
    expect(readVideoPosition('d')).toBeUndefined();
    expect(readVideoPosition('e')).toBe(12_000);
    window.localStorage.setItem(KEY, '[not json');
    expect(readVideoPosition('e')).toBeUndefined();
  });
});
