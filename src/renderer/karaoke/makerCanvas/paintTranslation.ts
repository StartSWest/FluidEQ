/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { KARAOKE_MAKER_LYRIC_LANE_COUNT } from '../makerCanvasLayout';
import { IMakerPlot } from '../makerCanvasGeometry';

// Mirrors `$weight-*` in _theme.scss. A canvas `font` string takes a plain
// number, not a Sass variable, so these two are the same scale spelled for a
// context that cannot import it — never a number this file invented, and
// never past $weight-bold (700), which is the ceiling this project measured
// at UI sizes before 800 turned into Segoe UI Black.
const CANVAS_WEIGHT_REGULAR = 400;
const CANVAS_WEIGHT_SEMIBOLD = 600;

/** Reused from `.karaoke-maker__lyrics-line-number` in Karaoke.scss: the same quiet secondary tone this app already uses for a line's own metadata. */
const TRANSLATION_TEXT_COLOR = 'rgba(169, 204, 216, .58)';
/** Reused from the "touched" word fill in paintLyrics.ts: this file's own established colour for "this is correct". */
const FIT_OK_COLOR = 'rgba(128, 241, 194, .9)';
/** Reused from the "voice" stem label in paintBackdrop.ts: this file family's own amber for "look at this". */
const FIT_MISMATCH_COLOR = 'rgba(255, 210, 150, .88)';

export interface IPaintTranslationLineInput {
  plot: IMakerPlot;
  lyricSectionTop: number;
  /** How tall one original lane is this frame — sets where this row starts. */
  lyricLaneHeight: number;
  /** This row's own height. Fixed — see TRANSLATION_LANE_HEIGHT. */
  laneHeight: number;
  /** The original line's own timed span; the translated sheet shares it. */
  lineStartMs: number;
  lineEndMs: number;
  text: string;
  fitLabel: string;
  fitOk: boolean;
}

/**
 * One translated line, drawn as a single quiet label under the original
 * lanes, with the syllable/note delta appended at its end.
 *
 * No per-word placement and no highlight: word order differs between
 * languages, so a highlight timed to the Nth original word would land on
 * whichever translated word happens to sit Nth, which is wrong more often
 * than right. This paints line-level text only, until the user has fitted it.
 *
 * The label is centred on the line's own timeline midpoint but is not
 * clipped to that line's width — a translation is routinely longer or
 * shorter than the words it replaces, and truncating it there would cut
 * sentences that ran long for no reason a reader could see. It is clamped to
 * the plot bounds instead, the same way an oversized section label already
 * is above it in paintLyrics.ts. Two translated lines whose timelines sit
 * close together can still overlap each other at a wide zoom; there is no
 * packing pass for this row, only for the original words above it.
 */
export const paintLyricTranslationLine = (
  context: CanvasRenderingContext2D,
  {
    plot,
    lyricSectionTop,
    lyricLaneHeight,
    laneHeight,
    lineStartMs,
    lineEndMs,
    text,
    fitLabel,
    fitOk,
  }: IPaintTranslationLineInput,
): void => {
  const { left: plotLeft, right: plotRight, timeX } = plot;
  const rawLeft = timeX(lineStartMs);
  const rawRight = timeX(lineEndMs);
  if (rawRight < plotLeft || rawLeft > plotRight) {
    return;
  }
  const centerY =
    lyricSectionTop +
    KARAOKE_MAKER_LYRIC_LANE_COUNT * lyricLaneHeight +
    laneHeight / 2;

  context.save();
  context.textBaseline = 'middle';
  context.font = `${CANVAS_WEIGHT_REGULAR} 11px Inter, system-ui, sans-serif`;
  const measuredWidth = context.measureText(text).width;
  const naturalCenterX = (rawLeft + rawRight) / 2;
  const centerX = Math.max(
    plotLeft + measuredWidth / 2 + 8,
    Math.min(plotRight - measuredWidth / 2 - 8, naturalCenterX),
  );
  context.textAlign = 'center';
  context.fillStyle = TRANSLATION_TEXT_COLOR;
  context.fillText(text, centerX, centerY);

  context.font = `${CANVAS_WEIGHT_SEMIBOLD} 10px Inter, system-ui, sans-serif`;
  const fitWidth = context.measureText(fitLabel).width;
  context.textAlign = 'left';
  context.fillStyle = fitOk ? FIT_OK_COLOR : FIT_MISMATCH_COLOR;
  const fitLeft = Math.max(
    plotLeft + 2,
    Math.min(plotRight - fitWidth - 4, centerX + measuredWidth / 2 + 10),
  );
  context.fillText(fitLabel, fitLeft, centerY);
  context.restore();
};
