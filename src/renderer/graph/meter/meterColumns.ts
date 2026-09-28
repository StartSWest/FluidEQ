/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { fillBetween, mirroredRamp, zoneColour } from './meterPaint';
import {
  EDGE_INK,
  type IStrip,
  drawPeakRule,
  drawTip,
  heightAt,
} from './meterStrip';

/**
 * The styles that read the level as one continuous body: a bar, a liquid, a
 * thermometer, a current, and the one that grows from the middle. Each is a
 * flat fill in the ramp with a sharp tip in the zone's colour; what differs
 * is the body's shape and what moves in it.
 */

/**
 * The plain one, and it stays plain: with ten styles on a cycle, one of
 * them has to be the reading and nothing else.
 */
export const drawBar = (strip: IStrip) => {
  const { pen, inner, body, channel } = strip;
  const floor = inner.y + inner.height;
  const top = heightAt(strip, channel.level);
  if (floor - top > 0) {
    pen.context.fillStyle = body;
    fillBetween(pen, inner.x, top, inner.x + inner.width, floor);
  }
  drawTip(strip, top);
  drawPeakRule(strip);
};

/**
 * A body of liquid whose surface moves.
 *
 * Two sines at rates that do not divide into each other, so the surface
 * never repeats a profile and reads as disturbed rather than animated, and
 * a swell that grows with the level, so a full column sloshes and a nearly
 * empty one lies still. The meniscus is the reading: a one-and-a-half pixel
 * line in the zone's colour over a body a shade translucent.
 */
export const drawFluid = (strip: IStrip) => {
  const { pen, inner, body, channel } = strip;
  const { context } = pen;
  const floor = inner.y + inner.height;
  const surface = heightAt(strip, channel.level);
  if (floor - surface < 1) {
    return;
  }
  const swell = Math.min(1.8, (floor - surface) / 6) * (0.35 + channel.level);
  const steps = 12;
  const surfaceAt = (step: number) => {
    const across = step / steps;
    return Math.min(
      floor,
      surface +
        Math.sin(across * 6.1 + pen.now * 0.0021) * swell +
        Math.sin(across * 3.3 - pen.now * 0.0013) * swell * 0.6,
    );
  };
  const xAt = (step: number) => inner.x + (inner.width * step) / steps;

  context.save();
  context.beginPath();
  context.rect(inner.x, inner.y, inner.width, inner.height);
  context.clip();
  context.beginPath();
  context.moveTo(inner.x, floor);
  for (let step = 0; step <= steps; step += 1) {
    context.lineTo(xAt(step), surfaceAt(step));
  }
  context.lineTo(inner.x + inner.width, floor);
  context.closePath();
  context.globalAlpha = 0.95;
  context.fillStyle = body;
  context.fill();
  context.globalAlpha = 1;
  context.beginPath();
  for (let step = 0; step <= steps; step += 1) {
    if (step === 0) {
      context.moveTo(xAt(step), surfaceAt(step));
    } else {
      context.lineTo(xAt(step), surfaceAt(step));
    }
  }
  context.lineWidth = 1.5;
  context.lineJoin = 'round';
  context.strokeStyle = zoneColour(channel.zone);
  context.stroke();
  context.restore();
  drawPeakRule(strip);
};

/**
 * A thermometer: a capillary with a bulb at its foot, standing in the slot.
 *
 * The capillary is under half the strip and the bulb one and a half times
 * its width, the silhouette that says thermometer before anything else is
 * noticed. The bulb is the reservoir, not the reading, so it is always
 * full — an empty bulb reads as broken rather than as cold. The column is
 * read against the same scale as every other style: its top is the level
 * on the strip, not a fraction of the tube.
 */
