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

/**
 * What the timeline canvas draws, and what a gesture against it looks like.
 *
 * Separated so the painting can be lifted out of the component: every one of
 * these appears in the signature that move needs, and a type that lives inside
 * the file being emptied cannot be named by the file taking the work.
 *
 * They are all plain data. Nothing here knows about React.
 */

import {
  IKaraokeMakerProject,
  IKaraokeMakerToken,
} from '../../common/karaoke/makerProject';
import { TSelection } from './useKaraokeMakerSelection';
import { TMakerDragBehavior } from './makerCanvasGeometry';

/** One syllable, with the line it belongs to already resolved. */
export interface ICanvasLyricToken {
  token: IKaraokeMakerToken;
  tokenIndex: number;
  lineIndex: number;
  lineStartMs: number;
  lineEndMs: number;
  isSection: boolean;
}

/**
 * A whole word, which may be several syllables.
 *
 * The canvas draws words and hit-tests syllables, so both live together: a
 * click lands on a syllable, but the label and the box around it are the
 * word's.
 */
export interface ICanvasLyricWord {
  id: string;
  text: string;
  syllables: ICanvasLyricToken[];
  lineIndex: number;
  wordIndex: number;
  lineStartMs: number;
  lineEndMs: number;
  startMs: number;
  endMs: number;
  isSection: boolean;
}

/**
 * A drag in progress.
 *
 * `base` is the project as it was when the pointer went down. Every frame of
 * the drag is computed from that rather than from the last frame, so a drag
 * cannot accumulate rounding error, and releasing it commits one edit instead
 * of hundreds.
 *
 * The audition fields are the note being played while it is dragged, so the
 * user hears the pitch they are moving to.
 */
export interface IDragState {
  selection: Exclude<TSelection, undefined>;
  behavior: TMakerDragBehavior;
  pointerX: number;
  pointerY: number;
  base: IKaraokeMakerProject;
  noteIds?: string[];
  audioAnchorMs?: number;
  auditionStartMs?: number;
  auditionEndMs?: number;
  auditionStarted?: boolean;
  auditionTimerId?: number;
  finalAuditionMidi?: number;
  finalAuditionDurationMs?: number;
}

/** A rubber-band box being dragged over the notes. */
export interface ICanvasSelectionBox {
  pointerId: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  /** Shift held: add to the selection rather than replace it. */
  additive: boolean;
  initialNoteIds: Set<string>;
}

/** A note being painted directly onto the grid, before it is committed. */
export interface INotePaintDraft {
  pointerId: number;
  startX: number;
  currentX: number;
  y: number;
}

/** A line being dragged from a note to the lyric it should attach to. */
export interface INoteLinkDragState {
  pointerId: number;
  noteId: string;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  initialNoteIds: Set<string>;
}

/** One translated line: its whole-sentence text and how it fits the melody. */
export interface IMakerCanvasTranslationLine {
  text: string;
  fitLabel: string;
  fitOk: boolean;
}

/**
 * The translated row drawn under the original lyric lanes, keyed by the
 * original line's index into `project.lyrics.lines`.
 *
 * The index keys the painter, not the join: `paintTranslation.ts` is handed
 * per-word layout that names the original line by index, so that is what it
 * can look a row up by. Which translated line ended up in that row is decided
 * one layer earlier by `karaokeTranslationLineBySource`, on the translated
 * line's own `sourceLineId` — a sheet's positions stop meaning anything the
 * moment `lyrics.lines` is replaced under it.
 */
export interface IMakerCanvasTranslationRow {
  laneHeight: number;
  lines: Map<number, IMakerCanvasTranslationLine>;
}
