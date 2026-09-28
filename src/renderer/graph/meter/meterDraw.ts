/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import type { MeterStyle } from 'common/meterStyles';
import {
  drawBar,
  drawCenter,
  drawFlow,
  drawFluid,
  drawMercury,
} from './meterColumns';
import { drawNeedle, drawPulse } from './meterGauges';
import { drawLeds, drawSegments, drawStack } from './meterLadders';
import {
  type IChannelLevel,
  type IChannelRect,
  type IMeterPen,
  ZONE_COLOURS,
  bodyStops,
  fillBetween,
  innerOf,
  lampStops,
  levelRamp,
  travellingStops,
} from './meterPaint';
import { EDGE_INK, type IStrip, SLOT_ALPHA, UNLIT_ALPHA } from './meterStrip';

const DRAW: Record<MeterStyle, (strip: IStrip) => void> = {
  bar: drawBar,
  segments: drawSegments,
  leds: drawLeds,
  fluid: drawFluid,
  mercury: drawMercury,
  needle: drawNeedle,
  pulse: drawPulse,
  stack: drawStack,
  flow: drawFlow,
  center: drawCenter,
};

/** The clip warning's red, as channels for its fading alpha. */
const CLIP_RGB = '255, 90, 110';

/**
 * A theme colour laid down at part strength. `color-mix` because the token
 * can arrive as anything CSS writes — a hex, or a mix of its own under a
 * scene's cover — and a canvas takes the same syntax the stylesheet does.
 */
const faded = (colour: string, alpha: number) =>
  `color-mix(in srgb, ${colour} ${Math.round(alpha * 100)}%, transparent)`;

/** A one-device-pixel frame just inside a box, drawn as four fills. */
const frame = (pen: IMeterPen, box: IChannelRect) => {
  const left = pen.px(box.x);
  const top = pen.px(box.y);
  const right = pen.px(box.x + box.width);
  const bottom = pen.px(box.y + box.height);
  const { context, hair } = pen;
  context.fillRect(left, top, right - left, hair);
  context.fillRect(left, bottom - hair, right - left, hair);
  context.fillRect(left, top + hair, hair, bottom - top - 2 * hair);
  context.fillRect(right - hair, top + hair, hair, bottom - top - 2 * hair);
};

/**
 * The slot every style stands in: one well, one crisp border, square.
 *
 * Five styles used to draw a container of their own and five stood in a
 * slot whose edge faded out toward the foot, so cycling changed the
 * instrument as well as the reading. One slot with ten readings in it is a
 * meter with ten looks. The border takes the clip warning's red while a
 * channel is clipped, fading with the warning; it used to heat the whole
 * well in a red wash, a glow by another name.
 *
 * Except the leaning pile, whose slabs slide past any box they stand in
 * (`drawStack`); switched off, it is the slot like the rest.
 */
export const standsInSlot = (style: MeterStyle) => style !== 'stack';

export const drawSlot = (
  pen: IMeterPen,
  rect: IChannelRect,
  well: string,
  warnLevel: number,
) => {
  pen.context.fillStyle = faded(well, SLOT_ALPHA);
  fillBetween(pen, rect.x, rect.y, rect.x + rect.width, rect.y + rect.height);
  pen.context.fillStyle =
    warnLevel > 0.001
      ? `rgba(${CLIP_RGB}, ${0.3 + 0.7 * warnLevel})`
      : EDGE_INK;
  frame(pen, rect);
};

/**
 * The clip lamp: a three-pixel cap across the top of the slot, over the
 * reading, lit while samples reach the rail and fading after. The one place
 * the warning is said, where the trouble is.
 */
export const drawClipCap = (
  pen: IMeterPen,
  rect: IChannelRect,
  warnLevel: number,
) => {
  if (warnLevel <= 0.001) {
    return;
  }
  const inner = innerOf(pen, rect);
  pen.context.fillStyle = ZONE_COLOURS.clip;
  pen.context.globalAlpha = warnLevel;
  fillBetween(pen, inner.x, inner.y, inner.x + inner.width, inner.y + 3);
  pen.context.globalAlpha = 1;
};

/** One channel's reading in one of the ten styles, inside its slot. */
export const drawChannel = (
  pen: IMeterPen,
  rect: IChannelRect,
  channel: IChannelLevel,
  style: MeterStyle,
  isRainbow: boolean,
  unlit: string,
) => {
  const inner = innerOf(pen, rect);
  const stops = bodyStops(isRainbow);
  // The two ladders carry one travelling colour in Rainbow mode rather than
  // the whole rainbow up an eighteen-pixel strip.
  const travels = isRainbow && (style === 'segments' || style === 'leds');
  pen.context.save();
  DRAW[style]({
    pen,
    rect,
    inner,
    channel,
    isRainbow,
    unlit: faded(unlit, UNLIT_ALPHA),
    body: levelRamp(pen.context, inner, stops),
    bodyStops: stops,
    lamps: levelRamp(
      pen.context,
      inner,
      travels ? travellingStops(pen.now) : lampStops(isRainbow),
    ),
  });
  pen.context.restore();
};

/**
 * Whether a style's drawing moves between readings — the liquid's surface,
 * the current, the pulse, the pile's lean, and the ladders' travelling
 * colour in Rainbow mode — so the frame loop stays awake for it through a
 * steady passage.
 */
export const meterStyleMoves = (style: MeterStyle, isRainbow: boolean) =>
  style === 'fluid' ||
  style === 'flow' ||
  style === 'pulse' ||
  style === 'stack' ||
  (isRainbow && (style === 'segments' || style === 'leds'));
