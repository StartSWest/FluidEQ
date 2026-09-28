/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { LEVEL_FLOOR_DB, LEVEL_HOT_DB, levelFraction } from '../outputLevel';
import { ZONE_COLOURS } from './meterPaint';

/**
 * What the meter prints round its strips — the scale, the channel letters,
 * the style's name — drawn once onto a sheet outside the page and copied
 * onto every frame until one of them changes (`OutputLevelMeter.tsx`).
 */

/** The dB marks the strips are read against, on either side of the pair. */
const SCALE_GAP = 5;
const SCALE_MARKS: readonly number[] = [0, -6, -12, -20, -30, -40, -60];

/**
 * A ruled scale beside the strips: ticks at the marks above, every one
 * labelled, placed with the same `levelFraction` the strips are drawn with so
 * a label sits exactly where a reading of that value would reach. The ceiling
 * is written in the over colour — it is the one number here that is a limit
 * rather than a place.
 *
 * Drawn on both sides of the pair, ticks pointing in at the strips, so the
 * strips stay centred in the well: with a scale on one side only the pair
 * sat off to the left, which Ivan read as the meter being off-centre before
 * he read the numbers.
 */
const drawScale = (
  context: CanvasRenderingContext2D,
  frame: { x: number; y: number; height: number },
  side: 'left' | 'right',
  ink: string,
  // A ladder's lamp count: the marks then sit on the lamp nearest each
  // value rather than between two.
  rows?: number,
) => {
  const direction = side === 'right' ? 1 : -1;
  const snap = (y: number) => {
    if (!rows) {
      return y;
    }
    const pitch = frame.height / rows;
    const row = Math.max(
      0,
      Math.min(
        rows - 1,
        Math.round((frame.y + frame.height - y) / pitch - 0.5),
      ),
    );
    return frame.y + frame.height - (row + 0.5) * pitch;
  };
  context.save();
  context.font = '700 8px system-ui, sans-serif';
  context.textAlign = side === 'right' ? 'left' : 'right';
  context.textBaseline = 'middle';
  context.lineWidth = 1;
  SCALE_MARKS.forEach((db) => {
    const y =
      Math.round(snap(frame.y + (1 - levelFraction(db)) * frame.height)) + 0.5;
    const isMajor = db === 0 || db === LEVEL_HOT_DB || db === LEVEL_FLOOR_DB;
    context.globalAlpha = 0.3;
    context.strokeStyle = ink;
    context.beginPath();
    context.moveTo(frame.x, y);
    context.lineTo(frame.x + direction * (isMajor ? 5 : 3), y);
    context.stroke();
    context.globalAlpha = db === 0 ? 0.95 : 0.6;
    context.fillStyle = db === 0 ? ZONE_COLOURS.over : ink;
    context.fillText(db === 0 ? '0' : String(db), frame.x + direction * 8, y);
  });
  context.restore();
};

/**
 * The style's name as a small chip under the strips: a pill with the name
 * in it, in the same quiet ink as the scale. It was bare 11px capitals, the
 * loudest text in the column for the one thing there that is furniture.
 */
const drawStyleChip = (
  context: CanvasRenderingContext2D,
  name: string,
  centreX: number,
  bottomY: number,
  ink: string,
) => {
  context.save();
  context.font = '700 8px system-ui, sans-serif';
  if ('letterSpacing' in context) {
    context.letterSpacing = '1px';
  }
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  const width = context.measureText(name).width + 14;
  const height = 14;
  const x = centreX - width / 2;
  const y = bottomY - height;
  context.beginPath();
  context.roundRect(x, y, width, height, height / 2);
  context.globalAlpha = 0.06;
  context.fillStyle = ink;
  context.fill();
  context.globalAlpha = 0.22;
  context.strokeStyle = ink;
  context.lineWidth = 1;
  context.stroke();
  context.globalAlpha = 0.7;
  context.fillStyle = ink;
  context.fillText(name, centreX, y + height / 2 + 0.5);
  context.restore();
};

/** Everything the meter prints around its strips, in CSS pixels of its box. */
export interface IMeterPrint {
  boxWidth: number;
  boxHeight: number;
  startX: number;
  totalWidth: number;
  channelWidth: number;
  channelGap: number;
  rectY: number;
  rectHeight: number;
  /**
   * Absent for a style with no scale, and while the meter is off; `rows` is
   * a ladder's lamp count, which the marks snap to.
   */
  scale: { rows: number | undefined } | undefined;
  letters: readonly string[];
  /** Absent while the meter is off. */
  styleName: string | undefined;
  ink: string;
}

/**
 * The scale, the channel letters and the style chip, in the order the frame
 * used to draw them after the strips.
 */
export const drawMeterPrint = (
  context: CanvasRenderingContext2D,
  print: IMeterPrint,
) => {
  if (print.scale) {
    const { rows } = print.scale;
    drawScale(
      context,
      {
        x: print.startX - SCALE_GAP,
        y: print.rectY,
        height: print.rectHeight,
      },
      'left',
      print.ink,
      rows,
    );
    drawScale(
      context,
      {
        x: print.startX + print.totalWidth + SCALE_GAP,
        y: print.rectY,
        height: print.rectHeight,
      },
      'right',
      print.ink,
      rows,
    );
  }

  // The channel letters above each strip. Drawn in canvas rather than
  // as DOM so the whole meter is one image and the labels track the
  // channel rects exactly.
  context.font = '700 8px system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'top';
  context.fillStyle = print.ink;
  print.letters.forEach((letter, i) => {
    const cx =
      print.startX +
      i * (print.channelWidth + print.channelGap) +
      print.channelWidth / 2;
    context.fillText(letter, cx, 1);
  });

  /**
   * The style's name, centred under the strips and always there.
   *
   * It used to appear for two seconds after a click and fade out. That is
   * the wrong shape for this control: the meter is cycled by clicking the
   * meter itself, with nothing else on it to say what the current style
   * is, so a label that leaves means the only way to find out is to click
   * again and change the thing you were asking about.
   *
   * Quiet enough to be furniture rather than a reading — it names the
   * instrument, it is not part of what the instrument says.
   */
  if (print.styleName !== undefined) {
    drawStyleChip(
      context,
      print.styleName,
      print.boxWidth / 2,
      print.boxHeight - 3,
      print.ink,
    );
  }
};
