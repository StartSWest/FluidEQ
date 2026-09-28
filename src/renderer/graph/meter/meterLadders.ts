/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import {
  SEGMENT_ROWS,
  STACK_ROWS,
  ZONE_COLOURS,
  fillBetween,
  ledRows,
  zoneColour,
} from './meterPaint';
import type { IStrip } from './meterStrip';

/**
 * The styles that count the level in pieces: a panel of thin lamps, a
 * column of round LEDs, and a leaning pile of slabs. Every piece is drawn,
 * lit or not, so the strip is an instrument of which some pieces are on; on
 * the two ladders the peak is held as one lamp in its zone's colour, told in
 * the ladder's own language instead of by a rule across it.
 */

/** Which lamps are on, and which one holds the peak. */
const ladderCounts = (strip: IStrip, rows: number) => {
  const lit = Math.round(strip.channel.level * rows);
  const peak = Math.round(strip.channel.peak * rows) - 1;
  return { lit, peak: peak >= lit && peak < rows ? peak : -1 };
};

/** A lamp's own colour: lit, holding the peak, or off. */
const lampPaint = (
  strip: IStrip,
  row: number,
  counts: { lit: number; peak: number },
): string | CanvasGradient => {
  if (row < counts.lit) {
    return strip.lamps;
  }
  if (row === counts.peak) {
    return zoneColour(strip.channel.peakZone);
  }
  return strip.unlit;
};

/**
 * Rows of lamps with square corners on whole pixels, a clear gap between
 * each, and one pixel of slot round the panel — sharp edges and nothing
 * soft (Ivan, 2026-09-26: "I like sharp and clean border").
 */
export const drawSegments = (strip: IStrip) => {
  const { pen, inner } = strip;
  const rows = SEGMENT_ROWS;
  const pitch = inner.height / rows;
  const gap = Math.max(pen.hair, pen.px(pitch * 0.24));
  const floor = inner.y + inner.height;
  const left = inner.x + 1;
  const right = inner.x + inner.width - 1;
  const counts = ladderCounts(strip, rows);
  for (let row = 0; row < rows; row += 1) {
    pen.context.fillStyle = lampPaint(strip, row, counts);
    fillBetween(
      pen,
      left,
      pen.px(floor - (row + 1) * pitch) + gap / 2,
      right,
      pen.px(floor - row * pitch) - gap / 2,
    );
  }
};

/**
 * Round LEDs, as many as the strip holds at a pitch where each keeps air
 * round it: a fixed count on a short meter squashed them into ellipses.
 * A clipped channel lights its top LED red, the one mark on an LED ladder
 * that cannot be missed.
 */
export const drawLeds = (strip: IStrip) => {
  const { pen, inner, channel } = strip;
  const { context } = pen;
  const rows = ledRows(inner.height);
  const pitch = inner.height / rows;
  const radius = Math.max(2.5, Math.min(7, inner.width / 2 - 2, pitch / 2 - 2));
  const centre = inner.x + inner.width / 2;
  const floor = inner.y + inner.height;
  const counts = ladderCounts(strip, rows);
  for (let row = 0; row < rows; row += 1) {
    context.fillStyle =
      row === rows - 1 && channel.peakZone === 'clip'
        ? ZONE_COLOURS.clip
        : lampPaint(strip, row, counts);
    context.beginPath();
    context.arc(centre, floor - (row + 0.5) * pitch, radius, 0, Math.PI * 2);
    context.fill();
  }
};

/** The unlit slabs' hairline, so an empty pile reads as blocks waiting. */
const SLAB_RIM = 'rgba(214, 233, 247, 0.2)';

/**
 * Slabs piled up, leaning as though the pile is about to go over — and
 * moving: the lean breathes with the level, the one ladder that says how
 * hard the sound is pushing as well as how high it reaches (Ivan,
 * 2026-09-26: "my stacks that was moving put that back").
 *
 * Full-width slabs with a lit top face: a solid seen slightly from above is
 * a cap and a body a shade darker, and a pile of those reads as objects
 * resting on each other. It stands in no slot, because a pile that leans
 * past the edges of a box it is supposed to be inside reads as a mistake.
 */
export const drawStack = (strip: IStrip) => {
  const { pen, rect, channel, body, unlit } = strip;
  const { context } = pen;
  const rows = STACK_ROWS;
  const pitch = rect.height / rows;
  const gap = Math.max(pen.hair, pen.px(pitch * 0.22));
  const floor = rect.y + rect.height;
  const lit = Math.round(channel.level * rows);

  /**
   * How far the top of the pile is pushed, in fractions of the strip width.
   * Two waves at unrelated periods so the lean never settles into a
   * metronome, plus a small idle sway: a pile that stands perfectly still in
   * silence reads as bolted down, and this one only just balances.
   */
  const push =
    (Math.sin(pen.now * 0.00097) * 0.62 +
      Math.sin(pen.now * 0.00231 + 1.7) * 0.38) *
    (0.06 + channel.level * 0.44);
  /**
   * Slabs near the floor barely move and the top ones travel most, which is
   * how a pile pushed sideways fails — the power curve makes it lean rather
   * than slide as one block. Sideways the slabs move smoothly, never
   * snapped, or the lean would tick a pixel at a time; their tops and feet
   * stay on whole pixels.
   */
  const leanAt = (row: number) =>
    push * rect.width * (row / Math.max(1, rows - 1)) ** 1.6;
  const topAt = (row: number) => pen.px(floor - (row + 1) * pitch) + gap / 2;
  const footAt = (row: number) => pen.px(floor - row * pitch) - gap / 2;

  for (let row = lit; row < rows; row += 1) {
    const x = rect.x + leanAt(row);
    const top = pen.px(topAt(row));
    const height = Math.max(pen.hair, pen.px(footAt(row)) - top);
    context.fillStyle = unlit;
    context.fillRect(x, top, rect.width, height);
    context.strokeStyle = SLAB_RIM;
    context.lineWidth = pen.hair;
    context.strokeRect(
      x + pen.hair / 2,
      top + pen.hair / 2,
      rect.width - pen.hair,
      height - pen.hair,
    );
  }
  context.fillStyle = body;
  for (let row = 0; row < lit; row += 1) {
    const x = rect.x + leanAt(row);
    const top = pen.px(topAt(row));
    const height = Math.max(pen.hair, pen.px(footAt(row)) - top);
    const cap = Math.max(pen.hair, pen.px(height * 0.34));
    // The body a shade down, so the cap reads as a lit face rather than
    // as part of one flat block.
    context.globalAlpha = 0.55;
    context.fillRect(x, top + cap, rect.width, height - cap);
    context.globalAlpha = 1;
    context.fillRect(x, top, rect.width, cap);
  }
};
