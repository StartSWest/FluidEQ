/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IEqBandSettings } from '../../common/dsp/chain';
import { FilterTypeEnum } from '../../common/constants';

// The rack EQ graph's plot: its size and padding, its grid, its two level
// scales (the EQ's dB and the spectrum's dBFS), and the conversions between
// pixels, hertz and decibels.

export const MIN_HZ = 20;

export const MAX_HZ = 20_000;

/**
 * Vertical half-range.
 *
 * Wider than one band can reach, so a stack that adds up still lands inside
 * the box rather than against its edge — which would read as the EQ refusing
 * to go further.
 */
const RANGE_DB = 18;

export const HEIGHT = 300;

/** Insets: room for the dB scale on the left and the frequencies underneath. */
export const PAD_L = 46;

/**
 * Wide enough for "-90" on the right.
 *
 * This plot carries two scales, and only labelling one of them was a trap:
 * the curve is in dB of GAIN and the spectrum behind it is in dBFS of LEVEL,
 * so a threshold drawn at -60 dBFS lands where about -4 dB of gain would be
 * and gets read as -4. Two quantities cannot share one axis — they are not
 * the same kind of number — so the answer is the second axis, not a
 * compromise between them.
 */
export const PAD_R = 40;

/**
 * Room at the top for the legend, which sits over the canvas.
 *
 * The legend owns this strip; the plot begins below it so labels never cover
 * the response or its boost shading.
 */
export const PAD_T = 34;

export const PAD_B = 26;

export const GRID_HZ: [number, string][] = [
  [30, '30'],
  [100, '100'],
  [300, '300'],
  [1_000, '1k'],
  [3_000, '3k'],
  [10_000, '10k'],
];

export const GRID_DB = [12, 6, 0, -6, -12];

/** One response point per 2px is smooth without computing what cannot be seen. */
export const POINT_STEP_PX = 2;

/** How close a click has to land to grab a handle, in CSS pixels. */
export const GRAB_RADIUS = 16;

export const HANDLE_R = 8;

/**
 * The spectrum's vertical range, in dBFS.
 *
 * -96 is below anything audible in a 16-bit source. The top was -6 for a
 * while, to keep a mastered track from pinning flat against the ceiling —
 * which was the right call while the scale was unlabelled scenery and the
 * wrong one the moment it became an axis somebody reads a threshold against.
 * Full scale is the number that matters on a level scale, so full scale is
 * where the top is, and a track that reaches it is telling the truth.
 */
export const SPECTRUM_FLOOR_DB = -96;

export const SPECTRUM_TOP_DB = 0;

/** Where the level scale is marked, in dBFS. Evenly spaced across the range
 * and few enough not to compete with the gain grid beside them. */
export const GRID_DBFS = [0, -24, -48, -72];

/**
 * The plot's coordinate maths, at module scope.
 *
 * Outside the component because the paint effect is armed once and must not
 * list them as dependencies: functions recreated per render would tear the
 * ResizeObserver down and rebuild it on every pixel of a drag.
 */
export const plotW = (width: number) => Math.max(1, width - PAD_L - PAD_R);

export const plotH = (height: number) => Math.max(1, height - PAD_T - PAD_B);

export const hzToX = (hz: number, width: number) =>
  PAD_L +
  (Math.log10(hz / MIN_HZ) / Math.log10(MAX_HZ / MIN_HZ)) * plotW(width);

export const xToHz = (x: number, width: number) => {
  const across = Math.min(plotW(width), Math.max(0, x - PAD_L));
  return MIN_HZ * (MAX_HZ / MIN_HZ) ** (across / plotW(width));
};

/**
 * The level scale, both ways, beside the gain scale rather than inside the
 * paint loop — the threshold is dragged as well as drawn, and a pointer
 * working from a second copy of this arithmetic would land somewhere the
 * line is not.
 */
export const dbfsToY = (dbfs: number, height: number) =>
  PAD_T +
  plotH(height) -
  ((Math.max(SPECTRUM_FLOOR_DB, Math.min(SPECTRUM_TOP_DB, dbfs)) -
    SPECTRUM_FLOOR_DB) /
    (SPECTRUM_TOP_DB - SPECTRUM_FLOOR_DB)) *
    plotH(height);

export const yToDbfs = (y: number, height: number) => {
  const span = plotH(height);
  const from = Math.min(PAD_T + span, Math.max(PAD_T, y)) - PAD_T;
  return (
    SPECTRUM_TOP_DB - (from / span) * (SPECTRUM_TOP_DB - SPECTRUM_FLOOR_DB)
  );
};

export const dbToY = (db: number, height: number) =>
  PAD_T + plotH(height) / 2 - (db / RANGE_DB) * (plotH(height) / 2);

export const yToDb = (y: number, height: number) => {
  const span = plotH(height);
  const from = Math.min(PAD_T + span, Math.max(PAD_T, y)) - PAD_T;
  return ((span / 2 - from) / (span / 2)) * RANGE_DB;
};

export const toSpec = (band: IEqBandSettings) => ({
  type: band.type as FilterTypeEnum,
  frequency: band.frequency,
  gainDb: band.gainDb,
  quality: band.quality,
});
