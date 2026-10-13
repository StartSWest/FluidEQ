/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TBandChannel, TBandSide } from '../../common/constants';
import { planEarChange } from '../../common/bandEars';
import {
  EQ_MAX_BAND_COUNT,
  type IEqBandSettings,
  type IEqSettings,
} from '../../common/dsp/chain';

/**
 * The DSP EQ with a band kept to one ear (Ivan, 2026-10-13, "EQ per ear"):
 * the same picture as the main EQ's — the left ear's curve solid, the
 * right's dashed, both in the EQ's own colour, and the ear's letter beside a
 * one-ear band's handle.
 */

/**
 * Whether the rack plays two ears at all: a band switched on and kept to one
 * of them, while the EQ applies to Stereo. Mid and Sides have no left or
 * right, and the engine plays every band on both there (`chain_band_ear`).
 */
export const rackPlaysEars = (eq: IEqSettings): boolean =>
  eq.stereo === 'stereo' &&
  eq.bands.some((band) => band.enabled && band.ear !== undefined);

/** Whether `band` is heard on `ear`: a band on both ears is heard on each. */
export const isHeardOn = (band: IEqBandSettings, ear: TBandChannel): boolean =>
  band.ear === undefined || band.ear === ear;

/**
 * The ear's letter beside a handle, up and to the right where the band's own
 * caption never stands — the tag the main EQ's handles carry, filled, because
 * a bare letter over the curve and the spectrum was lost there.
 */
export const drawEarTag = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  letter: string,
  fill: string,
  ink: string,
  isLeftEar: boolean,
): void => {
  const size = 15;
  // The left ear's up and to the left, the right's to the right, as the main
  // EQ draws them: a band and its twin share one spot until one is moved.
  const left = isLeftEar ? x - 7 - size : x + 7;
  const top = y - 23;
  context.save();
  context.beginPath();
  context.roundRect(left, top, size, size, 4);
  context.fillStyle = fill;
  context.fill();
  context.fillStyle = ink;
  // The stack the rest of this canvas writes in.
  context.font =
    '700 10px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(letter, left + size / 2, top + size / 2 + 0.5);
  context.restore();
};

/** The band with its ear set, or none for both ears. */
const onEar = (band: IEqBandSettings, ear: TBandSide): IEqBandSettings => {
  const { ear: _, ...rest } = band;
  return ear === 'both' ? rest : { ...rest, ear };
};

/**
 * The rack's bands after putting band `index` on `side`: split into a twin on
 * the other ear, right beside it, or joined with it (`planEarChange`, the
 * rule the main EQ's bands follow too).
 */
export const withEarChange = (
  bands: readonly IEqBandSettings[],
  index: number,
  side: TBandSide,
): IEqBandSettings[] => {
  const plan = planEarChange(
    bands.map((band, at) => ({
      key: String(at),
      frequency: band.frequency,
      type: band.type,
      ear: band.ear,
    })),
    [String(index)],
    side,
    EQ_MAX_BAND_COUNT - bands.length,
  );
  const ears = new Map(plan.ears.map(({ key, ear }) => [key, ear]));
  const removed = new Set(plan.removed);
  const next: IEqBandSettings[] = [];
  bands.forEach((band, at) => {
    const key = String(at);
    if (removed.has(key)) {
      return;
    }
    const ear = ears.get(key);
    next.push(ear === undefined ? band : onEar(band, ear));
    plan.copies
      .filter(({ from }) => from === key)
      .forEach(({ ear: twinEar }) => next.push(onEar(band, twinEar)));
  });
  return next;
};