export const drawMercury = (strip: IStrip) => {
  const { pen, inner, body, channel, unlit } = strip;
  const { context } = pen;
  const centre = inner.x + inner.width / 2;
  const tubeWidth = pen.px(Math.max(4, inner.width * 0.42));
  const tubeLeft = pen.px(centre - tubeWidth / 2);
  const bulbRadius = tubeWidth * 0.95;
  const bulbCentre = inner.y + inner.height - bulbRadius - 2;
  const tubeTop = pen.px(inner.y + 2);

  const glass = () => {
    context.beginPath();
    context.roundRect(tubeLeft, tubeTop, tubeWidth, bulbCentre - tubeTop, [
      tubeWidth / 2,
      tubeWidth / 2,
      0,
      0,
    ]);
    context.moveTo(centre + bulbRadius, bulbCentre);
    context.arc(centre, bulbCentre, bulbRadius, 0, Math.PI * 2);
  };

  context.save();
  glass();
  context.fillStyle = unlit;
  context.fill();
  context.clip();
  const top = Math.max(tubeTop, heightAt(strip, channel.level));
  context.fillStyle = body;
  fillBetween(pen, tubeLeft, top, tubeLeft + tubeWidth, bulbCentre);
  context.beginPath();
  context.arc(centre, bulbCentre, bulbRadius + 1, 0, Math.PI * 2);
  context.fill();
  if (bulbCentre - top >= 3) {
    context.fillStyle = zoneColour(channel.zone);
    fillBetween(pen, tubeLeft, top, tubeLeft + tubeWidth, top + 2);
  }
  context.restore();

  context.save();
  glass();
  context.lineWidth = 1;
  context.strokeStyle = EDGE_INK;
  context.stroke();
  context.restore();
  drawPeakRule(strip, tubeLeft, tubeLeft + tubeWidth);
};

/**
 * Centre-zero: the reading grows out of the middle both ways, the way a
 * balance meter reads either side of nought. Both tips carry the zone,
 * because here the value is at the ends and the middle is only where it
 * grew from, and the axis is a dark groove that shows against the lit
 * body and the empty slot alike.
 */
export const drawCenter = (strip: IStrip) => {
  const { pen, inner, channel, bodyStops } = strip;
  const { context } = pen;
  const middle = pen.px(inner.y + inner.height / 2);
  const reach = (inner.height / 2) * Math.max(0, Math.min(1, channel.level));
  const right = inner.x + inner.width;
  const upper = pen.px(middle - reach);
  const lower = pen.px(middle + reach);
  if (lower - upper > 0) {
    context.fillStyle = mirroredRamp(context, inner, bodyStops);
    fillBetween(pen, inner.x, upper, right, lower);
  }
  if (reach >= 3) {
    context.fillStyle = zoneColour(channel.zone);
    fillBetween(pen, inner.x, upper, right, upper + 2);
    fillBetween(pen, inner.x, lower - 2, right, lower);
  }
  if (channel.peak - channel.level >= 0.012) {
    const peakReach = (inner.height / 2) * Math.min(1, channel.peak);
    context.fillStyle = zoneColour(channel.peakZone);
    fillBetween(
      pen,
      inner.x,
      middle - peakReach,
      right,
      middle - peakReach + 2,
    );
    fillBetween(
      pen,
      inner.x,
      middle + peakReach - 2,
      right,
      middle + peakReach,
    );
  }
  context.fillStyle = 'rgba(6, 14, 24, 0.55)';
  fillBetween(pen, inner.x, middle - pen.hair, right, middle + pen.hair);
};

/** How far apart the current's chevrons run, in CSS pixels. */
const CHEVRON_PITCH = 11;

/**
 * A current running up the pipe.
 *
 * The body is the reading; chevrons travel up it, faster and closer to the
 * top as the level climbs, so a loud passage is a torrent and a quiet one a
 * trickle at the same height. Hairlines of light over the colour rather
 * than more colour at a lower alpha, which turned the amber band olive.
 */
export const drawFlow = (strip: IStrip) => {
  const { pen, inner, body, channel } = strip;
  const { context } = pen;
  const floor = inner.y + inner.height;
  const top = heightAt(strip, channel.level);
  if (floor - top < 1) {
    return;
  }
  const right = inner.x + inner.width;
  context.fillStyle = body;
  fillBetween(pen, inner.x, top, right, floor);

  context.save();
  context.beginPath();
  context.rect(inner.x, top, inner.width, floor - top);
  context.clip();
  const speed = 0.014 + channel.level * 0.05;
  const travel = (pen.now * speed) % CHEVRON_PITCH;
  const rise = inner.width * 0.34;
  const centre = inner.x + inner.width / 2;
  context.beginPath();
  for (
    let y = floor + CHEVRON_PITCH - travel;
    y > top - rise;
    y -= CHEVRON_PITCH
  ) {
    context.moveTo(inner.x, y + rise);
    context.lineTo(centre, y);
    context.lineTo(right, y + rise);
  }
  context.lineWidth = 1.25;
  context.lineJoin = 'miter';
  context.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  context.stroke();
  context.restore();
  drawTip(strip, top);
  drawPeakRule(strip);
};
