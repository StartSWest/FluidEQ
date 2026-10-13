/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TBandChannel } from '../../common/constants';
import type { IEqBandSettings, IEqSettings } from '../../common/dsp/chain';

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
): void => {
  const size = 15;
  const left = x + 7;
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
