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
import { IKaraokeMakerProject } from '../../common/karaoke/makerProject';
import {
  karaokeMakerLyricFocus,
  karaokeMakerSectionGroups,
} from './makerCanvasLayout';
import {
  IHitRegion,
  MAX_NOTE_MIDI,
  MIN_NOTE_MIDI,
  TMakerDragBehavior,
  drawRoundedRect,
  makerPlot,
} from './makerCanvasGeometry';
import {
  ICanvasLyricWord,
  ICanvasSelectionBox,
  INoteLinkDragState,
  INotePaintDraft,
} from './makerCanvasTypes';
import { TSelection } from './useKaraokeMakerSelection';
import { paintBackdrop } from './makerCanvas/paintBackdrop';
import { paintLyrics } from './makerCanvas/paintLyrics';
import { paintNotes } from './makerCanvas/paintNotes';

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
    top: plotTop,
    bottom: plotBottom,
    height: plotHeight,
    timeX,
  } = plot;
  const regions: IHitRegion[] = [];

  // The stage first: ground, section bands, ruler, pitch labels, waveform.
  // None of it depends on where a word lands, so it draws before they are
  // measured — and it is the only layer that reports no hit regions back.
  paintBackdrop(context, {
    plot,
    width,
    height,
    headerHeight,
    lyricSectionTop,
    project,
    canvasSectionGroups,
    viewStartMs,
    visibleViewDurationMs,
    effectiveDurationMs,
  });

  // The words, and everything that depends on them. Packing decides which lane
  // a word occupies, and a note reads its position from the word it belongs to
  // — so this runs before the notes and cannot be reordered with them.
  //
  // Boundary handles are kept apart and appended after the wider word and
  // underline regions, because hit-testing takes the first match and a handle
  // has to win against the region drawn behind it.
  const lyricPaint = paintLyrics(context, {
    plot,
    lyricSectionTop,
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
  });
  regions.push(...lyricPaint.regions, ...lyricPaint.wordBoundaryRegions);

  // The melody, after the words: a note linked to a lyric is drawn against
  // that word's position, so `canvasLyricWords` goes in to answer "which word
  // is this note on" rather than to draw anything.
  regions.push(
    ...paintNotes(context, {
      plot,
      project,
      canvasLyricWords,
      selectedNoteIds,
      controlLinkMode,
      hoveredEditHandle,
      viewStartMs,
      visibleViewDurationMs,
      visualPlayheadMs,
    }),
  );

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
