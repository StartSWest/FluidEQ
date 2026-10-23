/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A Share Audio lane's readings, one per bar, as wide as the lane.
 *
 * Fixed at 240, the left of a wide lane never filled: the sound stopped a
 * third of the way across Ivan's window.
 */

import {
  emptyLaneHistory,
  fitLaneHistory,
  laneReading,
  pushLaneReading,
} from 'renderer/remoteAudio/laneHistory';

const filled = (count: number) => {
  const history = emptyLaneHistory();
  for (let reading = 1; reading <= count; reading += 1) {
    pushLaneReading(history, reading);
  }
  return history;
};

describe('a lane history', () => {
  it('reads newest first, and nothing past what it holds', () => {
    const history = filled(3);
    expect([0, 1, 2, 3].map((age) => laneReading(history, age))).toEqual([
      3, 2, 1, 0,
    ]);
    expect(laneReading(history, 10_000)).toBe(0);
  });

  it('keeps the latest when the ring wraps', () => {
    const history = filled(250);
    const room = history.level.length;
    expect(laneReading(history, 0)).toBe(250);
    expect(laneReading(history, room - 1)).toBe(251 - room);
  });

  it('grows to a wide lane keeping every reading in order', () => {
    // Wrapped before it grows: the ring's order is what has to survive.
    const before = filled(300);
    const room = before.level.length;
    const grown = fitLaneHistory(before, 400);
    expect(grown.level.length).toBe(400);
    for (let age = 0; age < room; age += 1) {
      expect(laneReading(grown, age)).toBe(laneReading(before, age));
    }
    expect(laneReading(grown, room)).toBe(0);
    // And it goes on from the newest.
    pushLaneReading(grown, 301);
    expect([0, 1].map((age) => laneReading(grown, age))).toEqual([301, 300]);
  });

  it('fills the whole of a wide lane once enough has arrived', () => {
    const history = fitLaneHistory(emptyLaneHistory(), 480);
    for (let reading = 1; reading <= 480; reading += 1) {
      pushLaneReading(history, reading);
    }
    expect(laneReading(history, 479)).toBe(1);
  });

  it('never shrinks, so a lane made narrow and wide again has its past', () => {
    const wide = fitLaneHistory(filled(5), 400);
    expect(fitLaneHistory(wide, 100)).toBe(wide);
  });
});
