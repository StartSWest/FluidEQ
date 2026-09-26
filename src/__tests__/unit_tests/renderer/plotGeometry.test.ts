/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

/**
 * The band row under the graph (layout A, Ivan 2026-09-25): each band in a
 * fixed place, the plot's width shared evenly between them (Ivan,
 * 2026-09-26: "don't move the slider if I move the freq in the graph … their
 * position doesn't change, they just interchange each other if they
 * overpass the prev or next one").
 *
 * The row is laid out from `placeBandsEvenly`'s slot and leads. These hold
 * the places to depend on how many bands there are and on nothing else, and
 * every band to stand whole inside what the page shows.
 */

import {
  MAX_BAND_SLOT,
  MIN_BAND_SLOT,
  placeBandsEvenly,
  type IBandPlacement,
} from '../../../renderer/graph/plotGeometry';

/** Each band's centre in the row, walked from the leads the row is laid with. */
const centresOf = ({ slot, leads }: IBandPlacement) => {
  let edge = 0;
  return leads.map((lead) => {
    edge += lead;
    const centre = edge + slot / 2;
    edge += slot;
    return centre;
  });
};

const place = (
  count: number,
  width: number,
  {
    offset = 0,
    visible,
  }: { offset?: number; visible?: { left: number; right: number } } = {},
) => {
  const placement = placeBandsEvenly(count, { width }, offset, visible);
  if (!placement) {
    throw new Error(`${count} bands found no places across ${width}px`);
  }
  return placement;
};

describe('bands in fixed places under the graph', () => {
  it('shares the plot’s width out evenly, each band centred in its share', () => {
    const placement = place(10, 1200);
    const centres = centresOf(placement);
    centres.forEach((centre, index) => {
      expect(centre).toBeCloseTo(60 + index * 120, 6);
    });
    expect(placement.slot).toBe(MAX_BAND_SLOT);
  });

  // The places come from the count alone, so a frequency dragged on the graph
  // — which reorders the bands at most — moves no slider. Ten bands in two
  // orders are laid out alike; the positive control is that an eleventh
  // band does move them.
  it('depends on how many bands there are and nothing else', () => {
    expect(place(10, 1200)).toEqual(place(10, 1200));
    expect(centresOf(place(11, 1200))[0]).not.toBeCloseTo(
      centresOf(place(10, 1200))[0],
      3,
    );
  });

  it('narrows the bands to their share, down to the narrowest a band reads at', () => {
    const placement = place(31, 31 * 45);
    expect(placement.slot).toBeCloseTo(45, 6);
    expect(placeBandsEvenly(31, { width: 31 * 39 }, 0)).toBeUndefined();
    expect(place(31, 31 * MIN_BAND_SLOT).slot).toBe(MIN_BAND_SLOT);
  });

  it('measures from the plot’s left edge in the row', () => {
    const shifted = centresOf(place(5, 500, { offset: 30 }));
    centresOf(place(5, 500)).forEach((centre, index) => {
      expect(shifted[index]).toBeCloseTo(centre + 30, 6);
    });
  });

  describe('inside what the page shows', () => {
    // The scroller clips the row at its padding and its scrollbar's gutter,
    // inside the plot's ends (Ivan, 2026-09-25: "EQ never can get trim on
    // the side").
    it('keeps every band whole within it', () => {
      const visible = { left: 20, right: 1180 };
      const placement = place(15, 1200, { visible });
      const centres = centresOf(placement);
      expect(centres[0] - placement.slot / 2).toBeGreaterThanOrEqual(20);
      expect(
        centres[centres.length - 1] + placement.slot / 2,
      ).toBeLessThanOrEqual(1180);
    });

    // The control: told only of the plot, the same row runs past the edges
    // the page shows.
    it('would run past it if told only of the plot', () => {
      const placement = place(15, 1200);
      const centres = centresOf(placement);
      expect(centres[centres.length - 1] + placement.slot / 2).toBeGreaterThan(
        1180,
      );
    });
  });

  it('has nothing to place without bands or without a plot', () => {
    expect(placeBandsEvenly(0, { width: 1200 }, 0)).toBeUndefined();
    expect(placeBandsEvenly(10, { width: 0 }, 0)).toBeUndefined();
  });
});
