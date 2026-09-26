/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The quarters, on every percentage slider: the graph's View menu, the
 * Studio's wave, and the window's Brightness and Transparency (Ivan,
 * 2026-09-26: "25 50 75 for both").
 *
 * A slider that lands exactly on a quarter is worth more than three decimal
 * places of freedom either side of it: half height and half see-through are
 * the settings people actually mean, and hitting one by hand on an 86px track
 * is luck. The ticks say where they are and the reach makes the thumb fall
 * into them: within three points of a quarter the thumb goes to it, further
 * away it is free. Blur is not a percentage and has no quarters worth naming,
 * so it stays a plain slider.
 */
export const PERCENT_SNAPS: readonly number[] = [25, 50, 75];
const PERCENT_SNAP_REACH = 3;

export const snapPercent = (percent: number): number => {
  const near = PERCENT_SNAPS.find(
    (snap) => Math.abs(percent - snap) <= PERCENT_SNAP_REACH,
  );
  return near ?? percent;
};

/** Where `snap` stands along a slider from `min` to `max`, 0 to 1. */
export const snapFraction = (snap: number, min: number, max: number) =>
  (snap - min) / (max - min);
