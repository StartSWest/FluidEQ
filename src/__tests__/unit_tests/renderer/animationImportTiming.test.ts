/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Frames that each say how long they are shown, played at the one speed a
 * scene's animation has: the speed the shortest frame needs, a long frame
 * on more than one cell, the speed brought down when the cells would not
 * fit, and a GIF's tiny delays read as browsers play them. Each rule beside
 * its control.
 */

import { importTiming } from '../../../renderer/studio/animations/import/importTiming';

const all = (count: number) => Array.from({ length: count }, (_, at) => at);

describe('an import’s timing', () => {
  it('plays frames of one length at their speed, a cell each', () => {
    expect(importTiming(all(4), [100, 100, 100, 100])).toEqual({
      fps: 10,
      cells: [0, 1, 2, 3],
    });
  });

  it('gives a frame shown twice as long two cells', () => {
    expect(importTiming(all(6), [80, 80, 80, 80, 160, 160])).toEqual({
      fps: 13,
      cells: [0, 1, 2, 3, 4, 4, 5, 5],
    });
  });

  it('plays a GIF delay under 20 ms as browsers do, 100 ms', () => {
    // 10 ms frames would race at 60 fps otherwise.
    expect(importTiming(all(2), [10, 0])).toEqual({ fps: 10, cells: [0, 1] });
  });

  it('control: a 20 ms frame is played as it says', () => {
    expect(importTiming(all(2), [20, 20])?.fps).toBe(50);
  });

  it('gives a frame without a timing the default, 12 a second', () => {
    expect(importTiming(all(3), [undefined, undefined, undefined])).toEqual({
      fps: 12,
      cells: [0, 1, 2],
    });
  });

  it('follows the playing order, repeats included', () => {
    expect(importTiming([2, 1, 0, 1], [100, 100, 100])?.cells).toEqual([
      2, 1, 0, 1,
    ]);
  });

  it('brings the speed down until the cells fit, keeping every frame', () => {
    // One 10 ms frame (100 ms as played) among 2 s holds: 10 fps would need
    // 2 + 20 * 20 cells.
    const timing = importTiming(
      all(21),
      [10, ...Array(20).fill(2000)],
      83,
      256,
    );
    expect(timing?.cells.length).toBeLessThanOrEqual(256);
    expect(new Set(timing?.cells)).toEqual(new Set(all(21)));
    expect(timing?.fps).toBeLessThan(10);
  });

  it('gives every frame one cell when even 1 fps is too many', () => {
    const timing = importTiming(all(10), Array(10).fill(60_000), 83, 12);
    expect(timing).toEqual({ fps: 1, cells: all(10) });
  });

  it('control: refuses no frames, and more frames than cells at one each', () => {
    expect(importTiming([], [])).toBeUndefined();
    expect(importTiming(all(13), Array(13).fill(100), 83, 12)).toBeUndefined();
  });
});
