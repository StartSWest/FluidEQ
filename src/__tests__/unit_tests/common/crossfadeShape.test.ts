/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  clampCrossfadeShape,
  crossfadeHandleBounds,
  CROSSFADE_SHAPE_HANDLES,
  CROSSFADE_TABLE_POINTS,
  crossfadeShapeGain,
  crossfadeShapesMatch,
  crossfadeShapeTable,
  defaultCrossfadeShape,
  ICrossfadePoint,
  ICrossfadeShape,
} from '../../../common/dsp/crossfadeShape';

const shapeFrom = (
  outgoing: readonly ICrossfadePoint[],
  incoming: readonly ICrossfadePoint[],
): ICrossfadeShape => ({ outgoing, incoming });

const evenly = (gains: readonly number[]): ICrossfadePoint[] =>
  gains.map((gain, index) => ({
    at: (index + 1) / (gains.length + 1),
    gain,
  }));

describe('crossfade shape', () => {
  /**
   * The endpoints are the reason a fade finishes.
   *
   * They are not stored and cannot be dragged, so no shape — however mangled
   * — may leave the outgoing deck audible at the end of the overlap or start
   * the incoming one already up.
   */
  it('pins both ends whatever the handles are doing', () => {
    const dragged = shapeFrom(evenly([1, 1, 1, 1]), evenly([1, 1, 1, 1]));
    expect(crossfadeShapeGain(dragged, 0, false)).toBeCloseTo(1, 6);
    expect(crossfadeShapeGain(dragged, 1, false)).toBeCloseTo(0, 6);
    expect(crossfadeShapeGain(dragged, 0, true)).toBeCloseTo(0, 6);
    expect(crossfadeShapeGain(dragged, 1, true)).toBeCloseTo(1, 6);
  });

  it('clamps progress past either end rather than continuing the curve', () => {
    const shape = defaultCrossfadeShape();
    expect(crossfadeShapeGain(shape, -0.5, false)).toBeCloseTo(1, 6);
    expect(crossfadeShapeGain(shape, 1.5, false)).toBeCloseTo(0, 6);
    expect(crossfadeShapeGain(shape, Number.NaN, true)).toBeCloseTo(0, 6);
  });

  /**
   * The default is equal power, so picking Custom and dragging nothing does
   * not change the sound.
   *
   * A measured bound rather than `toBeCloseTo`: four handles and a shape-
   * preserving spline cannot reproduce a sine, and the honest worst case is
   * 0.01 of linear gain — under 0.1 dB, inaudible, and worth pinning so that
   * a change to the handle count or the interpolation has to face the number.
   */
  it('starts on the curve it was reached from, within a tenth of a dB', () => {
    const shape = defaultCrossfadeShape();
    let worst = 0;
    for (let at = 0; at <= 200; at += 1) {
      const progress = at / 200;
      const rising = Math.sin((progress * Math.PI) / 2);
      const falling = Math.cos((progress * Math.PI) / 2);
      const sum = rising + falling;
      worst = Math.max(
        worst,
        Math.abs(crossfadeShapeGain(shape, progress, false) - falling / sum),
        Math.abs(crossfadeShapeGain(shape, progress, true) - rising / sum),
      );
    }
    expect(worst).toBeLessThan(0.01);
  });

  /**
   * A plain cubic spline dips below a handle it was told to pass through, and
   * a gain below zero inverts the signal for a few milliseconds. Fritsch-
   * Carlson cannot, and this is the case that used to prove it: a hard step
   * down followed by a flat run.
   */
  it('never overshoots a dragged handle', () => {
    const cliff = shapeFrom(
      evenly([1, 0.02, 0.02, 0.02]),
      evenly([0.02, 0.02, 0.02, 1]),
    );
    for (let at = 0; at <= 400; at += 1) {
      const progress = at / 400;
      const outgoing = crossfadeShapeGain(cliff, progress, false);
      const incoming = crossfadeShapeGain(cliff, progress, true);
      expect(outgoing).toBeGreaterThanOrEqual(0);
      expect(outgoing).toBeLessThanOrEqual(1);
      expect(incoming).toBeGreaterThanOrEqual(0);
      expect(incoming).toBeLessThanOrEqual(1);
    }
  });

  /**
   * The one the native port would otherwise have got wrong.
   *
   * The host receives nothing but the table, so a gain evaluated off the
   * spline on this side would disagree with the engine that is audible —
   * hardest exactly where the shape bends, which is where a user drags. Both
   * sides read the same 64 points, so the gain AT a table point must be that
   * point, to the bit.
   */
  it('reads the same table the host is sent', () => {
    const dragged = shapeFrom(
      evenly([0.95, 0.8, 0.15, 0.05]),
      evenly([0.05, 0.3, 0.85, 0.98]),
    );
    [false, true].forEach((incoming) => {
      const table = crossfadeShapeTable(dragged, incoming);
      expect(table).toHaveLength(CROSSFADE_TABLE_POINTS);
      table.forEach((value, index) => {
        const progress = index / (CROSSFADE_TABLE_POINTS - 1);
        expect(crossfadeShapeGain(dragged, progress, incoming)).toBe(value);
      });
    });
  });

  /**
   * The host narrows every point to a float. Sending a double it then rounds
   * would leave the two sides interpolating from different numbers and fail
   * the parity fixture with nothing wrong in the port.
   */
  it('sends points the host can hold exactly', () => {
    const table = crossfadeShapeTable(defaultCrossfadeShape(), true);
    table.forEach((value) => {
      expect(Math.fround(value)).toBe(value);
    });
  });
});

