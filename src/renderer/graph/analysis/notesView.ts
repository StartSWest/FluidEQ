/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  STILL_ENOUGH,
  advanceHold,
  clamp01,
  placeLevel,
  rampRgba,
  scratch,
  type IAnalysisFrame,
  type IAnalysisState,
} from './analysisFrame';
import { asMate, paintChannelLegend, paintLegend } from './channelInk';
import { readFractionalBands } from './octaveBands';
import { paintTexture, piecePaint, spectrumInk } from './spectrumPaint';

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

/** The note names, from C, for the marks along the drawing. */
const NOTE_NAMES = [
  'C',
  'C♯',
  'D',
  'D♯',
  'E',
  'F',
  'F♯',
  'G',
  'G♯',
  'A',
  'A♯',
  'B',
] as const;

/** Concert pitch, and the note it names: A4 is the 69th MIDI note. */
const A4_HZ = 440;
const A4_NOTE = 69;

const HOLD_HANG_MS = 700;

/** Plot depths per second: quick, to match the bars under the caps. */
const HOLD_FALL = 0.13;

const CAP_HEIGHT = 2.5;
const CAP_LIFT = 3;

/** Which note a frequency is, as a number of semitones above C−1. */
const noteOf = (frequency: number) =>
  A4_NOTE + 12 * Math.log2(frequency / A4_HZ);

/**
 * The C marks, written where the C falls on the plot rather than on a band
 * boundary: the bands move with Pieces and the notes do not.
 */
const paintNoteMarks = (frame: IAnalysisFrame): void => {
  const { context, axis, xs, band, plot } = frame;
  if (axis.length < 2) {
    return;
  }
  const lowest = Math.ceil(noteOf(axis[0]));
  const highest = Math.floor(noteOf(axis[axis.length - 1]));
  if (!Number.isFinite(lowest) || !Number.isFinite(highest)) {
    return;
  }
  const foot = band.flipped ? band.top : band.bottom;
  const inward = band.flipped ? 1 : -1;
  context.save();
  context.font = '600 9px system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = band.flipped ? 'top' : 'bottom';
  const rules = new Path2D();
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
      rules.moveTo(x, foot);
      rules.lineTo(x, foot + inward * (band.bottom - band.top));
      context.globalAlpha = band.opacity * 0.5;
      context.fillStyle = 'rgba(255, 255, 255, 0.6)';
      // The octave number, as a keyboard names it: C4 is middle C.
      context.fillText(`C${note / 12 - 1}`, x, foot + inward * 3);
    }
  }
  context.globalAlpha = band.opacity * 0.09;
  context.strokeStyle = '#fff';
  context.lineWidth = 1;
  context.stroke(rules);
  context.restore();
  context.globalAlpha = 1;
};

/** One channel's row of bars and its caps, as two paths. */
const buildRow = (
  frame: IAnalysisFrame,
  bands: Float64Array,
  hold: Float64Array,
  columnAt: (index: number) => { left: number; width: number },
) => {
  const { band } = frame;
  const foot = band.flipped ? band.top : band.bottom;
  const bodies = new Path2D();
  const caps = new Path2D();
  for (let index = 0; index < bands.length; index += 1) {
    const { left, width } = columnAt(index);
    const head = placeLevel(band, bands[index]);
    if (Math.abs(head - foot) > 0.5) {
      bodies.rect(left, Math.min(head, foot), width, Math.abs(head - foot));
    }
    if (hold[index] > 0.004) {
      const row = placeLevel(band, hold[index]);
      caps.rect(
        left,
        band.flipped ? row + CAP_LIFT : row - CAP_LIFT - CAP_HEIGHT,
        width,
        CAP_HEIGHT,
      );
    }
  }
  return { bodies, caps };
};

const paintRow = (
  frame: IAnalysisFrame,
  row: { bodies: Path2D; caps: Path2D },
  loudest: number,
  strength: number,
): void => {
  const { context, tuning, band } = frame;
  context.globalAlpha = band.opacity * strength;
  if (tuning.filled) {
    context.fillStyle = piecePaint(
      frame,
      frame.colours,
      loudest,
      tuning.fillOpacity,
    );
    context.fill(row.bodies);
    paintTexture(frame, row.bodies, tuning.fillOpacity * strength);
  } else {
    context.lineWidth = frame.edge.width;
    context.strokeStyle = spectrumInk(frame, frame.levels);
    context.stroke(row.bodies);
  }
  context.globalAlpha = band.opacity * strength * 0.8;
  context.fillStyle = '#fff';
  context.fill(row.caps);
  context.globalAlpha = 1;
};

const drawNotesView = (
  frame: IAnalysisFrame,
  state: IAnalysisState,
): boolean => {
  const { tuning, levels, plot, split, deltaMs } = frame;
  const count = Math.max(8, Math.min(160, Math.round(tuning.columns)));
  const span = (plot.right - plot.left) / count;
  const gap = span * clamp01(tuning.gap);
  paintNoteMarks(frame);

  if (split) {
    const [leftBands, leftHold, leftMs, rightBands, rightHold, rightMs] =
      scratch(state, count, 6);
    readFractionalBands(split[0], leftBands);
    readFractionalBands(split[1], rightBands);
    const loudest = Math.max(
      advanceHold(
        leftHold,
        leftMs,
        leftBands,
        deltaMs,
        HOLD_HANG_MS,
        HOLD_FALL,
      ),
      advanceHold(
        rightHold,
        rightMs,
        rightBands,
        deltaMs,
        HOLD_HANG_MS,
        HOLD_FALL,
      ),
    );
    const pair = Math.max(1, (span - gap) / 2 - 0.5);
    const columnAt = (side: number) => (index: number) => ({
      left: plot.left + index * span + gap / 2 + side * (pair + 1),
      width: pair,
    });
    const behind = asMate(frame);
    paintRow(
      behind,
      buildRow(frame, rightBands, rightHold, columnAt(1)),
      loudest,
      0.92,
    );
    paintRow(
      frame,
      buildRow(frame, leftBands, leftHold, columnAt(0)),
      loudest,
      1,
    );
    paintChannelLegend(frame, frame.channelLabels);
    return loudest > STILL_ENOUGH;
  }

  const [bands, hold, holdMs] = scratch(state, count, 3);
  readFractionalBands(levels, bands);
  const loudest = advanceHold(
    hold,
    holdMs,
    bands,
    deltaMs,
    HOLD_HANG_MS,
    HOLD_FALL,
  );
  const width = Math.max(1, span - gap);
  paintRow(
    frame,
    buildRow(frame, bands, hold, (index) => ({
      left: plot.left + index * span + gap / 2,
      width,
    })),
    loudest,
    1,
  );
  paintLegend(frame, [
    { label: frame.legend.live, ink: rampRgba(frame.colours, 0.75, 1) },
    { label: frame.legend.peak, ink: 'rgba(255, 255, 255, 0.95)' },
  ]);
  return loudest > STILL_ENOUGH;
};

export default drawNotesView;
export { NOTE_NAMES };
