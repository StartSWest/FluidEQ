/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { floorInk } from '../../utils/windowInk';
import { isLightWindow } from '../../utils/windowSide';
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
 * note numbers need to be seen too").
 *
 * The frequency names' own box reaches 20px over the foot (12px type lifted
 * 0.71em + 14px, `.chart-axis--inside-bottom`, measured in the window at 760
 * and 1600 wide), so a baseline 17px up stood inside it: the energy view's
 * BASS sat on "100 Hz" and MID on "500 Hz" with a pixel or two between them
 * (Ivan, 2026-11-27: "put the sub, bass, mid a bit more up so they don't
 * mess with the grid freq numbers"). The baseline now stands 26px up: the
 * names' 20px and 6px of air, which capitals and figures, having no
 * descenders, keep whole. The key over the row moves with it
 * (`LEGEND_FLOOR`, `channelInk.ts`).
 *
 * A wave hanging from the top prints them under its top edge instead, where
 * there are no frequency names.
 */
export const FOOT_WORD_LIFT = 26;

/** How tall a word on the row stands over its baseline, at most. */
export const FOOT_WORD_HEIGHT = 8;
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
 * How solid the key under a word is, and how far toward black a dark
 * window's is taken.
 */
export const FOOT_WORD_KEY_ALPHA = 0.75;
export const FOOT_WORD_KEY_DARKER = 0.6;

/**
 * The key a word is set on: the window's floor, so it is the far end of the
 * window's contrast from the ink every word here is written in (`readEdge`,
 * `readInk`) - dark under light letters on a dark window, the light floor
 * under dark ones on a light window - and the word reads over a bright bar
 * or a quiet gap alike.
 *
 * It was a near-black written in, which suited the dark window alone: on the
 * white one the ink turns dark too, and each name was dark letters in a dark
 * outline, a blob where a C should be (Ivan, 2026-11-27: "notes not visible
 * in white"). A dark window's floor is taken toward black, where the old key
 * stood; a light window's is the floor itself, since even the share of
 * darkening a light window keeps (`floorDarkening`) turned it into a grey
 * smudge round each name over a deep bar.
 */
export const footWordKey = (): string =>
  floorInk(FOOT_WORD_KEY_ALPHA, isLightWindow() ? 0 : FOOT_WORD_KEY_DARKER);

/**
 * A word set over the window's own key (`footWordKey`), the stroke painted
 * under the fill, so it reads over whatever the view drew beneath it.
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
  context.strokeStyle = footWordKey();
  context.strokeText(text, x, y);
  context.fillStyle = ink;
  context.fillText(text, x, y);
};
