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

import { IKaraokeMakerProject } from '../../../common/karaoke/makerProject';
import { karaokeLeadNoteShape } from '../../../common/karaoke/melodyArticulation';
import {
  karaokeMakerNoteIsActive,
  karaokeMakerNoteProgress,
} from '../makerCanvasLayout';
import {
  IHitRegion,
  IMakerPlot,
  MAX_NOTE_MIDI,
  MIN_NOTE_MIDI,
  TMakerDragBehavior,
  drawRoundedRect,
  midiName,
} from '../makerCanvasGeometry';
import { ICanvasLyricWord } from '../makerCanvasTypes';
import {
  readAccent,
  readAccentLight,
  readSurface,
  readSurfaceAlpha,
} from '../../utils/theme';

export interface IPaintNotesInput {
  plot: IMakerPlot;
  project: IKaraokeMakerProject;
  canvasLyricWords: ICanvasLyricWord[];
  selectedNoteIds: Set<string>;
  /** Ctrl is down with a note selected: linking is armed. */
  controlLinkMode: boolean;
  hoveredEditHandle?: {
    kind: 'word' | 'note';
    id: string;
    behavior: TMakerDragBehavior;
  };
  viewStartMs: number;
  visibleViewDurationMs: number;
  visualPlayheadMs: number;
}

/**
 * The melody: every note, and the lines joining the ones that slur together.
 *
 * Runs after the words because a note linked to a lyric is drawn against that
 * word's position — `canvasLyricWords` is here to answer "which word does this
 * note belong to", not to draw anything.
 *
 * Returns its hit regions, like the lyrics layer. A note is grabbable at its
 * body and at each end, so this is where dragging a note's start or length
 * becomes possible at all.
 */
