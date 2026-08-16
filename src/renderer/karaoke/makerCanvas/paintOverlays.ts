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
  IHitRegion,
  IMakerPlot,
  MAX_NOTE_MIDI,
  MIN_NOTE_MIDI,
  drawRoundedRect,
} from '../makerCanvasGeometry';
import {
  ICanvasSelectionBox,
  INoteLinkDragState,
  INotePaintDraft,
} from '../makerCanvasTypes';

export interface IPaintOverlaysInput {
  plot: IMakerPlot;
  visualPlayheadMs: number;
  /**
   * Read, never added to.
   *
   * The link drag asks which word is under the cursor, and the answer is
   * already in the regions the words and notes emitted. This layer is the only
   * consumer of that list during a paint — everything else reads it later, from
   * the ref, when a pointer event arrives.
   */
  regions: IHitRegion[];
  notePaintDraftRef: MutableRefObject<INotePaintDraft | undefined>;
  selectionBoxRef: MutableRefObject<ICanvasSelectionBox | undefined>;
  noteLinkDragRef: MutableRefObject<INoteLinkDragState | undefined>;
}

/**
 * What is happening right now, drawn on top of what exists.
 *
 * Four things with one property in common: none of them is part of the
 * document. The note being painted, the box being dragged out, the link being
 * pulled from a note to a word, and the playhead are all either a gesture in
 * flight or the current time — they vanish when the gesture ends, and none of
 * them is grabbable.
 *
 * That is what makes this a layer rather than an appendix to the notes. The
 * notes layer draws what the project contains; this draws what the user is
 * doing to it. They were adjacent in one function and looked like the same
 * concern; they are opposites.
 *
 * Emits no hit regions, for the same reason: you cannot click a thing that only
 * exists while you are already dragging something else.
 */
export const paintOverlays = (
  context: CanvasRenderingContext2D,
  {
    plot,
    visualPlayheadMs,
    regions,
    notePaintDraftRef,
    selectionBoxRef,
    noteLinkDragRef,
  }: IPaintOverlaysInput,
) => {
  const {
    left: plotLeft,
    right: plotRight,
    top: plotTop,
    bottom: plotBottom,
    height: plotHeight,
    timeX,
  } = plot;

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
};
