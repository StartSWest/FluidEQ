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
import {
  drawnNoteRange,
  freeNoteEdge,
  noteBoxHeight,
  paintNoteBox,
  paintNoteName,
  unsungNoteFill,
} from '../pitchNoteBox';
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
    lowMidi,
    highMidi,
    semitoneHeight,
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
    const previousShape = drawnNoteRange(
      previousNote.startMs,
      previousNote.endMs,
    );
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
    // The player's box (Ivan, 2026-11-16: "tiene que puntearse de la misma
    // forma que el player"): the whole syllable less a short rest. It took
    // the guide melody's articulation, which ends a note at 74-88% of its
    // syllable at random, so the editor drew notes shorter than the timing
    // it edits, and shorter than the player then showed them.
    const shape = drawnNoteRange(note.startMs, note.endMs);
    const left = Math.max(plotLeft, timeX(shape.startMs));
    const right = Math.min(plotRight, Math.max(left + 5, timeX(shape.endMs)));
    const noteHeight = noteBoxHeight(semitoneHeight);
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
     *
     * Pinned to the GRID's range, not to the pitch window: with the pitch
     * zoomed in, a note above or below the window is simply out of view — it
     * is drawn nowhere and claims no hit region. Pinning it to the window's
     * edge would show it on a row that is not its pitch.
     */
    const gridMidi = Math.max(
      MIN_NOTE_MIDI,
      Math.min(MAX_NOTE_MIDI, note.targetMidi),
    );
    if (gridMidi < lowMidi - 1e-6 || gridMidi > highMidi + 1e-6) {
      return;
    }
    const centerY = Math.max(
      plotTop + noteHeight / 2,
      Math.min(plotBottom - noteHeight / 2, noteY(gridMidi)),
    );
    const selected = selectedNoteIds.has(note.id);
    // The same extent the block is drawn with, so the fill reaches the right
    // edge exactly as the playhead does instead of finishing early.
    const active = karaokeMakerNoteIsActive(
      shape.startMs,
      shape.endMs,
      visualPlayheadMs,
    );
    // A free note is sung to no pitch — the scoring skips it and the export
    // writes it as `F`. It was drawn as a plain note, so choosing "Free" left
    // the editor pixel-identical and the only way to tell was to press the
    // note again and read the picker. Hollow says what it is: still a note,
    // still where it is, with nothing to hit.
    const isFree = note.kind === 'free';
    // The player's colours, and the selection lit on top of them: the one
    // thing the editor shows that the player has no use for.
    let noteFill = unsungNoteFill(note.kind);
    if (selected && note.kind === 'normal') {
      noteFill = readAccentLight(1, '#bffff7');
    } else if (selected && isFree) {
      noteFill = readAccentLight(0.26, 'rgba(191, 255, 247, .26)');
    }
    // A ring round a selected note as round the one being sung (Ivan,
    // 2026-11-15: "fix the note highlight, lighter, and a border so it is
    // more visible").
    const ringed = selected || active;
    paintNoteBox(context, {
      left,
      right,
      top: centerY - noteHeight / 2,
      height: noteHeight,
      kind: note.kind,
      fill: noteFill,
      freeEdge: selected
        ? readAccentLight(0.95, 'rgba(191, 255, 247, .95)')
        : freeNoteEdge(),
      progress: active
        ? karaokeMakerNoteProgress(shape.startMs, shape.endMs, visualPlayheadMs)
        : undefined,
      ringed,
    });
    paintNoteName(context, {
      midi: note.targetMidi,
      left,
      right,
      top: centerY - noteHeight / 2,
      ringed,
      bold: active,
    });
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
