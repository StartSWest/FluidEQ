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

import { MutableRefObject } from 'react';
import {
  IKaraokeMakerProject,
  karaokeMakerTokenWasUserTouched,
} from '../../../common/karaoke/makerProject';
import {
  karaokeMakerLyricFocus,
  karaokeMakerWordProgress,
  layoutKaraokeMakerAnchoredLyricLabels,
} from '../makerCanvasLayout';
import {
  IHitRegion,
  IMakerPlot,
  TMakerDragBehavior,
  WORD_BOUNDARY_HANDLE_REACH,
  drawRoundedRect,
} from '../makerCanvasGeometry';
import {
  ICanvasLyricWord,
  IMakerCanvasTranslationRow,
} from '../makerCanvasTypes';
import { TSelection } from '../useKaraokeMakerSelection';
import { paintLyricTranslationRow } from './paintTranslation';

export interface IPaintLyricsInput {
  plot: IMakerPlot;
  lyricSectionTop: number;
  /** How tall one original lane is this frame — see useMakerCanvasModel.ts. */
  lyricLaneHeight: number;
  /** Undefined when no translation is selected for this project. */
  translationRow?: IMakerCanvasTranslationRow;
  project: IKaraokeMakerProject;
  canvasLyricWords: ICanvasLyricWord[];
  selection: TSelection;
  activeLyricFocus: ReturnType<typeof karaokeMakerLyricFocus>;
  activeLyricWordId?: string;
  hoveredEditHandle?: {
    kind: 'word' | 'note';
    id: string;
    behavior: TMakerDragBehavior;
  };
  viewStartMs: number;
  visibleViewDurationMs: number;
  visualPlayheadMs: number;
  wordFocusAnimationRef: MutableRefObject<{
    tokenId?: string;
    startedAt: number;
  }>;
}

/**
 * The words: packed into lanes, drawn, and made grabbable.
 *
 * The largest layer, and the one everything after it depends on — packing
 * decides which lane a word occupies, and a note's position is read from the
 * word it belongs to. That ordering is why this cannot simply be reordered
 * with the notes layer.
 *
 * It returns its hit regions rather than pushing into an array the caller owns.
 * Two lists, because they are not interchangeable: boundary handles must win
 * hit-testing over the wider word and underline regions behind them, so the
 * caller appends them after. Handing back one merged list would lose that
 * ordering, and handing back a mutated parameter would hide it.
 */
