/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import {
  type IChannelLevel,
  type IChannelRect,
  type IMeterPen,
  type IRampStop,
  fillBetween,
  zoneColour,
} from './meterPaint';

/**
 * One channel's strip as a style sees it: the slot, the inside of its
 * border, the reading, and the paints already built for this frame.
 */
export interface IStrip {
  pen: IMeterPen;
  /** The slot, border included. */
  rect: IChannelRect;
  /** Inside the border: where the reading is drawn. */
  inner: IChannelRect;
  channel: IChannelLevel;
  isRainbow: boolean;
  /** Something there and switched off: an unlit lamp, an empty tube. */
  unlit: string;
  /** The column's ramp, dark foot to light crest, zones on the tip. */
  body: CanvasGradient;
  /** The stops `body` was built from, for a style that lays them out anew. */
  bodyStops: readonly IRampStop[];
  /** The lamps' ramp: every lamp lit, no dark foot. */
  lamps: CanvasGradient;
}

/**
 * The slot's edge and the hairlines drawn inside it. Quiet: the slot is
 * where the reading stands, and at 0.18 it competed with it.
 */
export const EDGE_INK = 'rgba(214, 233, 247, 0.12)';

/**
 * How much of the slot's and the unlit pieces' colour is laid down. The
 * slot is the slider tracks' colour, a step lighter than the panel, and at
 * full strength a strip read as a pale bar with a faint reading in it.
 */
export const SLOT_ALPHA = 0.5;
export const UNLIT_ALPHA = 0.55;

/** Where a fraction of the strip lands, measured up from its floor. */
export const heightAt = (strip: IStrip, fraction: number): number => {
  const { inner, pen } = strip;
  return pen.px(
    inner.y + inner.height * (1 - Math.max(0, Math.min(1, fraction))),
  );
};

/**
 * The reading's edge as a two-pixel rule in the zone's colour: the value
 * lives at the top of a column, so that edge gets the contrast — the same
 * reason a real meter's scale is read off the top of the column and not off
 * its middle.
 */
export const drawTip = (strip: IStrip, y: number) => {
  const { pen, inner, channel } = strip;
  if (inner.y + inner.height - y < 3) {
    return;
  }
  pen.context.fillStyle = zoneColour(channel.zone);
  fillBetween(pen, inner.x, y, inner.x + inner.width, y + 2);
};

/**
 * The held peak as a two-pixel rule across the strip, in the peak's own
 * zone colour, once it stands clear of the reading — on the tip it is the
 * tip. A meter that shows only the moment cannot report the transient that
 * caused the trouble, which is most of what it is for.
 */
export const drawPeakRule = (
  strip: IStrip,
  left = strip.inner.x,
  right = strip.inner.x + strip.inner.width,
) => {
  const { pen, channel } = strip;
  if (channel.peak - channel.level < 0.012) {
    return;
  }
  const y = heightAt(strip, channel.peak);
  pen.context.fillStyle = zoneColour(channel.peakZone);
  fillBetween(pen, left, y, right, y + 2);
};