export const paintNotes = (
  context: CanvasRenderingContext2D,
  {
    plot,
    project,
    canvasLyricWords,
    selectedNoteIds,
    controlLinkMode,
    hoveredEditHandle,
    viewStartMs,
    visibleViewDurationMs,
    visualPlayheadMs,
  }: IPaintNotesInput,
): IHitRegion[] => {
  const {
    left: plotLeft,
    right: plotRight,
    top: plotTop,
    bottom: plotBottom,
    height: plotHeight,
    timeX,
    noteY,
  } = plot;
  const regions: IHitRegion[] = [];

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
    const previousShape = karaokeLeadNoteShape(previousNote);
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
    const startX = Math.max(plotLeft, timeX(previousShape.endMs));
    const endX = Math.min(plotRight, timeX(note.startMs));
    const startY = noteY(previousNote.targetMidi);
    const endY = noteY(note.targetMidi);
    const controlX = (startX + endX) / 2;
    context.save();
    context.strokeStyle = readAccent(0.7, 'rgba(79, 231, 220, .7)');
    context.lineWidth = 2;
    context.lineCap = 'round';
    context.shadowColor = readAccent(0.5, 'rgba(37, 226, 211, .5)');
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
    // The drawn extent, not the audible cue's: the cue caps itself at 1.45
    // seconds so a synth tone cannot drone, and a block that inherited that
    // ceiling showed a four-second held note as a short one. An editor whose
    // blocks disagree with the timing it is editing is the wrong tool.
    const shape = karaokeLeadNoteShape(note);
    const left = Math.max(plotLeft, timeX(shape.startMs));
    const right = Math.min(plotRight, Math.max(left + 5, timeX(shape.endMs)));
    const noteHeight = Math.max(
      8,
      (plotHeight / (MAX_NOTE_MIDI - MIN_NOTE_MIDI)) * 0.8,
    );
    /*
     * A NOTE IS DRAWN INSIDE THE PITCH GRID OR NOT AT ALL.
     *
     * This was the one coordinate in the editor with no bound on it. The two
     * horizontal edges have always been clamped to the plot a few lines up,
     * and the draft note in paintOverlays.ts clamps its centre to
     * `[plotTop, plotBottom]` — but the real notes layer took `noteY` raw, and
     * `noteY` is a linear map with nothing stopping it: a note above
     * MAX_NOTE_MIDI returns a y above `plot.top`, one below MIN_NOTE_MIDI
     * returns one past `plot.bottom`. There is no grid there. Above the plot
     * are the lyric lanes, the section band and the three waveform rows, so a
     * single out-of-range note is painted across the song overview at a
     * position that means nothing, and it moves with the horizontal scroll
     * like everything else — which is what "floating" looks like.
     *
     * Clamped to half a note-height inside each edge, so a pinned note reads
     * as sitting ON the grid's limit rather than half-swallowed by it. It
     * keeps its real label: pinning is how the editor says "this one is off
     * the top", and replacing the name with the limit's name would hide the
     * very thing the user has to fix.
     */
    const centerY = Math.max(
      plotTop + noteHeight / 2,
      Math.min(plotBottom - noteHeight / 2, noteY(note.targetMidi)),
    );
    const selected = selectedNoteIds.has(note.id);
    // The same extent the block is drawn with, so the fill reaches the right
    // edge exactly as the playhead does instead of finishing early.
    const active = karaokeMakerNoteIsActive(
      shape.startMs,
      shape.endMs,
      visualPlayheadMs,
    );
    const noteProgress = active
      ? karaokeMakerNoteProgress(shape.startMs, shape.endMs, visualPlayheadMs)
      : 0;
    let noteShadowColor = readAccent(0.54, 'rgba(43, 216, 255, .54)');
    let noteShadowBlur = 4;
    let noteGradientTop = readAccent(1, '#58bfd7');
    let noteGradientBottom = '#316f9f';
    if (selected) {
      noteShadowColor = '#f5fb73';
      noteShadowBlur = 13;
      noteGradientTop = readAccentLight(1, '#bffff7');
      noteGradientBottom = readAccent(1, '#39e5d3');
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
        note.kind === 'golden' ? '#fffde0' : readAccentLight(1, '#e8fffd'),
      );
      progressGradient.addColorStop(
        1,
        note.kind === 'golden' ? '#ffc743' : readAccent(1, '#27ead8'),
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
      context.shadowColor =
        note.kind === 'golden' ? '#ffe571' : readAccent(1, '#45fff0');
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
          : readAccentLight(0.96, 'rgba(221, 255, 252, .96)');
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
      context.strokeStyle =
        note.kind === 'golden' ? '#fff7a3' : readAccentLight(1, '#effffc');
      context.lineWidth = 1.2;
      context.shadowColor =
        note.kind === 'golden' ? '#ffe571' : readAccent(1, '#4affef');
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
        : readAccentLight(0.7, 'rgba(207, 231, 238, .7)');
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
      context.strokeStyle = readAccentLight(1, '#cafffa');
      context.lineWidth = 1.3;
      context.setLineDash([4, 3]);
      context.shadowColor = readAccent(1, '#20e6d4');
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
      context.fillStyle = readSurface('--surface-panel', '#1a3a4e');
      context.beginPath();
      context.arc(indicatorX, centerY, 5.5, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = readAccentLight(1, '#bafff8');
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
      context.shadowColor = readAccent(1, '#22ead8');
      context.shadowBlur = 9;
      if (!note.tokenId) {
        [left, right].forEach((handleX) => {
          context.beginPath();
          context.fillStyle = readSurface('--surface-block', '#1e4257');
          context.strokeStyle = readAccentLight(1, '#9efff6');
          context.lineWidth = 1.4;
          context.arc(handleX, centerY, 3.8, 0, Math.PI * 2);
          context.fill();
          context.stroke();
        });
      }
      if (right - left >= 18) {
        context.fillStyle = readSurfaceAlpha(
          '--surface-block',
          0.94,
          'rgba(30, 66, 87, 0.94)',
        );
        context.strokeStyle = readAccentLight(0.82, 'rgba(167, 255, 247, .82)');
        context.lineWidth = 1;
        drawRoundedRect(context, centerX - 7, centerY - 4, 14, 8, 4);
        context.fill();
        context.stroke();
        context.fillStyle = readAccentLight(1, '#bafff8');
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
  return regions;
};
