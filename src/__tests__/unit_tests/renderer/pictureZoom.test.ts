/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  MOST_ZOOM,
  ZOOM_STOPS,
  canZoom,
  clampView,
  fitScale,
  leastScale,
  nextStop,
  panView,
  placement,
  zoomView,
  type IPoint,
  type IZoomSpace,
  type IZoomView,
} from '../../../renderer/studio/pictureZoom';

/** A 1000 x 800 picture in a 500 x 400 box: fitted at exactly one half. */
const space: IZoomSpace = {
  size: { width: 1000, height: 800 },
  box: { width: 500, height: 400 },
  fit: 0.5,
};

/**
 * The picture pixel under `point` (from the middle of the box), counted from
 * the middle of the picture. What "stays under the pointer" means.
 */
const pictureUnder = (view: IZoomView, point: IPoint): IPoint => ({
  x: (point.x - view.x) / view.scale,
  y: (point.y - view.y) / view.scale,
});

/** Walks `nextStop` from `from` until it stops moving. */
const walk = (from: number, fit: number, direction: 1 | -1) => {
  const seen = [from];
  for (;;) {
    const next = nextStop(seen[seen.length - 1], fit, direction);
    if (next === seen[seen.length - 1]) {
      return seen;
    }
    seen.push(next);
  }
};

describe('fitScale and leastScale', () => {
  it('shows a large picture whole, limited by its tighter side', () => {
    expect(
      fitScale({ width: 2000, height: 1000 }, { width: 1000, height: 800 }, 1),
    ).toBe(0.5);
    expect(
      fitScale({ width: 1000, height: 2000 }, { width: 1000, height: 800 }, 1),
    ).toBe(0.4);
  });

  it('never enlarges a small picture past the limit it is given', () => {
    const small = { width: 100, height: 50 };
    const box = { width: 1000, height: 1000 };
    expect(fitScale(small, box, 1)).toBe(1);
    expect(fitScale(small, box, 2)).toBe(2);
    // Positive control: without the limit the same picture would fill ten
    // times its size, so the two answers above are the limit at work.
    expect(fitScale(small, box, Infinity)).toBe(10);
  });

  it('zooms out to the fitted scale, or to real size when that is smaller', () => {
    expect(leastScale(0.5)).toBe(0.5);
    expect(leastScale(2)).toBe(1);
  });
});

describe('nextStop and canZoom', () => {
  it('ends the stops at the most zoom there is', () => {
    expect(ZOOM_STOPS[ZOOM_STOPS.length - 1]).toBe(MOST_ZOOM);
  });

  it('walks in from a fitted scale between stops, and back out to it', () => {
    expect(walk(0.3, 0.3, 1)).toEqual([0.3, 0.5, 1, 2, 4, 8, 16]);
    // The stops below the fitted scale are never reached: the picture is
    // already shown whole there.
    expect(walk(16, 0.3, -1)).toEqual([16, 8, 4, 2, 1, 0.5, 0.3]);
  });

  it('counts a fitted scale within a hair of a stop as that stop', () => {
    expect(nextStop(0.502, 0.502, 1)).toBe(1);
    expect(nextStop(1, 0.502, -1)).toBe(0.502);
  });

  it('lets a small enlarged picture zoom out only to its real size', () => {
    expect(walk(2, 2, -1)).toEqual([2, 1]);
    expect(walk(1, 2, 1)).toEqual([1, 2, 4, 8, 16]);
  });

  it('says there is nowhere further to go at either end', () => {
    expect(canZoom(MOST_ZOOM, 0.3, 1)).toBe(false);
    expect(canZoom(MOST_ZOOM, 0.3, -1)).toBe(true);
    expect(canZoom(0.3, 0.3, -1)).toBe(false);
    expect(canZoom(0.3, 0.3, 1)).toBe(true);
    expect(canZoom(1, 2, -1)).toBe(false);
    expect(canZoom(2, 2, -1)).toBe(true);
  });
});

