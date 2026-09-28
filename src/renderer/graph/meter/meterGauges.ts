/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { fillBetween, zoneColour } from './meterPaint';
import { type IStrip, drawPeakRule, drawTip, heightAt } from './meterStrip';

/**
 * The two styles that are instruments rather than columns: a pointer on a
 * ruled scale, and a display of scan lines with a pulse running up it.
 */

/** The scale's ink: the slot's hairline, a step stronger to read as print. */
const TICK_INK = 'rgba(214, 233, 247, 0.32)';
const TICKS = 20;

/**
 * A pointer against a ruled scale — the one style that shows a position
 * rather than a quantity. Longer ticks every fifth mark, as a printed scale
 * has them, so the eye has anchors rather than a comb; the column under the
 * pointer is lit a shade under full strength, so the pointer stays the thing
 * to read and the colour still reads at a glance — at a third it was a wash
 * nobody could see (Ivan, 2026-09-26: "its color more visible").
 * It used to drift a haze of six colours through the tube, a nebula that
 * read as grain.
 */
export const drawNeedle = (strip: IStrip) => {
  const { pen, inner, body, channel } = strip;
  const { context } = pen;
  const floor = inner.y + inner.height;
  const right = inner.x + inner.width;
  const pointer = heightAt(strip, channel.level);

  if (floor - pointer > 0) {
    context.globalAlpha = 0.72;
    context.fillStyle = body;
    fillBetween(pen, inner.x, pointer, right, floor);
    context.globalAlpha = 1;
  }

  context.fillStyle = TICK_INK;
  for (let tick = 0; tick <= TICKS; tick += 1) {
    const y = pen.px(floor - (tick * inner.height) / TICKS);
    const length = inner.width * (tick % 5 === 0 ? 0.55 : 0.3);
    fillBetween(pen, inner.x, y - pen.hair, inner.x + length, y);
  }

  drawPeakRule(strip);
  const ink = zoneColour(channel.zone);
  context.fillStyle = ink;
  fillBetween(pen, inner.x, pointer, right, pointer + 2);
  const head = Math.max(3, inner.width * 0.45);
  context.beginPath();
  context.moveTo(inner.x, pointer - 3);
  context.lineTo(inner.x + head, pointer + 1);
  context.lineTo(inner.x, pointer + 5);
  context.closePath();
  context.fill();
};

/** The scan lines' pitch and the pulse's half-height, in CSS pixels. */
const SCAN_PITCH = 3;
const PULSE_REACH = 16;

/**
 * Scan lines, lit up to the level, with a pulse travelling up the lit part.
 *
 * A vacuum-fluorescent display: every line is drawn, lit ones in the ramp
 * and dark ones in the unlit colour, so the strip is a panel whether or not
 * anything plays. The pulse is a band of brighter lines climbing from the
 * floor to the level, faster as the level rises — the only thing on it that
 * moves by itself, and one that says how hard the sound is pushing. The
 * sparks it used to throw had no edge, and a meter needs one.
 */
export const drawPulse = (strip: IStrip) => {
  const { pen, inner, body, channel, unlit } = strip;
  const { context } = pen;
  const floor = inner.y + inner.height;
  const right = inner.x + inner.width;
  const pitch = Math.max(2 * pen.hair, pen.px(SCAN_PITCH));
  const thickness = Math.max(pen.hair, pen.px(2));
  const rows = Math.floor(inner.height / pitch);
  const top = heightAt(strip, channel.level);
  const lit = floor - top;
  const speed = 0.00045 + channel.level * 0.0011;
  const pulse = floor - lit * ((pen.now * speed) % 1);
  const glint = zoneColour('safe');

  for (let row = 0; row < rows; row += 1) {
    const lineBottom = pen.px(floor - row * pitch);
    const lineTop = lineBottom - thickness;
    const isLit = lineTop >= top;
    context.fillStyle = isLit ? body : unlit;
    fillBetween(pen, inner.x, lineTop, right, lineBottom);
    if (isLit) {
      const nearness = 1 - Math.abs(lineTop - pulse) / PULSE_REACH;
      if (nearness > 0) {
        context.globalAlpha = 0.85 * nearness;
        context.fillStyle = glint;
        fillBetween(pen, inner.x, lineTop, right, lineBottom);
        context.globalAlpha = 1;
      }
    }
  }
  drawTip(strip, top);
  drawPeakRule(strip);
};
