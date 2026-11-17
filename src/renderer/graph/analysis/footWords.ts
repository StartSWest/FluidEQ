/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IAnalysisBand, IAnalysisPlot } from './analysisFrame';

/**
 * The row the measuring views print their words along: the note spectrum's
 * octave Cs and the energy view's band names.
 *
 * One row above the frequency names, never on them. The graph names its
 * frequencies inside the plot's foot, on the baseline of the side scales'
 * corner figures, 3px above the floor (`_graphThemeChart.scss`), and the Cs
 * were printed in that same strip at 9px and a fifth of white's strength:
 * crossed by the names and too faint to find (Ivan, 2026-11-17: "the graph
 * note numbers need to be seen too"). Their baseline now stands 17px above a
 * figure's foot — the names' 3px, their 12px, and 2px of air over their
 * tops — so the two rows cannot meet at any width.
 *
 * A wave hanging from the top prints them under its top edge instead, where
 * there are no frequency names.
 */
const FOOT_WORD_LIFT = 17;
const HUNG_WORD_DROP = 3;

/**
 * How far in from each side a word may reach: clear of the side scales'
 * figures, which stand 9px in and are about 45px wide ("−60 dB"), with air.
 */
const SIDE_COLUMN = 64;

/** Air between two words on the row. */
const WORD_AIR = 8;

/** The y a word's baseline stands on, and the baseline it is set to. */
export const footWordLine = (
  band: IAnalysisBand,
): { y: number; baseline: CanvasTextBaseline } =>
  band.flipped
    ? { y: band.top + HUNG_WORD_DROP, baseline: 'top' }
    : { y: band.bottom - FOOT_WORD_LIFT, baseline: 'alphabetic' };

let family: string | undefined;

/**
 * The window's own face, read once from the document: the canvas has no
 * stylesheet, and `system-ui` is not a family this app names anywhere else
 * (`$font-ui`).
 */
export const footWordFont = (weight: number, size: number): string => {
  family ??= getComputedStyle(document.body).fontFamily;
  return `${weight} ${size}px ${family}`;
};

/**
 * Whether a word `width` wide centred on `x` stays clear of the side
 * columns and of every word already placed, and if so places it.
 */
export const placeFootWord = (
  plot: IAnalysisPlot,
  placed: { from: number; to: number }[],
  x: number,
  width: number,
): boolean => {
  const from = x - width / 2;
  const to = x + width / 2;
  if (from < plot.left + SIDE_COLUMN || to > plot.right - SIDE_COLUMN) {
    return false;
  }
  const clear = placed.every(
    (other) => from >= other.to + WORD_AIR || to <= other.from - WORD_AIR,
  );
  if (clear) {
    placed.push({ from, to });
  }
  return clear;
};

/**
 * A word keyed in dark under its fill, as the scales' figures are
 * (`.chart-axis--inside text`), so it reads over a bright bar, a scene or a
 * light theme's paper alike.
 */
export const paintKeyedWord = (
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  ink: string,
): void => {
  context.lineJoin = 'round';
  context.lineWidth = 3;
  context.strokeStyle = 'rgba(2, 8, 15, 0.75)';
  context.strokeText(text, x, y);
  context.fillStyle = ink;
  context.fillText(text, x, y);
};
