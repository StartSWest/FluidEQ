/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

/**
 * The headroom that keeps the band handles out from under the controls strip.
 *
 * The bug this fixes is invisible to every test that queries by role: the
 * handles were present, correct and on screen, and simply could not be
 * clicked, because a row of buttons with pointer events was lying on top of
 * them. So what is asserted here is the number, against the strip's real
 * measured height.
 */

import {
  CONTROLS_CLEARANCE,
  CONTROLS_OFFSET,
  MINIMUM_TOP_MARGIN,
  plotTopMargin,
} from '../../../renderer/graph/plotMargins';

describe('headroom above the plot', () => {
  it('clears a single-row strip, which the old constant did not', () => {
    // Eight pixels down from the card plus a 28px button is 36, and the old
    // headroom was 30 — so the top six pixels of the plot were unreachable
    // before the row had even wrapped.
    const single = 28;
    expect(plotTopMargin(false, single)).toBe(
      single + CONTROLS_OFFSET + CONTROLS_CLEARANCE,
    );
    expect(plotTopMargin(false, single)).toBeGreaterThan(MINIMUM_TOP_MARGIN);
  });

  it('follows the strip when the chips wrap to a second row', () => {
    // The case no constant could have covered: a narrow pane with several
    // layers in the chain wraps the row and doubles its height.
    const wrapped = 64;
    expect(plotTopMargin(false, wrapped)).toBe(
      wrapped + CONTROLS_OFFSET + CONTROLS_CLEARANCE,
    );
    expect(plotTopMargin(false, wrapped)).toBeGreaterThan(
      plotTopMargin(false, 28),
    );
  });

  it('keeps the old headroom when the strip is shorter than it', () => {
    // The +20 dB curve still needs room even if the strip needs none.
    expect(plotTopMargin(false, 4)).toBe(MINIMUM_TOP_MARGIN);
  });

  it('falls back to the old headroom before anything is measured', () => {
    // First paint, and any environment without ResizeObserver.
    expect(plotTopMargin(false, 0)).toBe(MINIMUM_TOP_MARGIN);
    expect(plotTopMargin(false, Number.NaN)).toBe(MINIMUM_TOP_MARGIN);
    expect(plotTopMargin(false, -50)).toBe(MINIMUM_TOP_MARGIN);
  });

  it('gives the headroom up when stretched, whatever the strip is doing', () => {
    // That space is most of what stretching exists to reclaim, and there is no
    // handle up there to protect once the drawing is the point.
    expect(plotTopMargin(true, 0)).toBe(4);
    expect(plotTopMargin(true, 64)).toBe(4);
  });

  it('never returns a fractional margin', () => {
    // getBoundingClientRect heights are not integers, and half a pixel of
    // margin is half a pixel of the plot rounded away somewhere downstream.
    expect(Number.isInteger(plotTopMargin(false, 33.4))).toBe(true);
    expect(plotTopMargin(false, 33.4)).toBe(
      34 + CONTROLS_OFFSET + CONTROLS_CLEARANCE,
    );
  });
});
