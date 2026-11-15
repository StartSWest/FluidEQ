/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import {
  playThresholdMs,
  stepHearing,
} from 'renderer/library/player/usePlayCounter';

/**
 * A play is a song HEARD for half its length or four minutes: walked here as
 * the published clock would tick it, four times a second.
 */
type THearing = Parameters<typeof stepHearing>[0];

const listen = (
  trackId: string,
  durationMs: number,
  fromMs: number,
  toMs: number,
  start?: THearing,
  isPlaying = true,
) => {
  let hearing = start;
  let plays = 0;
  for (let positionMs = fromMs; positionMs <= toMs; positionMs += 250) {
    const step = stepHearing(hearing, {
      trackId,
      positionMs,
      durationMs,
      isPlaying,
    });
    hearing = step.hearing;
    plays += step.isPlay ? 1 : 0;
  }
  return { hearing, plays };
};

describe('a play, as a listener counts it', () => {
  it('waits for half a song, or four minutes of a long one', () => {
    expect(playThresholdMs(200_000)).toBe(100_000);
    expect(playThresholdMs(3_600_000)).toBe(240_000);
    // A jingle or an interlude is never a play.
    expect(playThresholdMs(20_000)).toBeUndefined();
  });

  it('counts once a song has been heard past its middle, and once only', () => {
    expect(listen('a', 200_000, 0, 99_000).plays).toBe(0);
    expect(listen('a', 200_000, 0, 200_000).plays).toBe(1);
  });

  it('never counts a seek past the middle', () => {
    // Ten seconds heard, then a jump to the end: what was heard is ten.
    const before = listen('a', 200_000, 0, 10_000);
    expect(listen('a', 200_000, 190_000, 200_000, before.hearing).plays).toBe(
      0,
    );
  });

  it('never counts a skip, nor time on pause', () => {
    expect(listen('a', 200_000, 0, 30_000).plays).toBe(0);
    expect(listen('a', 200_000, 0, 200_000, undefined, false).plays).toBe(0);
  });

  it('counts a song heard again from the top as a second play', () => {
    const first = listen('a', 200_000, 0, 200_000);
    expect(first.plays).toBe(1);
    expect(listen('a', 200_000, 0, 200_000, first.hearing).plays).toBe(1);
  });

  it('does not count the next song on a tick that still carries the last one', () => {
    const first = listen('a', 200_000, 0, 150_000);
    // The new song arrives with the old song's position for one tick.
    const stale = stepHearing(first.hearing, {
      trackId: 'b',
      positionMs: 150_000,
      durationMs: 60_000,
      isPlaying: true,
    });
    expect(stale.isPlay).toBe(false);
    expect(stale.hearing.heardMs).toBe(0);
  });
});