describe('zoomView', () => {
  it('keeps the part of a fitted picture under the pointer under it', () => {
    const point = { x: 100, y: 50 };
    const fitted = { scale: space.fit, x: 0, y: 0 };
    const zoomed = zoomView(undefined, 2, point, space);
    expect(zoomed).toEqual({ scale: 2, x: -300, y: -150 });
    expect(zoomed && pictureUnder(zoomed, point)).toEqual(
      pictureUnder(fitted, point),
    );
    // Positive control: scaling about the middle instead would have slid a
    // different part of the picture under the same pointer.
    const aboutMiddle = { scale: 2, x: 0, y: 0 };
    expect(pictureUnder(aboutMiddle, point)).not.toEqual(
      pictureUnder(fitted, point),
    );
  });

  it('keeps it there when a zoomed picture zooms again', () => {
    const from = { scale: 2, x: -300, y: -150 };
    const point = { x: -120, y: 80 };
    const closer = zoomView(from, 4, point, space);
    expect(closer?.scale).toBe(4);
    expect(closer && pictureUnder(closer, point)).toEqual(
      pictureUnder(from, point),
    );
  });

  it('goes no further than the most zoom, and no further out than fitted', () => {
    expect(zoomView(undefined, 100, { x: 0, y: 0 }, space)?.scale).toBe(
      MOST_ZOOM,
    );
    // Fitted is no view at all, so the fitted picture follows the box.
    const from = { scale: 2, x: -300, y: -150 };
    expect(zoomView(from, 0.01, { x: 0, y: 0 }, space)).toBeUndefined();
    expect(zoomView(from, space.fit, { x: 0, y: 0 }, space)).toBeUndefined();
  });

  it('does not let a zoom out leave the picture off its box', () => {
    // Panned to its top-left corner, then zoomed out about the box's
    // bottom-right one.
    const from = { scale: 4, x: 1750, y: 1400 };
    const point = { x: 250, y: 200 };
    // Positive control: holding the point fixed alone would pull the
    // picture's corner 375 px into the box and leave a gap beside it.
    const unclamped = {
      scale: 1,
      x: point.x - (point.x - from.x) / 4,
      y: point.y - (point.y - from.y) / 4,
    };
    expect(placement(1, unclamped, space).left).toBe(375);
    const out = zoomView(from, 1, point, space);
    expect(out).toEqual({ scale: 1, x: 250, y: 200 });
    const drawn = out && placement(out.scale, out, space);
    expect(drawn?.left).toBeLessThanOrEqual(0);
    expect(drawn?.top).toBeLessThanOrEqual(0);
    expect(drawn && drawn.left + drawn.width).toBeGreaterThanOrEqual(
      space.box.width,
    );
    expect(drawn && drawn.top + drawn.height).toBeGreaterThanOrEqual(
      space.box.height,
    );
  });
});

describe('clampView and panView', () => {
  const zoomed = { scale: 2, x: 0, y: 0 };

  it('pans a zoomed picture freely inside its bounds', () => {
    expect(panView(zoomed, 100, -50, space)).toEqual({
      scale: 2,
      x: 100,
      y: -50,
    });
  });

  it('stops each edge where it meets the edge of the box', () => {
    const farRight = panView(zoomed, 10000, 10000, space);
    expect(farRight).toEqual({ scale: 2, x: 750, y: 600 });
    expect(placement(2, farRight, space)).toMatchObject({ left: 0, top: 0 });

    const farLeft = panView(zoomed, -10000, -10000, space);
    const drawn = placement(2, farLeft, space);
    expect(drawn.left + drawn.width).toBe(space.box.width);
    expect(drawn.top + drawn.height).toBe(space.box.height);
  });

  it('keeps a picture smaller than the box in its middle', () => {
    const small = clampView({ scale: 0.25, x: 100, y: -50 }, space);
    expect(small.x).toBeCloseTo(0, 9);
    expect(small.y).toBeCloseTo(0, 9);
    expect(placement(0.25, small, space)).toEqual({
      width: 250,
      height: 200,
      left: 125,
      top: 100,
    });
  });

  it('pans along the side that overflows and centres the side that fits', () => {
    const strip: IZoomSpace = {
      size: { width: 1000, height: 100 },
      box: { width: 500, height: 400 },
      fit: 0.5,
    };
    const moved = panView({ scale: 1, x: 0, y: 0 }, -400, 80, strip);
    expect(moved.x).toBe(-250);
    expect(moved.y).toBeCloseTo(0, 9);
  });
});

describe('placement', () => {
  it('fills the box exactly at the fitted scale', () => {
    expect(placement(space.fit, { x: 0, y: 0 }, space)).toEqual({
      width: 500,
      height: 400,
      left: 0,
      top: 0,
    });
  });

  it('puts the top-left corner on whole pixels', () => {
    const odd: IZoomSpace = {
      size: { width: 333, height: 201 },
      box: { width: 500, height: 400 },
      fit: 1,
    };
    // 250 - 166.5 + 0.4 and 200 - 100.5 - 0.6, rounded.
    expect(placement(1, { x: 0.4, y: -0.6 }, odd)).toEqual({
      width: 333,
      height: 201,
      left: 84,
      top: 99,
    });
  });
});
