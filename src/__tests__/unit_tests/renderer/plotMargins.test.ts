/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

/**
 * The headroom above the plot, now that the controls strip floats inside it.
 *
 * It used to follow the strip's measured height so no band handle could land
 * under a button, and that band of empty graph cut every visualizer off in a
 * straight line along its foot (Ivan, 2026-09-25). The strip lies over the
 * plot now and lets presses through wherever it is not a control, so the
 * headroom is a constant — and must not creep back up to the strip's height.
 */

import {
  EDGE_TO_EDGE_TOP_MARGIN,
  RULED_TOP_MARGIN,
  plotTopMargin,
} from '../../../renderer/graph/plotMargins';

describe('headroom above the plot', () => {
  it('is a few pixels for a ruled plot, not a band for the strip', () => {
    expect(plotTopMargin(false)).toBe(RULED_TOP_MARGIN);
    // The strip is 40px on one row; the old headroom was that plus 14.
    expect(plotTopMargin(false)).toBeLessThan(14);
  });

  it('gives the rest up when the plot runs edge to edge', () => {
    expect(plotTopMargin(true)).toBe(EDGE_TO_EDGE_TOP_MARGIN);
    expect(plotTopMargin(true)).toBeLessThanOrEqual(plotTopMargin(false));
  });

  it('never returns a fractional margin', () => {
    expect(Number.isInteger(plotTopMargin(false))).toBe(true);
    expect(Number.isInteger(plotTopMargin(true))).toBe(true);
  });
});