export const paintLyrics = (
  context: CanvasRenderingContext2D,
  {
    plot,
    lyricSectionTop,
    lyricLaneHeight,
    translationRow,
    project,
    canvasLyricWords,
    selection,
    activeLyricFocus,
    activeLyricWordId,
    hoveredEditHandle,
    viewStartMs,
    visibleViewDurationMs,
    visualPlayheadMs,
    wordFocusAnimationRef,
  }: IPaintLyricsInput,
): { regions: IHitRegion[]; wordBoundaryRegions: IHitRegion[] } => {
  const { left: plotLeft, right: plotRight, width: plotWidth, timeX } = plot;
  const regions: IHitRegion[] = [];
  const wordBoundaryRegions: IHitRegion[] = [];
  // Every vertical offset below that boxes or clips a word is written as a
  // fraction of this, not as an absolute pixel count. Before lyricLaneHeight
  // could vary at the small window size (see useMakerCanvasModel.ts) they
  // were hardcoded against the old fixed LYRIC_LANE_HEIGHT (26, so
  // laneHalf === 13) — a box or hit region left at that old absolute size
  // once the lane shrinks is the identical defect this task exists to
  // prevent, one layer in from where the budget itself is decided.
  const laneHalf = lyricLaneHeight / 2;

  // Keep a full viewport of labels on both sides in the packing pass. Small
  // pans and follow motion then retain the same neighbours and lane choices
  // instead of changing the set at each screen edge.
  const layoutWords = canvasLyricWords.filter(
    (word) =>
      word.endMs >= viewStartMs - visibleViewDurationMs &&
      word.startMs <= viewStartMs + visibleViewDurationMs * 2,
  );
  const lyricLabels = layoutWords.map((word) => {
    let labelFont = '650 13px Inter, system-ui, sans-serif';
    const selected = word.syllables.some(
      ({ token }) => selection?.kind === 'word' && selection.id === token.id,
    );
    if (word.isSection) {
      labelFont = '800 11px Inter, system-ui, sans-serif';
    } else if (selected) {
      labelFont = '750 14px Inter, system-ui, sans-serif';
    }
    context.font = labelFont;
    const measuredWidth = context.measureText(word.text).width;
    const labelWidth = Math.max(34, measuredWidth + 18);
    const rawLeft = timeX(word.startMs);
    const rawRight = timeX(word.endMs);
    const naturalCenterX = (rawLeft + rawRight) / 2;
    return {
      id: word.id,
      naturalLeft: naturalCenterX - labelWidth / 2,
      width: labelWidth,
      preferredLane: word.wordIndex % 3,
      word,
      measuredWidth,
      rawLeft,
      rawRight,
    };
  });
  const placedLyricLabels = new Map(
    layoutKaraokeMakerAnchoredLyricLabels(
      lyricLabels,
      plotLeft - plotWidth,
      plotRight + plotWidth,
      3,
      12,
      true,
    ).map((label) => [label.id, label]),
  );
  const lyricLabelData = new Map(lyricLabels.map((label) => [label.id, label]));
  layoutWords.forEach((word) => {
    const label = placedLyricLabels.get(word.id);
    if (!label) {
      return;
    }
    const lyricLabel = lyricLabelData.get(word.id);
    if (!lyricLabel) {
      return;
    }
    const { rawLeft, rawRight, measuredWidth } = lyricLabel;
    if (rawRight < plotLeft || rawLeft > plotRight) {
      return;
    }
    const timingLeft = Math.max(plotLeft, rawLeft);
    const timingRight = Math.max(timingLeft + 3, Math.min(plotRight, rawRight));
    const selected = word.syllables.some(
      ({ token }) => selection?.kind === 'word' && selection.id === token.id,
    );
    const userTouched = word.syllables.every(({ token }) =>
      karaokeMakerTokenWasUserTouched(token),
    );
    const lineActive = activeLyricFocus?.lineIndex === word.lineIndex;
    const wordActive = activeLyricWordId === word.id;
    const wordComplete = lineActive && visualPlayheadMs > word.endMs;
    const wordProgress = lineActive
      ? karaokeMakerWordProgress(word.startMs, word.endMs, visualPlayheadMs)
      : 0;
    let currentFont = '650 13px Inter, system-ui, sans-serif';
    if (word.isSection) {
      currentFont = '800 11px Inter, system-ui, sans-serif';
    } else if (selected) {
      currentFont = '750 14px Inter, system-ui, sans-serif';
    }
    context.font = currentFont;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    const { width: labelWidth, left: labelLeft, lane } = label;
    const centerX = word.isSection
      ? Math.max(
          plotLeft + measuredWidth / 2 + 8,
          Math.min(plotRight - measuredWidth / 2 - 8, (rawLeft + rawRight) / 2),
        )
      : labelLeft + labelWidth / 2;
    const wordCenterY =
      lyricSectionTop + lane * lyricLaneHeight + lyricLaneHeight / 2;
    // The playback focus owns the single rounded highlight. A selection at
    // another timestamp stays visible through its bright text/underline,
    // but does not compete with the word currently being performed.
    const showFocusBox =
      wordActive || (selected && activeLyricFocus?.tokenId === undefined);
    if (showFocusBox) {
      const elapsed =
        wordActive && wordFocusAnimationRef.current.tokenId === word.id
          ? performance.now() - wordFocusAnimationRef.current.startedAt
          : 180;
      const progress = Math.max(0, Math.min(1, elapsed / 180));
      const eased = 1 - (1 - progress) ** 3;
      context.save();
      context.globalAlpha = 0.35 + eased * 0.65;
      context.translate(centerX, wordCenterY);
      context.scale(0.94 + eased * 0.06, 0.88 + eased * 0.12);
      context.translate(-centerX, -wordCenterY);
      context.fillStyle = selected
        ? 'rgba(44, 229, 213, .14)'
        : 'rgba(45, 214, 203, .09)';
      context.strokeStyle = selected
        ? 'rgba(123, 255, 244, .72)'
        : 'rgba(79, 238, 224, .28)';
      context.lineWidth = selected ? 1.4 : 1;
      context.shadowColor = selected ? '#20e6d4' : 'rgba(32, 230, 212, .5)';
      context.shadowBlur = selected ? 12 : 7;
      drawRoundedRect(
        context,
        labelLeft - 3,
        wordCenterY - laneHalf,
        labelWidth + 6,
        lyricLaneHeight,
        7,
      );
      context.fill();
      if (wordActive && wordProgress > 0) {
        context.save();
        drawRoundedRect(
          context,
          labelLeft - 3,
          wordCenterY - laneHalf,
          labelWidth + 6,
          lyricLaneHeight,
          7,
        );
        context.clip();
        context.fillStyle = 'rgba(70, 244, 229, .2)';
        context.fillRect(
          labelLeft - 3,
          wordCenterY - laneHalf,
          (labelWidth + 6) * wordProgress,
          lyricLaneHeight,
        );
        context.restore();
      }
      drawRoundedRect(
        context,
        labelLeft - 3,
        wordCenterY - laneHalf,
        labelWidth + 6,
        lyricLaneHeight,
        7,
      );
      context.stroke();
      context.restore();
    }
    // A continuous base with small junction nodes shows exactly where the
    // provider divided a readable word into editable sung syllables.
    context.save();
    context.strokeStyle = userTouched
      ? 'rgba(74, 232, 172, .34)'
      : 'rgba(111, 151, 178, .25)';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(timingLeft, wordCenterY + (laneHalf - 1));
    context.lineTo(timingRight, wordCenterY + (laneHalf - 1));
    context.stroke();
    word.syllables.forEach(({ token }, syllableIndex) => {
      const syllableRawLeft = timeX(token.startMs as number);
      const syllableRawRight = timeX(token.endMs as number);
      if (syllableRawRight < plotLeft || syllableRawLeft > plotRight) {
        return;
      }
      const syllableLeft = Math.max(plotLeft, syllableRawLeft);
      const syllableRight = Math.max(
        syllableLeft + 2,
        Math.min(plotRight, syllableRawRight),
      );
      const syllableSelected =
        selection?.kind === 'word' && selection.id === token.id;
      const syllableTouched = karaokeMakerTokenWasUserTouched(token);
      let timingStroke = syllableTouched
        ? 'rgba(74, 232, 172, .8)'
        : 'rgba(111, 151, 178, .54)';
      if (wordComplete) {
        timingStroke = syllableTouched
          ? 'rgba(111, 255, 202, .98)'
          : 'rgba(166, 199, 221, .72)';
      }
      if (syllableSelected) {
        timingStroke = '#88fff4';
      }
      context.strokeStyle = timingStroke;
      context.lineWidth = syllableSelected ? 2.2 : 1.35;
      context.beginPath();
      context.moveTo(syllableLeft, wordCenterY + (laneHalf - 1));
      context.lineTo(syllableRight, wordCenterY + (laneHalf - 1));
      context.stroke();
      if (syllableIndex > 0) {
        const junctionX = Math.max(
          plotLeft + 1.5,
          Math.min(plotRight - 1.5, syllableLeft),
        );
        context.fillStyle = syllableSelected
          ? '#a8fff7'
          : 'rgba(73, 235, 220, .72)';
        context.beginPath();
        context.arc(
          junctionX,
          wordCenterY + (laneHalf - 1),
          1.8,
          0,
          Math.PI * 2,
        );
        context.fill();
      }

      const wordDurationMs = Math.max(1, word.endMs - word.startMs);
      const labelHitLeft =
        labelLeft +
        (((token.startMs as number) - word.startMs) / wordDurationMs) *
          labelWidth;
      const labelHitRight =
        labelLeft +
        (((token.endMs as number) - word.startMs) / wordDurationMs) *
          labelWidth;
      regions.push({
        kind: 'word',
        id: token.id,
        left: labelHitLeft,
        right: Math.max(labelHitLeft + 2, labelHitRight),
        top: wordCenterY - (laneHalf + 1),
        bottom: wordCenterY + (laneHalf - 5),
      });
      regions.push({
        kind: 'word',
        id: token.id,
        left: syllableLeft,
        right: syllableRight,
        top: wordCenterY + (laneHalf - 5),
        bottom: wordCenterY + (laneHalf + 3),
      });
      const lineTokens = project.lyrics.lines[word.lineIndex]?.tokens ?? [];
      const tokenIndex = lineTokens.findIndex(
        (candidate) => candidate.id === token.id,
      );
      const previousToken = lineTokens[tokenIndex - 1];
      const nextToken = lineTokens[tokenIndex + 1];
      const addWordBoundary = (
        handleX: number,
        boundaryTokenId: string,
        boundaryBehavior: 'resize-start' | 'resize-end',
        boundarySelected: boolean,
      ) => {
        const boundaryHovered =
          hoveredEditHandle?.kind === 'word' &&
          hoveredEditHandle.id === boundaryTokenId &&
          hoveredEditHandle.behavior === boundaryBehavior;
        if (boundaryHovered || boundarySelected) {
          const visibleHandleX = Math.max(
            plotLeft + 2,
            Math.min(plotRight - 2, handleX),
          );
          context.save();
          context.strokeStyle = boundaryHovered ? '#cafffa' : '#64eadf';
          context.lineWidth = boundaryHovered ? 2.2 : 1.35;
          context.shadowColor = '#21e8d6';
          context.shadowBlur = boundaryHovered ? 10 : 5;
          context.beginPath();
          context.moveTo(visibleHandleX, wordCenterY + 5);
          context.lineTo(visibleHandleX, wordCenterY + 19);
          context.stroke();
          context.fillStyle = boundaryHovered ? '#eafffd' : '#7cfff4';
          [wordCenterY + 6, wordCenterY + 18].forEach((handleY) => {
            context.beginPath();
            context.arc(
              visibleHandleX,
              handleY,
              boundaryHovered ? 2.2 : 1.6,
              0,
              Math.PI * 2,
            );
            context.fill();
          });
          context.restore();
        }
        wordBoundaryRegions.push({
          kind: 'word',
          id: boundaryTokenId,
          behavior: boundaryBehavior,
          left: handleX - 7,
          right: handleX + 7,
          top: wordCenterY + 3,
          // Fixed, not laneHalf-derived — see WORD_BOUNDARY_HANDLE_REACH.
          // paintTranslation.ts's own clearance is computed from this same
          // constant, so the two stay in agreement if it ever changes.
          bottom: wordCenterY + WORD_BOUNDARY_HANDLE_REACH,
        });
      };
      const canResizeLeftBoundary =
        tokenIndex >= 0 &&
        token.startMs !== undefined &&
        (previousToken === undefined ||
          (previousToken.startMs !== undefined &&
            previousToken.endMs !== undefined));
      if (canResizeLeftBoundary) {
        addWordBoundary(
          syllableLeft,
          token.id,
          'resize-start',
          selection?.kind === 'word' && selection.id === token.id,
        );
      }
      const canResizeRightBoundary =
        tokenIndex >= 0 &&
        token.endMs !== undefined &&
        (nextToken === undefined ||
          (nextToken.startMs !== undefined && nextToken.endMs !== undefined));
      if (canResizeRightBoundary) {
        addWordBoundary(
          syllableRight,
          token.id,
          'resize-end',
          selection?.kind === 'word' && selection.id === token.id,
        );
      }
    });
    context.restore();
    let wordFill = userTouched
      ? 'rgba(128, 241, 194, .9)'
      : 'rgba(181, 204, 222, .66)';
    if (wordComplete) {
      wordFill = userTouched
        ? 'rgba(172, 255, 220, .98)'
        : 'rgba(216, 234, 246, .9)';
    }
    if (selected) {
      wordFill = '#f5fffe';
    }
    context.fillStyle = wordFill;
    context.save();
    context.beginPath();
    context.rect(
      labelLeft,
      wordCenterY - (laneHalf - 1),
      labelWidth,
      lyricLaneHeight - 2,
    );
    context.clip();
    context.fillText(word.text, centerX, wordCenterY);
    if (wordProgress > 0 && !wordComplete) {
      const textLeft = centerX - measuredWidth / 2;
      context.beginPath();
      context.rect(
        textLeft,
        wordCenterY - (laneHalf + 1),
        measuredWidth * wordProgress,
        lyricLaneHeight + 2,
      );
      context.clip();
      context.fillStyle = '#73fff3';
      context.shadowColor = '#21e8d6';
      context.shadowBlur = wordActive ? 11 : 4;
      context.fillText(word.text, centerX, wordCenterY);
    }
    context.restore();
  });

  // After the original's tokens. See paintTranslation.ts for why this is
  // once per line rather than once per word.
  if (translationRow) {
    paintLyricTranslationRow(context, {
      plot,
      lyricSectionTop,
      lyricLaneHeight,
      translationRow,
      layoutWords,
    });
  }

  return { regions, wordBoundaryRegions };
};
