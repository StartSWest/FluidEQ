/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Where a framed menu (the look picker's window) stands against its
 * trigger: wholly below it or wholly above it, never over it (Ivan,
 * 2026-11-23: "the select must always be the anchor and be seen"), on the
 * side the reader put it while that side has room, and flipped by its far
 * edge dragged back across the trigger.
 */

import {
  bandOf,
  dragFarEdge,
  type IMenuPlace,
  placeFrame,
  stepFarEdge,
} from 'renderer/widgets/menuFrame';

// A select from 500 to 528: a menu above it ends at 494, one below starts
// at 534. The room runs from 8 to 1192: 486 above, 658 below.
const SELECT = { top: 500, bottom: 528 };
const band = bandOf(SELECT);
const room = { top: 8, bottom: 1192 };
const limits = { min: 400, max: 1000 };

/** The window's top and bottom for a place, as `placeFrame` draws it. */
const edges = (place: IMenuPlace) => {
  const placed = placeFrame(place, band, room, limits.min);
  return { top: placed.top, bottom: placed.top + placed.height };
};

const coversSelect = ({ top, bottom }: { top: number; bottom: number }) =>
  top < SELECT.bottom && bottom > SELECT.top;

describe('placing a framed menu', () => {
  it('hangs it under its trigger at its own height while it fits there', () => {
    expect(placeFrame({ side: 'down', height: 600 }, band, room, 400)).toEqual({
      top: 534,
      height: 600,
      side: 'down',
    });
  });

  it('stands it over its trigger when that is where it was put, though the room below would hold it', () => {
    expect(placeFrame({ side: 'up', height: 450 }, band, room, 400)).toEqual({
      top: 44,
      height: 450,
      side: 'up',
    });
  });

  it('keeps the side it was put on while that side holds its smallest size, though the other side has more room', () => {
    // 458 below, 686 above.
    const low = bandOf({ top: 700, bottom: 728 });
    expect(placeFrame({ side: 'down', height: 600 }, low, room, 400)).toEqual({
      top: 734,
      height: 458,
      side: 'down',
    });
  });

  it('opens on the other side only when its own is too short for the smallest window', () => {
    // 258 below, 886 above.
    const lower = bandOf({ top: 900, bottom: 928 });
    expect(placeFrame({ side: 'down', height: 600 }, lower, room, 400)).toEqual(
      { top: 294, height: 600, side: 'up' },
    );
    // The control: a window asking for no more than the room it has stays.
    expect(
      placeFrame({ side: 'down', height: 200 }, lower, room, 400).side,
    ).toBe('down');
  });

  it('takes the larger side when neither holds the smallest window', () => {
    const short = { top: 8, bottom: 600 };
    // 286 above, 266 below.
    const middle = bandOf({ top: 300, bottom: 328 });
    expect(
      placeFrame({ side: 'down', height: 600 }, middle, short, 400),
    ).toEqual({ top: 8, height: 286, side: 'up' });
  });
});

describe('a dragged far edge', () => {
  it('follows the pointer on its own side, held to the smallest and largest sizes and the room', () => {
    expect(dragFarEdge(1000, 'down', band, room, limits)).toEqual({
      side: 'down',
      height: 466,
    });
    expect(dragFarEdge(800, 'down', band, room, limits)).toEqual({
      side: 'down',
      height: 400,
    });
    expect(dragFarEdge(5000, 'down', band, room, limits)).toEqual({
      side: 'down',
      height: 658,
    });
  });

  it('flips the window once the pointer is past the trigger’s middle, its far edge where the pointer is', () => {
    // Short of the middle (514): still below, at its smallest.
    expect(dragFarEdge(520, 'down', band, room, limits)).toEqual({
      side: 'down',
      height: 400,
    });
    // Past it: above, at its smallest until the pointer is further up.
    expect(dragFarEdge(510, 'down', band, room, limits)).toEqual({
      side: 'up',
      height: 400,
    });
    expect(dragFarEdge(50, 'down', band, room, limits)).toEqual({
      side: 'up',
      height: 444,
    });
    expect(dragFarEdge(-500, 'down', band, room, limits)).toEqual({
      side: 'up',
      height: 486,
    });
  });

  it('does not flip into a side too short for the window', () => {
    // 86 above the select.
    const high = bandOf({ top: 100, bottom: 128 });
    expect(dragFarEdge(20, 'down', high, room, limits)).toEqual({
      side: 'down',
      height: 400,
    });
    // The control: with room above, the same pointer flips it.
    expect(dragFarEdge(20, 'down', band, room, limits).side).toBe('up');
  });

  it('never puts the window over its trigger, wherever the pointer goes', () => {
    const pointers = Array.from({ length: 601 }, (_, index) => index * 3 - 300);
    const places = pointers.flatMap((wanted) =>
      (['down', 'up'] as const).map((from) => ({
        from,
        place: dragFarEdge(wanted, from, band, room, limits),
      })),
    );
    places.forEach(({ place }) =>
      expect(coversSelect(edges(place))).toBe(false),
    );
    const crossed = places.filter(({ from, place }) => place.side !== from);
    // A positive control: the sweep did take the window across, both ways.
    expect(crossed.length).toBeGreaterThan(100);
  });
});

describe('a keyboard step of the far edge', () => {
  it('grows the window away from its trigger and shrinks it towards it', () => {
    const below: IMenuPlace = { side: 'down', height: 600 };
    expect(stepFarEdge(below, 24, band, room, limits)).toEqual({
      side: 'down',
      height: 624,
    });
    expect(stepFarEdge(below, -24, band, room, limits)).toEqual({
      side: 'down',
      height: 576,
    });
  });

  it('flips the window from its smallest size, at that size, towards the trigger', () => {
    expect(
      stepFarEdge({ side: 'down', height: 400 }, -24, band, room, limits),
    ).toEqual({ side: 'up', height: 400 });
    expect(
      stepFarEdge({ side: 'up', height: 400 }, 24, band, room, limits),
    ).toEqual({ side: 'down', height: 400 });
  });

  it('does not flip into a side too short for the window', () => {
    const high = bandOf({ top: 100, bottom: 128 });
    expect(
      stepFarEdge({ side: 'down', height: 400 }, -24, high, room, limits),
    ).toEqual({ side: 'down', height: 400 });
  });
});
