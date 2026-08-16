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
} from '../../common/karaoke/makerProject';
import {
  KARAOKE_MAKER_LYRIC_LANE_COUNT,
  karaokeMakerLyricFocus,
  karaokeMakerNoteIsActive,
  karaokeMakerNoteProgress,
  karaokeMakerSectionGroups,
  karaokeMakerWordProgress,
  layoutKaraokeMakerAnchoredLyricLabels,
} from './makerCanvasLayout';
import { karaokeLeadNoteArticulation } from '../../common/karaoke/melodyArticulation';
import { formatClock } from './makerFormat';
import {
  IHitRegion,
  LYRIC_LANE_HEIGHT,
  MAX_NOTE_MIDI,
  MIN_NOTE_MIDI,
  SECTION_GROUP_HEIGHT,
  SECTION_GROUP_TOP,
  TMakerDragBehavior,
  WAVEFORM_HEIGHT,
  WAVEFORM_TOP,
  drawRoundedRect,
  lyricSectionHeight,
  makerPlot,
  midiName,
} from './makerCanvasGeometry';
import {
  ICanvasLyricWord,
  ICanvasSelectionBox,
  INoteLinkDragState,
  INotePaintDraft,
} from './makerCanvasTypes';
import { TSelection } from './useKaraokeMakerSelection';

const LYRIC_SECTION_HEIGHT = lyricSectionHeight(KARAOKE_MAKER_LYRIC_LANE_COUNT);

/**
 * Everything the timeline needs to draw one frame.
 *
 * Wide, and that is the right shape: this is a renderer, so it takes data and
 * produces pixels. The alternative to a wide parameter list here was the
 * previous arrangement, where the same values were reachable as closures inside
 * a nine-hundred-line effect and nothing said which of them the drawing
 * actually used.
 *
 * The refs are genuinely mutable and genuinely two-way. `hitRegionsRef` is an
 * output — the paint is the only thing that knows where anything landed, so it
 * records the rectangles as it draws and the pointer handlers read them back.
 * The other four are inputs describing a gesture in flight, read every frame
 * because a drag repaints faster than React re-renders.
 */
export interface IMakerCanvasPaint {
  context: CanvasRenderingContext2D;
  /** Device pixel ratio the backing bitmap was sized for. */
  ratio: number;
  width: number;
  height: number;
  headerHeight: number;
  lyricSectionTop: number;
  project: IKaraokeMakerProject;
  selection: TSelection;
  selectedNoteIds: Set<string>;
  canvasLyricWords: ICanvasLyricWord[];
  canvasSectionGroups: ReturnType<typeof karaokeMakerSectionGroups>;
  activeLyricFocus: ReturnType<typeof karaokeMakerLyricFocus>;
  activeLyricWordId?: string;
  hoveredEditHandle?: {
    kind: 'word' | 'note';
    id: string;
    behavior: TMakerDragBehavior;
  };
  /** Ctrl is down with a note selected: linking is armed. */
  controlLinkMode: boolean;
  viewStartMs: number;
  visibleViewDurationMs: number;
  visualPlayheadMs: number;
  effectiveDurationMs: number;
  /** Written by the paint, read by the pointer handlers. */
  hitRegionsRef: MutableRefObject<IHitRegion[]>;
  selectionBoxRef: MutableRefObject<ICanvasSelectionBox | undefined>;
  notePaintDraftRef: MutableRefObject<INotePaintDraft | undefined>;
  noteLinkDragRef: MutableRefObject<INoteLinkDragState | undefined>;
  wordFocusAnimationRef: MutableRefObject<{
    tokenId?: string;
    startedAt: number;
  }>;
}

/**
 * Draw the whole editor timeline: waveform, sections, lyrics, notes, playhead.
 *
 * One pass, in painter's order, ending by publishing the hit regions it just
 * laid out. It was the body of a `useEffect` inside a seven-thousand-line
 * component and is unchanged here beyond taking its inputs as an argument
 * instead of closing over them.
 */
