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
import { readTextInk } from '../../utils/theme';
import {
  COMPACT_LYRIC_LANE_HEIGHT,
  IMakerPlot,
  WORD_BOUNDARY_HANDLE_REACH,
} from '../makerCanvasGeometry';
import {
  ICanvasLyricWord,
  IMakerCanvasTranslationRow,
} from '../makerCanvasTypes';
// The corrected stack, not the one the painters around this file still carry:
// Inter has never been bundled, so naming it resolves to nothing and every
// size here would have been tuned against a font that was never on screen.
// `check-styles.ts` reads stylesheets and cannot see a font named in
// TypeScript, which is why this went unnoticed there for the life of the
// project. The sibling that paints this same row in the player
// (`karaokeLyricsTranslation.tsx`) already reaches for exactly this.
import { LYRIC_FONT_FAMILY } from '../karaokeLyricText';

// The last original lane's boundary-drag hit region is a fixed touch
// target (WORD_BOUNDARY_HANDLE_REACH, see makerCanvasGeometry.ts) — not a
// fraction of the lane pitch, so it does not shrink with lyricLaneHeight the
// way the word box above it does. That means it reaches further past this
// row's own top edge the shorter the original lane is: REACH - height / 2,
// which is worst (10px) at COMPACT_LYRIC_LANE_HEIGHT and never worse than
// that, since that constant is the smallest lyricLaneHeight is ever set to.
// Reserved always, not recomputed per frame from the actual lyricLaneHeight,
// so this row's text sits at one fixed position rather than shifting when
// the window crosses the small-window breakpoint.
const CLEARANCE_TOP =
  WORD_BOUNDARY_HANDLE_REACH - COMPACT_LYRIC_LANE_HEIGHT / 2;

// Mirrors `$weight-*` in _theme.scss. A canvas `font` string takes a plain
// number, not a Sass variable, so these two are the same scale spelled for a
// context that cannot import it — never a number this file invented, and
// never past $weight-bold (700), which is the ceiling this project measured
// at UI sizes before 800 turned into Segoe UI Black.
const CANVAS_WEIGHT_REGULAR = 400;
const CANVAS_WEIGHT_SEMIBOLD = 600;

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
  const rowTop =
    lyricSectionTop + KARAOKE_MAKER_LYRIC_LANE_COUNT * lyricLaneHeight;
  // Centred in the leftover space below CLEARANCE_TOP, not in the row's
  // full height — the row's own top is reserved, empty, so a click on this
  // (non-interactive) text never lands on the previous lane's boundary
  // handle instead. See TRANSLATION_LANE_HEIGHT in makerCanvasGeometry.ts
  // for why the leftover is enough room for one line of this row's text.
  const centerY = rowTop + CLEARANCE_TOP + (laneHeight - CLEARANCE_TOP) / 2;

  context.save();
  context.textBaseline = 'middle';
  context.font = `${CANVAS_WEIGHT_REGULAR} 11px ${LYRIC_FONT_FAMILY}`;
  const measuredWidth = context.measureText(text).width;
  const naturalCenterX = (rawLeft + rawRight) / 2;
  const centerX = Math.max(
    plotLeft + measuredWidth / 2 + 8,
    Math.min(plotRight - measuredWidth / 2 - 8, naturalCenterX),
  );
  context.textAlign = 'center';
  context.fillStyle = readTextInk();
  context.fillText(text, centerX, centerY);

  context.font = `${CANVAS_WEIGHT_SEMIBOLD} 10px ${LYRIC_FONT_FAMILY}`;
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

export interface IPaintTranslationRowInput {
  plot: IMakerPlot;
  lyricSectionTop: number;
  lyricLaneHeight: number;
  translationRow: IMakerCanvasTranslationRow;
  /** The same words paintLyrics.ts just painted, in the same view window. */
  layoutWords: readonly ICanvasLyricWord[];
}

/**
 * Every visible line's translation, once each.
 *
 * `layoutWords` is per-word, not per-line — a line's own words can zigzag
 * across all three original lanes above, but its translation is one label,
 * so the first word of a line seen here is enough to draw it and every
 * later word of the same line is skipped. Kept out of paintLyrics.ts, which
 * already does the per-word painting this reads its input from, so that
 * file stays under its own line ceiling.
 */
export const paintLyricTranslationRow = (
  context: CanvasRenderingContext2D,
  {
    plot,
    lyricSectionTop,
    lyricLaneHeight,
    translationRow,
    layoutWords,
  }: IPaintTranslationRowInput,
): void => {
  const paintedLines = new Set<number>();
  layoutWords.forEach((word) => {
    if (paintedLines.has(word.lineIndex)) {
      return;
    }
    paintedLines.add(word.lineIndex);
    const line = translationRow.lines.get(word.lineIndex);
    if (!line) {
      return;
    }
    paintLyricTranslationLine(context, {
      plot,
      lyricSectionTop,
      lyricLaneHeight,
      laneHeight: translationRow.laneHeight,
      lineStartMs: word.lineStartMs,
      lineEndMs: word.lineEndMs,
      text: line.text,
      fitLabel: line.fitLabel,
      fitOk: line.fitOk,
    });
  });
};
