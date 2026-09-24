/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { rampRgba, type IAnalysisFrame } from './analysisFrame';

/**
 * Telling the two channels apart.
 *
 * Drawn one in front of the other at two opacities, they were two versions of
 * the same picture and nobody could say which was which (Ivan, 2026-09-23:
 * "on left and right how I know which is which", "different colors for each
 * channel"). So the right channel is painted in a TURNED copy of the look's
 * own colours, and both are named in a small legend on the plot.
 *
 * Turned rather than replaced, because the palette belongs to the look: a
 * fixed second colour would fight every set of stops somebody chose, while a
 * rotation of their own hues stays in the family they picked whatever it is.
 */

/** How far round the wheel the right channel's copy is turned. */
const MATE_TURN = 155;

const readHex = (colour: string): [number, number, number] => {
  const digits = colour.startsWith('#') ? colour.slice(1) : colour;
  const full =
    digits.length === 3
      ? digits
          .split('')
          .map((digit) => digit + digit)
          .join('')
      : digits.padEnd(6, '0').slice(0, 6);
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
};

const toHex = (value: number) =>
  Math.max(0, Math.min(255, Math.round(value)))
    .toString(16)
    .padStart(2, '0');

/**
 * The same colour with its hue turned by `degrees`.
 *
 * Through HSL rather than by mixing in a second colour: mixing moves the
 * lightness as well, so a dark stop and a light one in the same ramp come
 * back at different distances from where they started and the gradient stops
 * being the gradient somebody chose.
 */
const turnHue = (colour: string, degrees: number): string => {
  const [red, green, blue] = readHex(colour).map((channel) => channel / 255);
  const highest = Math.max(red, green, blue);
  const lowest = Math.min(red, green, blue);
  const light = (highest + lowest) / 2;
  const span = highest - lowest;
  if (span === 0) {
    // A grey has no hue to turn, so it is returned as it came: anything else
    // would invent a colour the look does not contain.
    return colour;
  }
  const saturation =
    light > 0.5 ? span / (2 - highest - lowest) : span / (highest + lowest);
  let hue: number;
  if (highest === red) {
    hue = (green - blue) / span + (green < blue ? 6 : 0);
  } else if (highest === green) {
    hue = (blue - red) / span + 2;
  } else {
    hue = (red - green) / span + 4;
  }
  hue = ((hue * 60 + degrees) % 360) / 360;
  const q =
    light < 0.5
      ? light * (1 + saturation)
      : light + saturation - light * saturation;
  const p = 2 * light - q;
  const channelAt = (at: number) => {
    let shifted = at;
    if (shifted < 0) {
      shifted += 1;
    }
    if (shifted > 1) {
      shifted -= 1;
    }
    if (shifted < 1 / 6) {
      return p + (q - p) * 6 * shifted;
    }
    if (shifted < 1 / 2) {
      return q;
    }
    if (shifted < 2 / 3) {
      return p + (q - p) * (2 / 3 - shifted) * 6;
    }
    return p;
  };
  return `#${toHex(channelAt(hue + 1 / 3) * 255)}${toHex(
    channelAt(hue) * 255,
  )}${toHex(channelAt(hue - 1 / 3) * 255)}`;
};

/** The right channel's copy of a look's stops. */
export const mateColours = (colours: readonly string[]): readonly string[] =>
  colours.map((colour) => turnHue(colour, MATE_TURN));

/** How tall the legend's text is, and how much room the chip leaves round it. */
const LEGEND_TEXT = 11;
const LEGEND_PAD = 5;
const LEGEND_SWATCH = 9;
const LEGEND_GAP = 7;

/** One thing a key names, and the colour it is drawn in. */
export interface ILegendEntry {
  label: string;
  ink: string;
}

/**
 * The legend: a swatch and a word for each reading, on the plot.
 *
 * On the plot rather than beside it because this canvas is the whole drawing
 * — there is no room outside it that belongs to this view — and pinned to the
 * top-left corner, which is the one part of the plot a spectrum never
 * reaches: the bass is on the left and the readings fall away from the top.
 */
export const paintLegend = (
  frame: IAnalysisFrame,
  entries: readonly ILegendEntry[],
): void => {
  const { context, plot, band } = frame;
  const chips = entries;
  context.save();
  context.font = `600 ${LEGEND_TEXT}px system-ui, sans-serif`;
  context.textBaseline = 'middle';
  context.textAlign = 'left';
  const widths = chips.map(
    (chip) =>
      LEGEND_SWATCH + LEGEND_GAP * 0.6 + context.measureText(chip.label).width,
  );
  const height = LEGEND_TEXT + LEGEND_PAD * 2;
  const width =
    widths.reduce((total, one) => total + one, 0) +
    LEGEND_GAP * 2 +
    LEGEND_PAD * 2;
  const left = plot.left + 10;
  const top = Math.min(band.top, plot.top) + 8;
  context.globalAlpha = band.opacity * 0.9;
  // A recessed block, the same idea as the app's own: dark, barely there, so
  // the letters read over any drawing without hiding a decibel of it.
  context.fillStyle = 'rgba(8, 12, 18, 0.62)';
  context.beginPath();
  context.roundRect(left, top, width, height, height / 2);
  context.fill();
  context.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  context.lineWidth = 1;
  context.stroke();
  let at = left + LEGEND_PAD + LEGEND_GAP / 2;
  chips.forEach((chip, index) => {
    const middle = top + height / 2;
    context.fillStyle = chip.ink;
    context.beginPath();
    context.roundRect(
      at,
      middle - LEGEND_SWATCH / 2,
      LEGEND_SWATCH,
      LEGEND_SWATCH,
      2.5,
    );
    context.fill();
    context.fillStyle = 'rgba(255, 255, 255, 0.92)';
    context.fillText(
      chip.label,
      at + LEGEND_SWATCH + LEGEND_GAP * 0.6,
      middle + 0.5,
    );
    at += widths[index] + LEGEND_GAP;
  });
  context.restore();
  context.globalAlpha = 1;
};

/** The two channels, named and swatched in their own colours. */
export const paintChannelLegend = (
  frame: IAnalysisFrame,
  labels: readonly [string, string],
): void =>
  paintLegend(frame, [
    { label: labels[0], ink: rampRgba(frame.colours, 0.75, 1) },
    { label: labels[1], ink: rampRgba(frame.mate, 0.75, 1) },
  ]);

/** The same frame, painted in the other channel's colours. */
export const asMate = (frame: IAnalysisFrame): IAnalysisFrame => ({
  ...frame,
  colours: frame.mate,
});
