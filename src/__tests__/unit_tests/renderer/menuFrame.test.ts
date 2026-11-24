/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Where a framed menu (the look picker's window) stands against its
 * trigger, and where a dragged edge comes to rest: under the trigger, over
 * it, or past it both ways - never with an edge across the control.
 */

import {
  bandOf,
  placeFrame,
  reachOf,
  restBottom,
  restTop,
} from 'renderer/widgets/menuFrame';

// A select from 500 to 528: a menu above it ends at 494, one below starts
// at 534. The room runs from 8 to 1192.
const band = bandOf({ top: 500, bottom: 528 });
const room = { top: 8, bottom: 1192 };
const limits = { min: 400, max: 1000 };

describe('placing a framed menu', () => {
  it('hangs it under its trigger at its own height while it fits there', () => {
    expect(placeFrame({ above: null, below: 600 }, band, room)).toEqual({
      top: 534,
      height: 600,
      side: 'down',
    });
  });

  it('stands it over its trigger when that is where it was put, though the room below would hold it', () => {
    expect(placeFrame({ above: 450, below: null }, band, room)).toEqual({
      top: 44,
      height: 450,
      side: 'up',
    });
  });

  it('crosses to the other side only when its own has less room than it needs and less than the other', () => {
    const low = bandOf({ top: 900, bottom: 928 });
    expect(placeFrame({ above: null, below: 600 }, low, room)).toEqual({
      top: 894 - 600,
      height: 600,
      side: 'up',
    });
    // The control: room enough below, and it stays below.
    expect(placeFrame({ above: null, below: 200 }, low, room).side).toBe(
      'down',
    );
  });

  it('reaches past its trigger both ways, each edge held inside the room', () => {
    expect(placeFrame({ above: 100, below: 300 }, band, room)).toEqual({
      top: 394,
      height: 834 - 394,
      side: 'over',
    });
    expect(placeFrame({ above: 900, below: 900 }, band, room)).toEqual({
      top: 8,
      height: 1192 - 8,
      side: 'over',
    });
  });
});

describe('a dragged top edge', () => {
  // The window hangs under the select, its bottom at 1134.
  const bottom = 1134;

  it('follows the pointer anywhere above the select', () => {
    expect(restTop(300, bottom, band, room, limits)).toBe(300);
  });

  it('goes past the select in one step at its middle, never stopping across it', () => {
    // Above the middle (514): over the select, at the line a menu above ends.
    expect(restTop(510, bottom, band, room, limits)).toBe(494);
    // Below it: hanging from under the select again.
    expect(restTop(520, bottom, band, room, limits)).toBe(534);
    // And below the select altogether, still hanging from it.
    expect(restTop(700, bottom, band, room, limits)).toBe(534);
  });

  it('crosses the select on a keyboard step, whichever half it lands in', () => {
    expect(restTop(534 - 24, bottom, band, room, limits, 'up')).toBe(494);
    expect(restTop(520, bottom, band, room, limits, 'up')).toBe(494);
    expect(restTop(494 + 24, bottom, band, room, limits, 'down')).toBe(534);
    expect(restTop(500, bottom, band, room, limits, 'down')).toBe(534);
  });

  it('stops at the room and at the largest size', () => {
    expect(restTop(-200, 900, band, room, limits)).toBe(8);
    expect(restTop(-200, bottom, band, room, limits)).toBe(bottom - 1000);
  });

  it('cannot go past the select while that would make the window too small', () => {
    // The window stands over the select with its bottom at 700: hanging at
    // 534 it would be 166 tall.
    expect(restTop(600, 700, band, room, limits)).toBe(300);
  });
});

describe('a dragged bottom edge', () => {
  it('rests on top of the select when the part above is big enough', () => {
    expect(restBottom(480, 44, band, room, limits)).toBe(494);
    expect(restBottom(510, 44, band, room, limits, 'up')).toBe(494);
  });

  it('stays under the select while the part above is smaller than the smallest window', () => {
    // From 134, a window ending at 494 would be 360 tall.
    expect(restBottom(480, 134, band, room, limits)).toBe(534);
  });

  it('follows the pointer below the select, to the room', () => {
    expect(restBottom(800, 534, band, room, limits)).toBe(934);
    expect(restBottom(1000, 534, band, room, limits)).toBe(1000);
    expect(restBottom(5000, 534, band, room, limits)).toBe(1192);
  });
});

describe('reading a window’s reach', () => {
  it('names the side each edge is on', () => {
    expect(reachOf(534, 1134, band)).toEqual({ above: null, below: 600 });
    expect(reachOf(44, 494, band)).toEqual({ above: 450, below: null });
    expect(reachOf(494, 1134, band)).toEqual({ above: 0, below: 600 });
  });
});