describe('crossfade shape, out of storage', () => {
  it('falls back whole rather than half a curve', () => {
    const shape = clampCrossfadeShape({ outgoing: 'nonsense' });
    expect(shape.outgoing).toEqual(defaultCrossfadeShape().outgoing);
    expect(shape.incoming).toEqual(defaultCrossfadeShape().incoming);
  });

  it('replaces a side that lost a handle', () => {
    const shape = clampCrossfadeShape({
      outgoing: [{ at: 0.5, gain: 0.5 }],
      incoming: defaultCrossfadeShape().incoming,
    });
    expect(shape.outgoing).toHaveLength(CROSSFADE_SHAPE_HANDLES);
  });

  /**
   * Two handles at one position divide by a zero-width segment inside the
   * interpolation, which is a NaN gain and silence on that deck. Spacing them
   * is what stops a hand-edited or older file from reaching that.
   */
  it('spaces handles that arrive stacked', () => {
    const shape = clampCrossfadeShape({
      outgoing: [
        { at: 0.5, gain: 0.9 },
        { at: 0.5, gain: 0.5 },
        { at: 0.5, gain: 0.3 },
        { at: 0.5, gain: 0.1 },
      ],
      incoming: defaultCrossfadeShape().incoming,
    });
    shape.outgoing.slice(1).forEach((point, index) => {
      expect(point.at).toBeGreaterThan(shape.outgoing[index].at);
    });
    shape.outgoing.forEach((point) => {
      expect(Number.isFinite(crossfadeShapeGain(shape, point.at, false))).toBe(
        true,
      );
    });
  });

  it('keeps every gain inside the plot', () => {
    const shape = clampCrossfadeShape({
      outgoing: evenly([9, -4, Number.NaN, 0.5]),
      incoming: evenly([-1, 2, 0.5, 40]),
    });
    [...shape.outgoing, ...shape.incoming].forEach((point) => {
      expect(point.gain).toBeGreaterThanOrEqual(0);
      expect(point.gain).toBeLessThanOrEqual(1);
    });
  });
});

describe('handle bounds', () => {
  it('keeps a dragged handle between its neighbours', () => {
    const points = defaultCrossfadeShape().outgoing;
    const middle = crossfadeHandleBounds(points, 1);
    expect(middle.min).toBeGreaterThan(points[0].at);
    expect(middle.max).toBeLessThan(points[2].at);
  });

  it('keeps the outer handles clear of the pinned ends', () => {
    const points = defaultCrossfadeShape().outgoing;
    expect(crossfadeHandleBounds(points, 0).min).toBeGreaterThan(0);
    expect(crossfadeHandleBounds(points, points.length - 1).max).toBeLessThan(
      1,
    );
  });
});

/**
 * What the saved-shape row asks to know which of its pills is the one in use.
 *
 * The two questions it has to get right pull in opposite directions: a shape
 * that has been to storage and back must still recognise itself, and two
 * shapes a user dragged apart must never be confused. Both are asserted here,
 * because a comparison that answers only one of them looks correct from the
 * side it answers.
 */
describe('shape matching', () => {
  const roundTrip = (shape: ICrossfadeShape): ICrossfadeShape =>
    clampCrossfadeShape(JSON.parse(JSON.stringify(shape)) as unknown);

  /** One handle pulled down, which is what a saved shape is. */
  const dipped = (gain: number): ICrossfadeShape => {
    const base = defaultCrossfadeShape();
    return {
      outgoing: base.outgoing.map((point, index) =>
        index === 1 ? { at: point.at, gain } : point,
      ),
      incoming: base.incoming,
    };
  };

  it('recognises a shape that has been through storage and back', () => {
    const shape = dipped(0.2);
    expect(crossfadeShapesMatch(roundTrip(shape), shape)).toBe(true);
  });

  /**
   * The positive control for the tolerance.
   *
   * A test that only proves round trips match would pass just as well against
   * a function that returned `true` for everything. The plot is 168 units
   * wide, so 0.006 of gain is roughly the smallest drag that can be made with
   * a mouse, and the two shapes below differ by exactly that.
   */
  it('does not confuse two shapes one pixel of drag apart', () => {
    expect(crossfadeShapesMatch(dipped(0.2), dipped(0.206))).toBe(false);
  });

  it('holds a difference far under a pixel to be the same shape', () => {
    expect(crossfadeShapesMatch(dipped(0.2), dipped(0.20001))).toBe(true);
  });

  /**
   * Both sides, not just the one that happens to be dragged first. A
   * comparison that read `outgoing` alone passes every case above.
   */
  it('compares the incoming side as well as the outgoing one', () => {
    const base = defaultCrossfadeShape();
    const movedIncoming: ICrossfadeShape = {
      outgoing: base.outgoing,
      incoming: base.incoming.map((point, index) =>
        index === 2 ? { at: point.at, gain: 0.1 } : point,
      ),
    };
    expect(crossfadeShapesMatch(base, movedIncoming)).toBe(false);
  });

  it('does not call a dragged shape the default one', () => {
    expect(crossfadeShapesMatch(defaultCrossfadeShape(), dipped(0.2))).toBe(
      false,
    );
  });
});
