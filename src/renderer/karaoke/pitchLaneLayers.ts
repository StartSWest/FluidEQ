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

import { type IKaraokePitchPoint, PLOT_LEFT } from './karaokePitchGeometry';
import { readAccent, readAccentLight } from '../utils/theme';
import {
  karaokeMakerNoteIsActive,
  karaokeMakerNoteProgress,
} from './makerCanvasLayout';
import {
  midiToNoteName,
  type TKaraokePitchOctavePolicy,
} from '../../common/karaoke/pitch';
import { type IKaraokeToken } from '../../common/karaoke/types';
import { prefersReducedMotion } from '../utils/bandReveal';
import { LYRIC_FONT_FAMILY } from './karaokeLyricText';
import {
  drawnNoteRange,
  freeNoteEdge,
  NOTE_STRENGTH,
  noteBoxHeight,
  paintNoteBox,
  paintNoteName,
  unsungNoteFill,
} from './pitchNoteBox';
import {
  type IJudgedNoteBox,
  paintVerdictChips,
  verdictColour,
} from './pitchLaneVerdicts';
import {
  passedNoteFill,
  paintSungFill,
  sungRunsOverNote,
} from './pitchNoteFill';
import { type IKaraokeLaneVerdict } from './useKaraokeScore';

// The pitch lane's grid and note blocks, in the order the lane stacks them:
// the pitch grid, then the note blocks with their verdicts' chips once sung
// (`pitchLaneVerdicts.ts`); the singer's line goes over both
// (`pitchLaneTrace.ts`). Each box is the one the Maker draws too
// (`pitchNoteBox.ts`). Every size and colour is the E mockup's ("Veredicto
// por nota"; Ivan, 2026-11-16: "it is not at all like the mockups"), on the
// slim strip under the chords that the K1 mockup set out.

interface IPaintPitchGridInput {
  context: CanvasRenderingContext2D;
  yForMidi: (midi: number) => number;
  lowMidi: number;
  highMidi: number;
  semitoneHeight: number;
  plotWidth: number;
  textInk: string;
  /** The note at the playhead, whose name lights up in the gutter. */
  markMidi: number | undefined;
}

/** Where the note names end, right-aligned, left of the plot. */
const NOTE_NAME_RIGHT = PLOT_LEFT - 6;
/** Rows this tall have room for a name each; shorter, only the Cs. */
const NAME_EVERY_ROW_PX = 15;
/** A name this close to the lit one gives way to it rather than overlap. */
const NAME_CLEARANCE_PX = 10;

/**
 * A faint line for every note, the Cs a step stronger in the accent, and the
 * note names at the left: every C, every row tall enough to hold a name, and
 * the note at the playhead lit in the light accent, so the gutter says which
 * row the note being sung is on. Flat on the stage, nothing behind it.
 */
export const paintPitchGrid = ({
  context,
  yForMidi,
  lowMidi,
  highMidi,
  semitoneHeight,
  plotWidth,
  textInk,
  markMidi,
}: IPaintPitchGridInput) => {
  context.lineWidth = 1;
  context.textAlign = 'right';
  context.textBaseline = 'alphabetic';
  const markY = markMidi === undefined ? Number.NaN : yForMidi(markMidi);
  for (
    let midi = Math.ceil(lowMidi - 1e-6);
    midi <= Math.floor(highMidi + 1e-6);
    midi += 1
  ) {
    const y = Math.round(yForMidi(midi)) + 0.5;
    const isOctave = midi % 12 === 0;
    const isMark = midi === markMidi;
    // A semitone's line at 12% and an octave's at 24% (Ivan, 2026-11-16:
    // "make the pitch lines a bit more visible"), over the mockup's 6% and
    // 10%: at those the rows the notes sit on were all but gone over a
    // bright stage.
    context.strokeStyle = isOctave
      ? readAccent(0.24, 'rgba(65, 218, 203, .24)')
      : 'rgba(120, 165, 200, .12)';
    context.beginPath();
    context.moveTo(PLOT_LEFT, y);
    context.lineTo(PLOT_LEFT + plotWidth, y);
    context.stroke();
    const isCrowded = !isMark && Math.abs(y - markY) < NAME_CLEARANCE_PX;
    const hasRoom = isOctave || isMark || semitoneHeight >= NAME_EVERY_ROW_PX;
    if (hasRoom && !isCrowded) {
      let ink = textInk;
      if (isMark) {
        ink = readAccentLight(1, '#a1fcff');
      } else if (isOctave) {
        ink = 'rgb(160, 244, 112)';
      }
      context.fillStyle = ink;
      context.font = `${isMark ? 700 : 400} 10px ${LYRIC_FONT_FAMILY}`;
      context.fillText(midiToNoteName(midi), NOTE_NAME_RIGHT, y + 3);
    }
  }
};

