/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * How tall a band of a member's kept picture may be, against a scene that
 * lies about what it costs.
 *
 * The picture is drawn a band at a time so that no one job holds the GPU:
 * Windows resets the display for every program on the machine when one runs
 * about two seconds. The band count used to be worked out by timing the scene
 * on a 64x36 postage stamp and scaling up — and a shader is handed the size it
 * is drawing at, so `if (uResolution.x > 900.0)` put every measurement on a
 * cheap branch, the estimate came out at nothing, one band was asked for, and
 * the whole frame went to the driver in one piece. Nobody has to click
 * anything for this: a gallery draws these while somebody scrolls.
 *
 * So the rule may not trust any measurement the scene chose the size of, and
 * it may not trust the last band either, because cost can be made to depend on
 * the row. What it may do is start small, grow slowly, and never commit more
 * than a slice.
 */

import {
  BAND_GROWTH,
  BAND_MS,
  FIRST_BAND_SHARE,
  WIDEST_BAND_SHARE,
  firstBandRows,
  nextBandRows,
  walkBands,
} from '../../../renderer/graph/sceneStillBands';

/** The kept picture: 1280x720 supersampled by 1.5. */
const ROWS = 1080;
/** Measured on an integrated chip: the worst source the member rules accept. */
const WORST_FRAME_MS = 3740;
const worstMs = (rows: number) => (WORST_FRAME_MS * rows) / ROWS;
/** Windows resets the display for every program on the machine at about this. */
const DRIVER_RESET_MS = 2000;

describe('the bands a kept picture is drawn in', () => {
  it('starts on a slice small enough to survive being lied to', () => {
    const first = firstBandRows(ROWS);
    expect(first).toBe(Math.ceil(ROWS * FIRST_BAND_SHARE));
    // Even if every measurement before it said the scene was free.
    expect(worstMs(first)).toBeLessThanOrEqual(BAND_MS);
  });

  it('never commits more than a slice, however cheap the last band looked', () => {
    // The lie: a scene that costs nothing until the row it chooses.
    const afterFree = nextBandRows(ROWS, firstBandRows(ROWS), 0);
    expect(afterFree).toBeLessThanOrEqual(Math.ceil(ROWS * WIDEST_BAND_SHARE));
    expect(worstMs(afterFree)).toBeLessThan(DRIVER_RESET_MS);
  });

  it('grows by at most a few times what was just measured', () => {
    expect(nextBandRows(ROWS, 8, 0)).toBe(8 * BAND_GROWTH);
    expect(nextBandRows(ROWS, 1, 0)).toBe(BAND_GROWTH);
  });

  // The property, not the integer: the answer is floored, so a rate that
  // divides the quarter-second exactly comes back one row short of it rather
  // than one row over, which is the direction to be wrong in.
  it.each([
    [60, 1000],
    [34, 500],
    [120, 3740],
  ])(
    'shrinks a band of %s rows that took %s ms to fit the quarter second',
    (rows, ms) => {
      const next = nextBandRows(ROWS, rows, ms);
      expect((next * ms) / rows).toBeLessThanOrEqual(BAND_MS);
      expect(((next + 1) * ms) / rows).toBeGreaterThanOrEqual(BAND_MS);
    },
  );

  it('never asks for less than one row, whatever it was told', () => {
    expect(nextBandRows(ROWS, 34, 1e9)).toBe(1);
    expect(nextBandRows(ROWS, 0, 0)).toBeGreaterThanOrEqual(1);
    expect(firstBandRows(1)).toBe(1);
  });

  /**
   * Everything below drives `walkBands` — the walk the worker actually runs —
   * rather than a loop written out again here. Written out again is exactly
   * how the first version of this shipped broken: the real loop advanced by
   * the NEXT band's height instead of the one just drawn, so it jumped over a
   * band every time, and this file's own walk-through was the tidy version and
   * passed. A tenth of the height of every gallery card and every saved
   * picture was never drawn.
   */
  const walk = (msFor: (rows: number) => number) => {
    const drawn: { from: number; rows: number }[] = [];
    walkBands(ROWS, (from, rows) => {
      drawn.push({ from, rows });
      return drawn.length > 2000 ? undefined : msFor(rows);
    });
    return drawn;
  };

  /** Every row drawn exactly once, in order, with nothing skipped. */
  const covers = (drawn: { from: number; rows: number }[]) =>
    drawn.reduce((at, band) => (at === band.from ? at + band.rows : -1), 0);

  it('draws every row of the picture, and each of them once', () => {
    expect(covers(walk(() => 4))).toBe(ROWS);
    expect(covers(walk(worstMs))).toBe(ROWS);
    expect(covers(walk(() => 0))).toBe(ROWS);
    expect(covers(walk((rows) => rows * 40))).toBe(ROWS);
  });

  /**
   * The whole point, walked end to end: the worst source the rules accept,
   * pretending to be free until it is being drawn. No single band may come
   * near the two seconds that reset the driver, and the picture still
   * finishes.
   */
  it('draws the heaviest accepted scene without one job near a reset', () => {
    const drawn = walk(worstMs);
    expect(covers(drawn)).toBe(ROWS);
    expect(Math.max(...drawn.map((band) => worstMs(band.rows)))).toBeLessThan(
      DRIVER_RESET_MS / 2,
    );
    expect(drawn.length).toBeLessThan(40);
  });

  // The control. A limiter that split everything into single rows would pass
  // every case above and cost a thousand readbacks on every gallery card.
  it('lets an honest cheap scene finish in a handful of bands', () => {
    // A whole frame in four milliseconds, most of it the readback.
    expect(walk(() => 4).length).toBeLessThanOrEqual(10);
  });

  it('stops where it is when the context goes, rather than looping', () => {
    const drawn: number[] = [];
    walkBands(ROWS, (from) => {
      drawn.push(from);
      return drawn.length < 3 ? 4 : undefined;
    });
    expect(drawn).toHaveLength(3);
  });
});
