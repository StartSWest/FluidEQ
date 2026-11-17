/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * WHERE THE BANDS STAND ON THE EQ PAGE'S RAIL (Ivan, 2026-11-16: "first we
 * need to always fill the space unless it is too much, and then we centre
 * ... Don't fix it to the band count ... basically keep a maximum space
 * between bands so it looks good, and centred").
 *
 * The bands share the rail evenly, low to high, and the distance from one
 * band's middle to the next is never more than `MAX_BAND_PITCH`: where the
 * bands at that distance do not reach across the rail, they stand as one
 * group in its middle. No band count decides it, only the room. They used to
 * stand under the graph's points, which put the 25 Hz slider under 7 Hz once
 * the plot ran an octave past both ends, and before that they were centred
 * at up to ten bands and spread past ten, a count that knew nothing of the
 * window.
 *
 * A band's slider does not move when its frequency is dragged on the graph,
 * and two bands trade places only when one passes the other (Ivan,
 * 2026-09-26): places depend on how many bands there are and on the rail.
 */

/**
 * How the band row is laid out: every band `slot` wide, and each one's left
 * margin from the one before it (from the row's own left edge, for the
 * first). A flex row of those is the bands in their places, at the height
 * their content already gives them.
 */
export interface IBandPlacement {
  slot: number;
  leads: number[];
}

/**
 * Narrowest a band is still a band at: the width the row already refuses to
 * go below before it scrolls instead (`--band-min-width` in
 * `_mainContentGrid.scss`), where the frequency caption, the thumb and the
 * gain still read.
 */
export const MIN_BAND_SLOT = 40;

/** Widest a band is drawn; past it the room goes between the bands. */
export const MAX_BAND_SLOT = 64;

/**
 * Furthest one band's middle stands from the next: a band's widest and as
 * much air again. On Ivan's 2804px window the rail is 2290px, fifteen bands
 * would be 153px apart filling it, and at 128 they stand centred with 185px
 * either side; at 1920 (a 1406px rail) and narrower they fill it.
 */
export const MAX_BAND_PITCH = 2 * MAX_BAND_SLOT;

/**
 * `count` bands across `visible`, the stretch of the rail the page shows (in
 * the rail's own coordinates), or `undefined` where they do not fit and the
 * row should scroll instead.
 */
export const placeBandsInRail = (
  count: number,
  visible: { left: number; right: number },
): IBandPlacement | undefined => {
  const room = visible.right - visible.left;
  if (count <= 0 || room <= 0) {
    return undefined;
  }
  const pitch = Math.min(MAX_BAND_PITCH, room / count);
  if (pitch < MIN_BAND_SLOT) {
    return undefined;
  }
  const slot = Math.min(MAX_BAND_SLOT, pitch);
  // The group's own width centred in the room: zero either side while the
  // bands fill it.
  const start = visible.left + (room - pitch * count) / 2;
  const leads = Array.from({ length: count }, (_, index) =>
    index === 0 ? start + (pitch - slot) / 2 : pitch - slot,
  );
  return { slot, leads };
};

/**
 * Two placements nobody could tell apart: within half a pixel everywhere. A
 * resize observer reports fractional boxes, and re-laying the row for a
 * difference of a hundredth of a pixel would re-render it for nothing.
 */
export const isSamePlacement = (
  a: IBandPlacement | undefined,
  b: IBandPlacement | undefined,
): boolean => {
  if (!a || !b) {
    return a === b;
  }
  return (
    Math.abs(a.slot - b.slot) < 0.5 &&
    a.leads.length === b.leads.length &&
    a.leads.every((lead, index) => Math.abs(lead - b.leads[index]) < 0.5)
  );
};
