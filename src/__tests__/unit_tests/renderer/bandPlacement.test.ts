/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Where the bands stand on the EQ page's rail (Ivan, 2026-11-16: "first we
 * need to always fill the space unless it is too much, and then we centre
 * ... keep a maximum space between bands"). They share the rail evenly, no
 * further apart than `MAX_BAND_PITCH`, as one centred group where that leaves
 * room; no band count decides it, only the room. The graph's geometry no
 * longer reaches them (`plotGeometry.ts` went with that, and these cases came
 * from its test), so switching the graph on and off moves no band.
 *
 * A band's slider does not move when its frequency is dragged on the graph
 * (Ivan, 2026-09-26): the places depend on how many bands there are and on
 * the rail, and these hold that, and every band whole inside what the page
 * shows.
 */

import {
  MAX_BAND_PITCH,
  MAX_BAND_SLOT,
  MIN_BAND_SLOT,
  isSamePlacement,
  placeBandsInRail,
  type IBandPlacement,
} from '../../../renderer/eq/bandPlacement';

/** Each band's centre in the rail, walked from the leads the row is laid with. */
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
  visible: { left: number; right: number } = { left: 0, right: width },
) => {
  const placement = placeBandsInRail(count, visible);
  if (!placement) {
    throw new Error(`${count} bands found no places across ${width}px`);
  }
  return placement;
};

describe('bands on the rail', () => {
  it('shares the rail out evenly while the bands fill it, each centred in its share', () => {
    const placement = place(10, 1200);
    centresOf(placement).forEach((centre, index) => {
      expect(centre).toBeCloseTo(60 + index * 120, 6);
    });
    expect(placement.slot).toBe(MAX_BAND_SLOT);
  });

  it('stands them as one centred group no further apart than the pitch allows', () => {
    // Ivan's 2804px window: a 2290px rail, fifteen bands 128px apart and
    // 185px either side.
    const centres = centresOf(place(15, 2290));
    centres.forEach((centre, index) => {
      expect(centre).toBeCloseTo(185 + MAX_BAND_PITCH / 2 + index * 128, 6);
    });
    // Positive control: where the pitch fills the rail there is no margin.
    const filling = centresOf(place(15, 15 * MAX_BAND_PITCH));
    expect(filling[0]).toBeCloseTo(MAX_BAND_PITCH / 2, 6);
  });

  // The places come from the count and the room alone, so a frequency
  // dragged on the graph — which reorders the bands at most — moves no
  // slider. The positive control is that an eleventh band does move them.
  it('depends on how many bands there are and on the room, and nothing else', () => {
    expect(place(10, 1200)).toEqual(place(10, 1200));
    expect(centresOf(place(11, 1200))[0]).not.toBeCloseTo(
      centresOf(place(10, 1200))[0],
      3,
    );
  });

  it('narrows the bands to their share, down to the narrowest a band reads at', () => {
    expect(place(31, 31 * 45).slot).toBeCloseTo(45, 6);
    expect(placeBandsInRail(31, { left: 0, right: 31 * 39 })).toBeUndefined();
    expect(place(31, 31 * MIN_BAND_SLOT).slot).toBe(MIN_BAND_SLOT);
  });

  describe('inside what the page shows', () => {
    // The scroller clips the row at its padding and its scrollbar's gutter
    // (Ivan, 2026-09-25: "EQ never can get trim on the side").
    it('keeps every band whole within it', () => {
      const visible = { left: 20, right: 1180 };
      const placement = place(15, 1200, visible);
      const centres = centresOf(placement);
      expect(centres[0] - placement.slot / 2).toBeGreaterThanOrEqual(20);
      expect(
        centres[centres.length - 1] + placement.slot / 2,
      ).toBeLessThanOrEqual(1180);
    });

    // The control: told the whole rail, the same row runs past the edges
    // the page shows.
    it('would run past it if told the whole rail', () => {
      const placement = place(15, 1200);
      const centres = centresOf(placement);
      expect(centres[centres.length - 1] + placement.slot / 2).toBeGreaterThan(
        1180,
      );
    });
  });

  it('has nothing to place without bands or without room', () => {
    expect(placeBandsInRail(0, { left: 0, right: 1200 })).toBeUndefined();
    expect(placeBandsInRail(10, { left: 0, right: 0 })).toBeUndefined();
  });

  it('calls two placements under half a pixel apart the same', () => {
    const placement = place(10, 1200);
    const nudged = {
      slot: placement.slot + 0.3,
      leads: placement.leads.map((lead) => lead + 0.3),
    };
    expect(isSamePlacement(placement, nudged)).toBe(true);
    expect(isSamePlacement(placement, place(10, 1210))).toBe(false);
    expect(isSamePlacement(placement, undefined)).toBe(false);
    expect(isSamePlacement(undefined, undefined)).toBe(true);
  });
});