export const paintMakerCanvas = ({
  context,
  ratio,
  width,
  height,
  headerHeight,
  lyricSectionTop,
  project,
  selection,
  selectedNoteIds,
  canvasLyricWords,
  canvasSectionGroups,
  activeLyricFocus,
  activeLyricWordId,
  hoveredEditHandle,
  controlLinkMode,
  viewStartMs,
  visibleViewDurationMs,
  visualPlayheadMs,
  effectiveDurationMs,
  hitRegionsRef,
  selectionBoxRef,
  notePaintDraftRef,
  noteLinkDragRef,
  wordFocusAnimationRef,
}: IMakerCanvasPaint) => {
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  const plot = makerPlot({
    width,
    height,
    headerHeight,
    viewStartMs,
    visibleViewDurationMs,
  });
  const {
    left: plotLeft,
    right: plotRight,
    width: plotWidth,
    top: plotTop,
    bottom: plotBottom,
    height: plotHeight,
    timeX,
    noteY,
  } = plot;
  const regions: IHitRegion[] = [];
  const wordBoundaryRegions: IHitRegion[] = [];

  const background = context.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, 'rgba(8, 24, 43, .96)');
  background.addColorStop(1, 'rgba(5, 19, 34, .98)');
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  const lyricBackground = context.createLinearGradient(
    0,
    lyricSectionTop,
    0,
    headerHeight,
  );
  lyricBackground.addColorStop(0, 'rgba(10, 35, 52, .72)');
  lyricBackground.addColorStop(1, 'rgba(4, 22, 36, .9)');
  context.fillStyle = lyricBackground;
  context.fillRect(
    plotLeft,
    lyricSectionTop - 3,
    plotWidth,
    LYRIC_SECTION_HEIGHT + 6,
  );
  if (canvasSectionGroups.length) {
    context.fillStyle = 'rgba(7, 29, 45, .94)';
    context.fillRect(
      plotLeft,
      SECTION_GROUP_TOP - 3,
      plotWidth,
      SECTION_GROUP_HEIGHT,
    );
    context.save();
    context.beginPath();
    context.rect(
      plotLeft,
      SECTION_GROUP_TOP - 3,
      plotWidth,
      SECTION_GROUP_HEIGHT,
    );
    context.clip();
    canvasSectionGroups.forEach((group, index) => {
      const rawLeft = timeX(group.startMs);
      const rawRight = timeX(group.endMs);
      if (rawRight < plotLeft || rawLeft > plotRight) {
        return;
      }
      const left = Math.max(plotLeft, rawLeft);
      const right = Math.min(plotRight, Math.max(left + 1, rawRight));
      const centerY = SECTION_GROUP_TOP + SECTION_GROUP_HEIGHT / 2 - 2;
      const groupGradient = context.createLinearGradient(left, 0, right, 0);
      groupGradient.addColorStop(
        0,
        index % 2 ? 'rgba(34, 213, 199, .12)' : 'rgba(72, 196, 232, .1)',
      );
      groupGradient.addColorStop(1, 'rgba(17, 109, 126, .025)');
      context.fillStyle = groupGradient;
      context.fillRect(left, SECTION_GROUP_TOP - 2, right - left, 25);
      context.strokeStyle = 'rgba(63, 232, 216, .45)';
      context.lineWidth = 1.2;
      context.beginPath();
      context.moveTo(left + 1, SECTION_GROUP_TOP + 22);
      context.lineTo(Math.max(left + 1, right - 4), SECTION_GROUP_TOP + 22);
      context.stroke();
      context.font = '800 10px Inter, system-ui, sans-serif';
      const text = group.text.toUpperCase();
      const measuredWidth = context.measureText(text).width;
      const textX = Math.max(
        left + measuredWidth / 2 + 9,
        Math.min(
          right - measuredWidth / 2 - 9,
          rawLeft + 10 + measuredWidth / 2,
        ),
      );
      context.save();
      context.beginPath();
      context.rect(
        left + 4,
        SECTION_GROUP_TOP,
        Math.max(0, right - left - 8),
        22,
      );
      context.clip();
      context.fillStyle = 'rgba(111, 255, 243, .94)';
      context.shadowColor = 'rgba(36, 223, 207, .48)';
      context.shadowBlur = 7;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(text, textX, centerY);
      context.restore();
    });
    context.restore();
    context.strokeStyle = 'rgba(44, 226, 211, .2)';
    context.beginPath();
    context.moveTo(plotLeft, lyricSectionTop - 3);
    context.lineTo(plotRight, lyricSectionTop - 3);
    context.stroke();
  }
  for (let lane = 1; lane < KARAOKE_MAKER_LYRIC_LANE_COUNT; lane += 1) {
    const laneY = lyricSectionTop + lane * LYRIC_LANE_HEIGHT;
    context.strokeStyle = 'rgba(76, 151, 174, .085)';
    context.beginPath();
    context.moveTo(plotLeft, laneY);
    context.lineTo(plotRight, laneY);
    context.stroke();
  }
  context.strokeStyle = 'rgba(44, 226, 211, .18)';
  context.beginPath();
  context.moveTo(plotLeft, headerHeight - 1);
  context.lineTo(plotRight, headerHeight - 1);
  context.stroke();

  context.strokeStyle = 'rgba(71, 116, 151, .13)';
  context.lineWidth = 1;
  let majorStep = 15_000;
  if (visibleViewDurationMs <= 10_000) {
    majorStep = 1_000;
  } else if (visibleViewDurationMs <= 40_000) {
    majorStep = 5_000;
  }
  const firstTick = Math.floor(viewStartMs / majorStep) * majorStep;
  for (
    let tick = firstTick;
    tick <= viewStartMs + visibleViewDurationMs;
    tick += majorStep
  ) {
    const x = timeX(tick);
    context.beginPath();
    context.moveTo(x, headerHeight - 2);
    context.lineTo(x, plotBottom);
    context.stroke();
    context.fillStyle = 'rgba(174, 201, 222, .58)';
    context.font = '10px system-ui, sans-serif';
    context.textAlign = 'center';
    context.fillText(formatClock(tick), x, height - 10);
  }
  for (let midi = MIN_NOTE_MIDI; midi <= MAX_NOTE_MIDI; midi += 3) {
    const y = noteY(midi);
    context.strokeStyle =
      midi % 12 === 0 ? 'rgba(65, 218, 203, .16)' : 'rgba(71, 116, 151, .08)';
    context.beginPath();
    context.moveTo(plotLeft, y);
    context.lineTo(plotRight, y);
    context.stroke();
    if (midi % 12 === 0) {
      context.fillStyle = 'rgba(160, 244, 112, .72)';
      context.textAlign = 'right';
      context.fillText(midiName(midi), plotLeft - 8, y + 3);
    }
  }

  const { waveform } = project.analysis;
  if (waveform?.length) {
    context.save();
    context.beginPath();
    context.rect(plotLeft, WAVEFORM_TOP, plotWidth, WAVEFORM_HEIGHT);
    context.clip();
    context.fillStyle = 'rgba(22, 211, 198, .18)';
    context.beginPath();
    const startIndex = Math.floor(
      (viewStartMs / effectiveDurationMs) * waveform.length,
    );
    const endIndex = Math.ceil(
      ((viewStartMs + visibleViewDurationMs) / effectiveDurationMs) *
        waveform.length,
    );
    for (let xIndex = 0; xIndex < Math.ceil(plotWidth); xIndex += 1) {
      const progress = xIndex / plotWidth;
      const index = Math.max(
        0,
        Math.min(
          waveform.length - 1,
          Math.round(startIndex + (endIndex - startIndex) * progress),
        ),
      );
      const amplitude = waveform[index] ?? 0;
      const x = plotLeft + xIndex;
      const centerY = WAVEFORM_TOP + WAVEFORM_HEIGHT / 2;
      const halfHeight = Math.max(0.6, amplitude * (WAVEFORM_HEIGHT / 2 - 2));
      context.rect(x, centerY - halfHeight, 1, halfHeight * 2);
    }
    context.fill();
    context.strokeStyle = 'rgba(72, 246, 230, .32)';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(plotLeft, WAVEFORM_TOP + WAVEFORM_HEIGHT / 2);
    context.lineTo(plotRight, WAVEFORM_TOP + WAVEFORM_HEIGHT / 2);
    context.stroke();
    context.restore();
  }

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
      lyricSectionTop + lane * LYRIC_LANE_HEIGHT + LYRIC_LANE_HEIGHT / 2;
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
        wordCenterY - 13,
        labelWidth + 6,
        26,
        7,
      );
      context.fill();
      if (wordActive && wordProgress > 0) {
        context.save();
        drawRoundedRect(
          context,
          labelLeft - 3,
          wordCenterY - 13,
          labelWidth + 6,
          26,
          7,
        );
        context.clip();
        context.fillStyle = 'rgba(70, 244, 229, .2)';
        context.fillRect(
          labelLeft - 3,
          wordCenterY - 13,
          (labelWidth + 6) * wordProgress,
          26,
        );
        context.restore();
      }
      drawRoundedRect(
        context,
        labelLeft - 3,
        wordCenterY - 13,
        labelWidth + 6,
        26,
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
    context.moveTo(timingLeft, wordCenterY + 12);
    context.lineTo(timingRight, wordCenterY + 12);
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
      context.moveTo(syllableLeft, wordCenterY + 12);
      context.lineTo(syllableRight, wordCenterY + 12);
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
        context.arc(junctionX, wordCenterY + 12, 1.8, 0, Math.PI * 2);
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
        top: wordCenterY - 14,
        bottom: wordCenterY + 8,
      });
      regions.push({
        kind: 'word',
        id: token.id,
        left: syllableLeft,
        right: syllableRight,
        top: wordCenterY + 8,
        bottom: wordCenterY + 16,
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
          bottom: wordCenterY + 21,
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
    context.rect(labelLeft, wordCenterY - 12, labelWidth, 24);
    context.clip();
    context.fillText(word.text, centerX, wordCenterY);
    if (wordProgress > 0 && !wordComplete) {
      const textLeft = centerX - measuredWidth / 2;
      context.beginPath();
      context.rect(
        textLeft,
        wordCenterY - 14,
        measuredWidth * wordProgress,
        28,
      );
      context.clip();
      context.fillStyle = '#73fff3';
      context.shadowColor = '#21e8d6';
      context.shadowBlur = wordActive ? 11 : 4;
      context.fillText(word.text, centerX, wordCenterY);
    }
    context.restore();
  });

  // Boundary handles win hit-testing over the wider word/underline regions.
  regions.push(...wordBoundaryRegions);

  const lyricWordIdByTokenId = new Map<string, string>();
  canvasLyricWords.forEach((word) => {
    word.syllables.forEach(({ token }) => {
      lyricWordIdByTokenId.set(token.id, word.id);
    });
  });
  const orderedNotes = [...project.melody.notes].sort(
    (left, right) => left.startMs - right.startMs,
  );
  orderedNotes.slice(1).forEach((note, index) => {
    const previousNote = orderedNotes[index];
    const previousArticulation = karaokeLeadNoteArticulation(previousNote);
    const previousWordId = previousNote.tokenId
      ? lyricWordIdByTokenId.get(previousNote.tokenId)
      : undefined;
    const currentWordId = note.tokenId
      ? lyricWordIdByTokenId.get(note.tokenId)
      : undefined;
    if (
      !previousWordId ||
      previousWordId !== currentWordId ||
      previousNote.tokenId === note.tokenId ||
      previousNote.endMs < viewStartMs ||
      note.startMs > viewStartMs + visibleViewDurationMs
    ) {
      return;
    }
    const startX = Math.max(plotLeft, timeX(previousArticulation.endMs));
    const endX = Math.min(plotRight, timeX(note.startMs));
    const startY = noteY(previousNote.targetMidi);
    const endY = noteY(note.targetMidi);
    const controlX = (startX + endX) / 2;
    context.save();
    context.strokeStyle = 'rgba(79, 231, 220, .7)';
    context.lineWidth = 2;
    context.lineCap = 'round';
    context.shadowColor = 'rgba(37, 226, 211, .5)';
    context.shadowBlur = 6;
    context.beginPath();
    context.moveTo(startX, startY);
    context.bezierCurveTo(controlX, startY, controlX, endY, endX, endY);
    context.stroke();
    context.restore();
  });

  project.melody.notes.forEach((note) => {
    if (
      note.endMs < viewStartMs ||
      note.startMs > viewStartMs + visibleViewDurationMs
    ) {
      return;
    }
    const articulation = karaokeLeadNoteArticulation(note);
    const left = Math.max(plotLeft, timeX(articulation.startMs));
    const right = Math.min(
      plotRight,
      Math.max(left + 5, timeX(articulation.endMs)),
    );
    const centerY = noteY(note.targetMidi);
    const noteHeight = Math.max(
      8,
      (plotHeight / (MAX_NOTE_MIDI - MIN_NOTE_MIDI)) * 0.8,
    );
    const selected = selectedNoteIds.has(note.id);
    const active = karaokeMakerNoteIsActive(
      articulation.startMs,
      articulation.endMs,
      visualPlayheadMs,
    );
    const noteProgress = active
      ? karaokeMakerNoteProgress(
          articulation.startMs,
          articulation.endMs,
          visualPlayheadMs,
        )
      : 0;
    let noteShadowColor = 'rgba(43, 216, 255, .54)';
    let noteShadowBlur = 4;
    let noteGradientTop = '#58bfd7';
    let noteGradientBottom = '#316f9f';
    if (selected) {
      noteShadowColor = '#f5fb73';
      noteShadowBlur = 13;
      noteGradientTop = '#bffff7';
      noteGradientBottom = '#39e5d3';
    }
    context.save();
    context.shadowColor = noteShadowColor;
    context.shadowBlur = noteShadowBlur;
    const noteGradient = context.createLinearGradient(
      0,
      centerY - noteHeight / 2,
      0,
      centerY + noteHeight / 2,
    );
    if (note.kind === 'golden') {
      noteGradient.addColorStop(0, '#fff484');
      noteGradient.addColorStop(1, '#ffb52d');
    } else {
      noteGradient.addColorStop(0, noteGradientTop);
      noteGradient.addColorStop(1, noteGradientBottom);
    }
    context.fillStyle = noteGradient;
    drawRoundedRect(
      context,
      left,
      centerY - noteHeight / 2,
      right - left,
      noteHeight,
      noteHeight / 2,
    );
    context.fill();
    if (active) {
      const progressRight = left + (right - left) * noteProgress;
      const progressGradient = context.createLinearGradient(
        0,
        centerY - noteHeight / 2,
        0,
        centerY + noteHeight / 2,
      );
      progressGradient.addColorStop(
        0,
        note.kind === 'golden' ? '#fffde0' : '#e8fffd',
      );
      progressGradient.addColorStop(
        1,
        note.kind === 'golden' ? '#ffc743' : '#27ead8',
      );
      context.save();
      drawRoundedRect(
        context,
        left,
        centerY - noteHeight / 2,
        right - left,
        noteHeight,
        noteHeight / 2,
      );
      context.clip();
      context.fillStyle = progressGradient;
      context.shadowColor = note.kind === 'golden' ? '#ffe571' : '#45fff0';
      context.shadowBlur = 14;
      context.fillRect(
        left,
        centerY - noteHeight / 2,
        Math.max(1, progressRight - left),
        noteHeight,
      );
      context.restore();

      context.lineWidth = 1.4;
      context.strokeStyle =
        note.kind === 'golden'
          ? 'rgba(255, 253, 210, .96)'
          : 'rgba(221, 255, 252, .96)';
      context.stroke();

      const playbackX = Math.max(left, Math.min(right, progressRight));
      const shine = context.createLinearGradient(
        playbackX - 10,
        0,
        playbackX + 4,
        0,
      );
      shine.addColorStop(0, 'rgba(255, 255, 255, 0)');
      shine.addColorStop(0.72, 'rgba(255, 255, 255, .68)');
      shine.addColorStop(1, 'rgba(255, 255, 255, 0)');
      context.fillStyle = shine;
      context.beginPath();
      context.roundRect(
        Math.max(left, playbackX - 10),
        centerY - noteHeight / 2,
        Math.min(14, right - Math.max(left, playbackX - 10)),
        noteHeight,
        noteHeight / 2,
      );
      context.fill();
      context.save();
      context.strokeStyle = note.kind === 'golden' ? '#fff7a3' : '#effffc';
      context.lineWidth = 1.2;
      context.shadowColor = note.kind === 'golden' ? '#ffe571' : '#4affef';
      context.shadowBlur = 8;
      context.beginPath();
      context.moveTo(playbackX, centerY - noteHeight / 2 + 1);
      context.lineTo(playbackX, centerY + noteHeight / 2 - 1);
      context.stroke();
      context.restore();
    }
    context.restore();
    context.fillStyle =
      selected || active
        ? 'rgba(245, 255, 254, .98)'
        : 'rgba(207, 231, 238, .7)';
    context.font = `${active ? 750 : 600} 9px system-ui, sans-serif`;
    context.textAlign = 'center';
    context.fillText(
      midiName(note.targetMidi),
      left + (right - left) / 2,
      centerY - noteHeight / 2 - 4,
    );
    if (controlLinkMode && selected) {
      const indicatorX = Math.max(left + 6, Math.min(right - 6, right - 7));
      context.save();
      context.strokeStyle = '#cafffa';
      context.lineWidth = 1.3;
      context.setLineDash([4, 3]);
      context.shadowColor = '#20e6d4';
      context.shadowBlur = 10;
      drawRoundedRect(
        context,
        left - 2,
        centerY - noteHeight / 2 - 2,
        right - left + 4,
        noteHeight + 4,
        noteHeight / 2 + 2,
      );
      context.stroke();
      context.setLineDash([]);
      context.fillStyle = '#062731';
      context.beginPath();
      context.arc(indicatorX, centerY, 5.5, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#bafff8';
      context.shadowBlur = 4;
      context.beginPath();
      context.arc(indicatorX - 1.7, centerY - 1, 2.1, -0.7, 2.2);
      context.arc(indicatorX + 1.7, centerY + 1, 2.1, 2.45, 5.35);
      context.stroke();
      context.restore();
    }
    if (
      hoveredEditHandle?.kind === 'note' &&
      hoveredEditHandle.id === note.id
    ) {
      const centerX = left + (right - left) / 2;
      context.save();
      context.shadowColor = '#22ead8';
      context.shadowBlur = 9;
      if (!note.tokenId) {
        [left, right].forEach((handleX) => {
          context.beginPath();
          context.fillStyle = '#082839';
          context.strokeStyle = '#9efff6';
          context.lineWidth = 1.4;
          context.arc(handleX, centerY, 3.8, 0, Math.PI * 2);
          context.fill();
          context.stroke();
        });
      }
      if (right - left >= 18) {
        context.fillStyle = 'rgba(5, 34, 46, .94)';
        context.strokeStyle = 'rgba(167, 255, 247, .82)';
        context.lineWidth = 1;
        drawRoundedRect(context, centerX - 7, centerY - 4, 14, 8, 4);
        context.fill();
        context.stroke();
        context.fillStyle = '#bafff8';
        [-3, 0, 3].forEach((offset) => {
          context.beginPath();
          context.arc(centerX + offset, centerY, 0.8, 0, Math.PI * 2);
          context.fill();
        });
      }
      context.restore();
    }
    regions.push({
      kind: 'note',
      id: note.id,
      left,
      right,
      top: centerY - noteHeight / 2 - 8,
      bottom: centerY + noteHeight / 2 + 5,
    });
  });

  const notePaintDraft = notePaintDraftRef.current;
  if (notePaintDraft) {
    const left = Math.max(
      plotLeft,
      Math.min(notePaintDraft.startX, notePaintDraft.currentX),
    );
    const right = Math.min(
      plotRight,
      Math.max(notePaintDraft.startX + 5, notePaintDraft.currentX),
    );
    const centerY = Math.max(plotTop, Math.min(plotBottom, notePaintDraft.y));
    const noteHeight = Math.max(
      8,
      (plotHeight / (MAX_NOTE_MIDI - MIN_NOTE_MIDI)) * 0.8,
    );
    context.save();
    context.fillStyle = 'rgba(58, 242, 222, .34)';
    context.strokeStyle = '#a2fff7';
    context.lineWidth = 1.5;
    context.shadowColor = '#20e6d4';
    context.shadowBlur = 12;
    drawRoundedRect(
      context,
      left,
      centerY - noteHeight / 2,
      Math.max(5, right - left),
      noteHeight,
      noteHeight / 2,
    );
    context.fill();
    context.stroke();
    context.restore();
  }

  const selectionBox = selectionBoxRef.current;
  if (selectionBox) {
    const left = Math.max(
      plotLeft,
      Math.min(selectionBox.startX, selectionBox.currentX),
    );
    const right = Math.min(
      plotRight,
      Math.max(selectionBox.startX, selectionBox.currentX),
    );
    const top = Math.max(
      plotTop,
      Math.min(selectionBox.startY, selectionBox.currentY),
    );
    const bottom = Math.min(
      plotBottom,
      Math.max(selectionBox.startY, selectionBox.currentY),
    );
    context.save();
    context.fillStyle = 'rgba(31, 226, 208, .09)';
    context.strokeStyle = 'rgba(126, 255, 244, .88)';
    context.lineWidth = 1.25;
    context.setLineDash([6, 4]);
    context.shadowColor = 'rgba(31, 226, 208, .55)';
    context.shadowBlur = 8;
    context.fillRect(
      left,
      top,
      Math.max(0, right - left),
      Math.max(0, bottom - top),
    );
    context.strokeRect(
      left + 0.5,
      top + 0.5,
      Math.max(0, right - left - 1),
      Math.max(0, bottom - top - 1),
    );
    context.restore();
  }

  const noteLinkDrag = noteLinkDragRef.current;
  if (noteLinkDrag) {
    const targetWord = [...regions]
      .reverse()
      .find(
        (region) =>
          region.kind === 'word' &&
          region.behavior === undefined &&
          noteLinkDrag.currentX >= region.left &&
          noteLinkDrag.currentX <= region.right &&
          noteLinkDrag.currentY >= region.top &&
          noteLinkDrag.currentY <= region.bottom,
      );
    context.save();
    context.strokeStyle = targetWord ? '#b8fff8' : 'rgba(104, 241, 231, .8)';
    context.lineWidth = targetWord ? 2.2 : 1.5;
    context.setLineDash(targetWord ? [] : [7, 5]);
    context.shadowColor = '#20e6d4';
    context.shadowBlur = targetWord ? 14 : 8;
    context.beginPath();
    context.moveTo(noteLinkDrag.startX, noteLinkDrag.startY);
    context.lineTo(noteLinkDrag.currentX, noteLinkDrag.currentY);
    context.stroke();
    context.setLineDash([]);
    context.fillStyle = targetWord ? '#eafffd' : '#74eee4';
    context.beginPath();
    context.arc(
      noteLinkDrag.currentX,
      noteLinkDrag.currentY,
      targetWord ? 5 : 3.5,
      0,
      Math.PI * 2,
    );
    context.fill();
    if (targetWord) {
      context.strokeStyle = 'rgba(139, 255, 247, .9)';
      context.lineWidth = 1.4;
      drawRoundedRect(
        context,
        targetWord.left - 3,
        targetWord.top - 3,
        targetWord.right - targetWord.left + 6,
        targetWord.bottom - targetWord.top + 6,
        7,
      );
      context.stroke();
    }
    context.restore();
  }

  const playheadX = timeX(visualPlayheadMs);
  if (playheadX >= plotLeft && playheadX <= plotRight) {
    context.save();
    context.strokeStyle = '#19e8d6';
    context.lineWidth = 1.5;
    context.shadowColor = '#1ee7d6';
    context.shadowBlur = 8;
    context.beginPath();
    context.moveTo(playheadX, 4);
    context.lineTo(playheadX, plotBottom);
    context.stroke();
    context.fillStyle = '#76fff4';
    context.beginPath();
    context.arc(playheadX, plotTop - 4, 4, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
  hitRegionsRef.current = regions;
};