interface IPaintNoteBlocksInput {
  visibleNotes: IKaraokeToken[];
  /**
   * The attempt behind the playhead, whose colours fill each note as it is
   * sung. Absent while nobody sings (no microphone): the note then fills
   * with the plain pale as the playhead crosses it, a guide to follow.
   */
  sung?: {
    trace: readonly IKaraokePitchPoint[];
    centerMidi: number;
    octavePolicy: TKaraokePitchOctavePolicy;
  };
  xForSongTime: (timeMs: number) => number;
  semitoneHeight: number;
  synchronizedPlayheadMs: number;
  yForMidi: (midi: number) => number;
  context: CanvasRenderingContext2D;
  /** The verdict on a note that has ended, where the singer is scored. */
  readVerdict?: (note: IKaraokeToken) => IKaraokeLaneVerdict | undefined;
  verdictLabel: (judged: IKaraokeLaneVerdict) => string;
  now: number;
  plotWidth: number;
}

/**
 * The target's notes. While somebody sings, each fills with the voice's own
 * colours as it is sung and keeps them once it has ended, under the chip
 * that names its verdict (`pitchNoteFill.ts`).
 */
export const paintNoteBlocks = ({
  visibleNotes,
  sung,
  xForSongTime,
  semitoneHeight,
  synchronizedPlayheadMs,
  yForMidi,
  context,
  readVerdict,
  verdictLabel,
  now,
  plotWidth,
}: IPaintNoteBlocksInput) => {
  const judgedBoxes: IJudgedNoteBox[] = [];
  const plotRight = PLOT_LEFT + plotWidth;
  context.save();
  // Held to the plot, as the singer's line is: a note scrolling out at the
  // left used to run on under the gutter and cover the note names there,
  // its chip with it.
  context.beginPath();
  context.rect(PLOT_LEFT, 0, plotWidth, context.canvas.height);
  context.clip();
  visibleNotes.forEach((note) => {
    const shape = drawnNoteRange(note.startMs as number, note.endMs as number);
    const midi = note.targetMidi as number;
    const kind = note.kind ?? 'normal';
    const left = xForSongTime(shape.startMs);
    const right = Math.max(left + 5, xForSongTime(shape.endMs));
    const height = noteBoxHeight(semitoneHeight);
    const top = yForMidi(midi) - height / 2;
    const active = karaokeMakerNoteIsActive(
      shape.startMs,
      shape.endMs,
      synchronizedPlayheadMs,
    );
    // A name or a chip stands over the part of the note in view.
    const shownLeft = Math.max(left, PLOT_LEFT);
    const shownRight = Math.max(shownLeft, Math.min(right, plotRight));
    const judged = kind === 'free' ? undefined : readVerdict?.(note);
    if (judged) {
      judgedBoxes.push({ left: shownLeft, right: shownRight, top, judged });
    }
    const box = { left, right, top, height, kind, ringed: active };
    if (sung && kind !== 'free') {
      // The voice fills the note; silence leaves the part crossed unsung.
      paintNoteBox(context, {
        ...box,
        fill: passedNoteFill(context, {
          left,
          right,
          passedX: xForSongTime(synchronizedPlayheadMs),
          unsung: unsungNoteFill(kind),
          golden: kind === 'golden',
        }),
      });
      paintSungFill(context, {
        left,
        right,
        top,
        height,
        // Gold on gold says nothing until the voice starts covering it.
        goldEdge: kind === 'golden' && synchronizedPlayheadMs >= shape.startMs,
        runs: sungRunsOverNote({
          trace: sung.trace,
          startMs: shape.startMs,
          endMs: shape.endMs,
          playheadMs: synchronizedPlayheadMs,
          targetMidi: midi,
          centerMidi: sung.centerMidi,
          octavePolicy: sung.octavePolicy,
          xForSongTime,
        }),
      });
    } else {
      // Nobody singing, or a free note: a guide, the pale following the
      // playhead, and a judged note in its verdict's colour.
      paintNoteBox(context, {
        ...box,
        fill: judged
          ? verdictColour(judged.verdict, NOTE_STRENGTH)
          : unsungNoteFill(kind),
        freeEdge: freeNoteEdge(),
        progress: active
          ? karaokeMakerNoteProgress(
              shape.startMs,
              shape.endMs,
              synchronizedPlayheadMs,
            )
          : undefined,
      });
    }
    // A judged note's chip stands where its name was.
    if (!judged) {
      paintNoteName(context, {
        midi,
        left: shownLeft,
        right: shownRight,
        top,
        ringed: active,
        bold: active,
      });
    }
  });
  // After every note, so a neighbour's body never covers a chip.
  paintVerdictChips({
    context,
    boxes: judgedBoxes,
    labelOf: verdictLabel,
    now,
    reducedMotion: prefersReducedMotion(),
  });
  context.restore();
};
