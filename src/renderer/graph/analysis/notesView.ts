/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  clamp01,
  type IAnalysisFrame,
  type IAnalysisReading,
  type IAnalysisState,
} from './analysisFrame';
import {
  advanceBars,
  barsMoving,
  paintBarRows,
  type IBarView,
} from './barRows';
import { readFractionalBands } from './octaveBands';

/**
 * The Note spectrum: the same sound, cut into semitones.
 *
 * Every other frequency view here is read in hertz, which is the right unit
 * for an EQ and the wrong one for music: nobody hears 82.4 Hz, they hear a
 * low E. Cut at twelve bands to the octave and marked at every C, the same
 * spectrum becomes something you can read against what you are listening
 * to — which note the bass is actually playing, whether a resonance sits on
 * a note of the song or between two, whether a hum is A or B flat.
 *
 * QUICK, because a note has to appear on the beat it is played. The bars
 * snap up and fall like a meter; the caps hang so a run of notes leaves its
 * shape behind for a moment after the run.
 *
 * With Left & right chosen the bars pair off inside each semitone, so a note
 * that lives on one side is a half-height bar with a tall one beside it.
 */

/** Concert pitch, and the note it names: A4 is the 69th MIDI note. */
const A4_HZ = 440;
const A4_NOTE = 69;

export const NOTE_BARS: IBarView = {
  count: (pieces) => Math.max(8, Math.min(160, pieces)),
  read: (levels, _axis, bands) => readFractionalBands(levels, bands),
  hangMs: 700,
  /** Plot depths per second: quick, to match the bars under the caps. */
  fall: 0.13,
  minGap: 0,
  minWidth: 1,
  pairInset: 0.5,
  capHeight: 2.5,
  capLift: 3,
  capAlpha: 0.8,
  shortest: 0.5,
  radius: () => 0,
};

/** How solid the rule up from each C is, within its copy. */
export const NOTE_RULE_ALPHA = 0.09;

/** Which note a frequency is, as a number of semitones above C−1. */
const noteOf = (frequency: number) =>
  A4_NOTE + 12 * Math.log2(frequency / A4_HZ);

/** One C on the plot: where it stands, and what a keyboard calls it. */
export interface INoteMark {
  x: number;
  name: string;
}

/**
 * The Cs, placed where each C falls on the plot rather than on a band
 * boundary: the bands move with Pieces and the notes do not.
 */
export const noteMarks = (reading: IAnalysisReading): INoteMark[] => {
  const { axis, xs, plot } = reading;
  if (axis.length < 2) {
    return [];
  }
  const lowest = Math.ceil(noteOf(axis[0]));
  const highest = Math.floor(noteOf(axis[axis.length - 1]));
  if (!Number.isFinite(lowest) || !Number.isFinite(highest)) {
    return [];
  }
  const marks: INoteMark[] = [];
  // From the first C at or above the lowest note, in octaves: the marks are
  // every C and nothing else, so the loop counts Cs rather than semitones.
  const firstC = Math.ceil(lowest / 12) * 12;
  for (let note = firstC; note <= highest; note += 12) {
    // Where that C sits, found by walking the axis: the points are
    // log-spaced, so the note's position between two of them is linear here.
    const wanted = A4_HZ * 2 ** ((note - A4_NOTE) / 12);
    let at = 0;
    while (at < axis.length - 2 && axis[at + 1] < wanted) {
      at += 1;
    }
    const from = axis[at];
    const to = axis[at + 1];
    const toward = to > from ? clamp01((wanted - from) / (to - from)) : 0;
    const x = xs[at] + (xs[at + 1] - xs[at]) * toward;
    if (x >= plot.left && x <= plot.right) {
      // The octave number, as a keyboard names it: C4 is middle C.
      marks.push({ x, name: `C${note / 12 - 1}` });
    }
  }
  return marks;
};

/** A faint rule up the copy from each C, under the bars. */
const paintNoteRules = (frame: IAnalysisFrame): void => {
  const { context, band } = frame;
  const foot = band.flipped ? band.top : band.bottom;
  const inward = band.flipped ? 1 : -1;
  const rules = new Path2D();
  noteMarks(frame).forEach(({ x }) => {
    rules.moveTo(x, foot);
    rules.lineTo(x, foot + inward * (band.bottom - band.top));
  });
  context.globalAlpha = band.opacity * NOTE_RULE_ALPHA;
  context.strokeStyle = '#fff';
  context.lineWidth = 1;
  context.stroke(rules);
  context.globalAlpha = 1;
};

/** Each C's name along the foot, over whatever drew the view. */
export const paintNoteWords = (frame: IAnalysisFrame): void => {
  const { context, band } = frame;
  const foot = band.flipped ? band.top : band.bottom;
  const inward = band.flipped ? 1 : -1;
  context.save();
  context.font = '600 9px system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = band.flipped ? 'top' : 'bottom';
  context.globalAlpha = band.opacity * 0.5;
  context.fillStyle = 'rgba(255, 255, 255, 0.6)';
  noteMarks(frame).forEach(({ x, name }) => {
    context.fillText(name, x, foot + inward * 3);
  });
  context.restore();
  context.globalAlpha = 1;
};

const drawNotesView = (
  frame: IAnalysisFrame,
  state: IAnalysisState,
): boolean => {
  paintNoteRules(frame);
  const bars = advanceBars(frame, state, NOTE_BARS);
  paintBarRows(frame, bars, NOTE_BARS);
  return barsMoving(bars);
};

export default drawNotesView;
