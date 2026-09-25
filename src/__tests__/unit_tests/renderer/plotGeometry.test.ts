/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

/**
 * The band row under the graph (layout A, Ivan 2026-09-25): each slider
 * standing under the point on the graph it moves.
 *
 * The row is laid out from `placeBandsUnderPlot`'s slot and leads, and the
 * points from `bandXInPlot`, which rebuilds the chart's own axis. These hold
 * the two to each other: measured from the leads, every band's centre is its
 * point's x — including at 900px, where two points 39.9px apart used to send
 * the whole row back to even spacing for want of a tenth of a pixel.
 */

import {
  MAX_BAND_SLOT,
  MIN_BAND_SLOT,
  bandXInPlot,
  placeBandsUnderPlot,
  type IBandPlacement,
  type IPlotGeometry,
} from '../../../renderer/graph/plotGeometry';

type TGeometry = Pick<IPlotGeometry, 'width' | 'isGridHidden'>;

const FIFTEEN = [
  25, 40, 63, 100, 160, 250, 400, 630, 1000, 1600, 2500, 4100, 6300, 10000,
  16000,
];

const THIRTY_ONE = [
  20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630,
  800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500,
  16000, 20000,
];

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

const pointsOf = (frequencies: number[], geometry: TGeometry, offset = 0) =>
  frequencies.map((frequency) => offset + bandXInPlot(frequency, geometry));

/** The furthest any band's centre stands from its point. */
const worstMisalignment = (
  placement: IBandPlacement,
  frequencies: number[],
  geometry: TGeometry,
  offset = 0,
) => {
  const points = pointsOf(frequencies, geometry, offset);
  return Math.max(
    ...centresOf(placement).map((centre, index) =>
      Math.abs(centre - points[index]),
    ),
  );
};

const closestPair = (points: number[]) =>
  Math.min(...points.slice(1).map((x, index) => x - points[index]));

describe('bands under their graph points', () => {
  const wide: TGeometry = { width: 1245, isGridHidden: false };

  it('stands every band under its point on a wide graph', () => {
    const placement = placeBandsUnderPlot(FIFTEEN, wide, 12);
    expect(placement).toBeDefined();
    if (!placement) {
      return;
    }
    expect(placement.slot).toBeGreaterThanOrEqual(MIN_BAND_SLOT);
    expect(placement.slot).toBeLessThanOrEqual(MAX_BAND_SLOT);
    expect(worstMisalignment(placement, FIFTEEN, wide, 12)).toBeLessThan(0.5);
  });

  // The positive control: the measure above has to be able to see a band
  // standing off its point, or its zero proves nothing.
  it('is measured by something that sees a band moved off its point', () => {
    const placement = placeBandsUnderPlot(FIFTEEN, wide, 12);
    expect(placement).toBeDefined();
    if (!placement) {
      return;
    }
    const leads = [...placement.leads];
    leads[3] += 6;
    expect(
      worstMisalignment({ ...placement, leads }, FIFTEEN, wide, 12),
    ).toBeGreaterThan(5.9);
  });

  it('keeps them under their points where two are a hair closer than a band', () => {
    // The widest plot on which the closest pair is under a band's width —
    // what a 900px window left the fifteen bands.
    let width = 1400;
    while (
      closestPair(pointsOf(FIFTEEN, { width, isGridHidden: false })) >=
      MIN_BAND_SLOT
    ) {
      width -= 1;
    }
    const geometry: TGeometry = { width, isGridHidden: false };
    // The case the row used to give up on, or this test is not about it.
    expect(closestPair(pointsOf(FIFTEEN, geometry))).toBeLessThan(
      MIN_BAND_SLOT,
    );

    const placement = placeBandsUnderPlot(FIFTEEN, geometry, 0);
    expect(placement).toBeDefined();
    if (!placement) {
      return;
    }
    expect(placement.slot).toBe(MIN_BAND_SLOT);
    expect(placement.leads.every((lead) => lead >= -1e-9)).toBe(true);
    expect(worstMisalignment(placement, FIFTEEN, geometry)).toBeLessThan(1);
  });

  it('spaces them evenly when the bands would stand far from their points', () => {
    // Thirty-one a third of an octave apart are ~30px from each other here:
    // spread to a band's width, the ones at the ends would be a band away.
    expect(closestPair(pointsOf(THIRTY_ONE, wide))).toBeLessThan(MIN_BAND_SLOT);
    expect(placeBandsUnderPlot(THIRTY_ONE, wide, 0)).toBeUndefined();
  });

  it('keeps the outermost inside the plot when it runs edge to edge', () => {
    const gridless: TGeometry = { width: 1245, isGridHidden: true };
    const placement = placeBandsUnderPlot(FIFTEEN, gridless, 0);
    expect(placement).toBeDefined();
    if (!placement) {
      return;
    }
    const centres = centresOf(placement);
    expect(centres[0] - placement.slot / 2).toBeGreaterThanOrEqual(-1e-9);
    expect(
      centres[centres.length - 1] + placement.slot / 2,
    ).toBeLessThanOrEqual(gridless.width + 1e-9);
  });

  // The row is clipped by the page it stands in, inside the plot's ends: with
  // the grid off, 16 kHz stands 12px from the plot's edge, past what a page
  // inset 20px shows, and its band was cut in half there (Ivan, 2026-09-25:
  // "EQ never can get trim on the side").
  describe('inside what the page shows', () => {
    const gridless: TGeometry = { width: 1245, isGridHidden: true };
    const shown = { left: 20, right: 1225 };

    it('keeps every band whole, and the row placed', () => {
      const placement = placeBandsUnderPlot(FIFTEEN, gridless, 0, shown);
      expect(placement).toBeDefined();
      if (!placement) {
        return;
      }
      const centres = centresOf(placement);
      expect(centres[0] - placement.slot / 2).toBeGreaterThanOrEqual(
        shown.left - 1e-9,
      );
      expect(
        centres[centres.length - 1] + placement.slot / 2,
      ).toBeLessThanOrEqual(shown.right + 1e-9);
    });

    // The positive control: told only of the plot, the last band runs past
    // the edge the page clips at — which is the cut this guards against.
    it('would run past it if told only of the plot', () => {
      const placement = placeBandsUnderPlot(FIFTEEN, gridless, 0);
      expect(placement).toBeDefined();
      if (!placement) {
        return;
      }
      const centres = centresOf(placement);
      expect(centres[centres.length - 1] + placement.slot / 2).toBeGreaterThan(
        shown.right,
      );
    });

    it('stands the bands that fit under their points', () => {
      const placement = placeBandsUnderPlot(FIFTEEN, gridless, 0, shown);
      expect(placement).toBeDefined();
      if (!placement) {
        return;
      }
      const points = pointsOf(FIFTEEN, gridless);
      const centres = centresOf(placement);
      // All but the outermost, which gives up what the edge takes.
      centres.slice(1, -2).forEach((centre, index) => {
        expect(Math.abs(centre - points[index + 1])).toBeLessThan(1);
      });
    });
  });

  it('has nothing to place without bands or without a plot', () => {
    expect(placeBandsUnderPlot([], wide, 0)).toBeUndefined();
    expect(
      placeBandsUnderPlot(FIFTEEN, { width: 0, isGridHidden: false }, 0),
    ).toBeUndefined();
  });
});
