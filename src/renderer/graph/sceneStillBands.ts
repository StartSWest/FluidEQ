/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * How tall each band of a kept picture may be, decided from the band before
 * it rather than from anything the scene had a say in.
 *
 * A member's picture is drawn a band at a time so that no single job holds the
 * GPU: Windows resets the display for every program on the machine when one
 * runs about two seconds, and the heaviest source the member rules accept is
 * 3.74 seconds of one 1920x1080 frame on an integrated chip.
 *
 * The band count used to come from timing the scene on a postage stamp and
 * scaling by the pixel ratio. A shader is handed the size it is drawing at, so
 * one line — `if (uResolution.x > 900.0)` — put every measurement on a cheap
 * branch, the estimate came out at nothing, one band was asked for, and the
 * whole frame went to the driver as a single job. Unattended: a gallery of
 * cards draws these while somebody scrolls.
 *
 * Measuring each band and sizing the next from it is not enough on its own —
 * a scene can make its cost depend on the row, so a cheap band says nothing
 * about the next. Hence three rules, and this file exists so they can be
 * tested without a GPU, the way `sceneDrawWatch.ts` is:
 *
 * - the first band is a thirty-second of the frame, which is a quarter-second
 *   of the worst source the rules accept and survives every measurement before
 *   it being a lie;
 * - no band is more than four times the rows of the one just measured;
 * - no band is more than an eighth of the frame, whatever the last one cost.
 *
 * So the worst a lying scene buys itself is one band of an eighth, and an
 * honest cheap one pays about nine readbacks instead of one.
 */

/** The longest one band of the kept frame is meant to hold the GPU. */
export const BAND_MS = 250;

/** Of the frame's rows: the first band, and the largest any band may be. */
export const FIRST_BAND_SHARE = 1 / 32;
export const WIDEST_BAND_SHARE = 1 / 8;

/** How much taller than the band just measured the next one may be. */
export const BAND_GROWTH = 4;

const rowsOf = (totalRows: number, share: number) =>
  Math.max(1, Math.ceil(totalRows * share));

export const firstBandRows = (totalRows: number): number =>
  Math.min(Math.max(1, totalRows), rowsOf(totalRows, FIRST_BAND_SHARE));

/**
 * The next band's rows, from the rows the last band covered and what it took.
 * `lastMs` carries the readback with it, which charges a cheap scene one band
 * more than it needs — the direction to be wrong in.
 */
export const nextBandRows = (
  totalRows: number,
  lastRows: number,
  lastMs: number,
): number => {
  const perRow = Math.max(lastMs / Math.max(1, lastRows), 1e-6);
  return Math.max(
    1,
    Math.min(
      Math.max(1, totalRows),
      rowsOf(totalRows, WIDEST_BAND_SHARE),
      Math.max(1, lastRows) * BAND_GROWTH,
      Math.floor(BAND_MS / perRow),
    ),
  );
};
