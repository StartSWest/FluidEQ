/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  type IKaraokeNoteResult,
  type IKaraokeScoreSheet,
} from '../../common/karaoke/scoring';
import {
  karaokeLineResult,
  karaokeRating,
} from '../../common/karaoke/scoringRun';
import { readAccent, readTextInk } from '../utils/theme';
import { drawRoundedRect } from './makerCanvasGeometry';
import { ratingTone } from './karaokeScoreFormat';
import { verdictColour } from './pitchLaneVerdicts';

interface IPaintKaraokeScoreMapInput {
  canvas: HTMLCanvasElement;
  sheet: IKaraokeScoreSheet;
  results: readonly (IKaraokeNoteResult | undefined)[];
  /** "Line 3 · 82 %", for a line wide enough to carry its label. */
  lineLabel: (lineIndex: number, percent: number | undefined) => string;
}

const PAD_X = 6;
const PAD_TOP = 8;
/** Under the notes: each line's tone bar and its label. */
const FOOT = 22;
const LABEL_MIN_PX = 64;
const SEMITONES_AROUND = 1.5;

/**
 * Every note of the song in its verdict's colour, at its pitch and time, and
 * each line's span under them in its rating's tone: the "Mapa de la canción"
 * of the end-of-song card. Drawn once per size; nothing on it moves.
 */
const paintKaraokeScoreMap = ({
  canvas,
  sheet,
  results,
  lineLabel,
}: IPaintKaraokeScoreMapInput) => {
  const bounds = canvas.getBoundingClientRect();
  const width = Math.max(1, bounds.width);
  const height = Math.max(1, bounds.height);
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2.5);
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  const context = canvas.getContext('2d');
  if (!context || !sheet.notes.length) {
    return;
  }
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);

  const [{ startMs }] = sheet.notes;
  const endMs = Math.max(...sheet.notes.map((note) => note.endMs));
  const midis = sheet.notes.map((note) => note.targetMidi);
  const top = Math.max(...midis) + SEMITONES_AROUND;
  const bottom = Math.min(...midis) - SEMITONES_AROUND;
  const plotHeight = height - PAD_TOP - FOOT;
  const semitone = plotHeight / Math.max(1, top - bottom);
  const x = (timeMs: number) =>
    PAD_X +
    ((timeMs - startMs) / Math.max(1, endMs - startMs)) * (width - PAD_X * 2);
  const y = (midi: number) => PAD_TOP + (top - midi) * semitone;

  context.lineWidth = 1;
  for (let midi = Math.ceil(bottom); midi <= Math.floor(top); midi += 1) {
    if (midi % 12 === 0) {
      const lineY = Math.round(y(midi)) + 0.5;
      context.strokeStyle = readAccent(0.1, 'rgba(50, 225, 234, 0.1)');
      context.beginPath();
      context.moveTo(PAD_X, lineY);
      context.lineTo(width - PAD_X, lineY);
      context.stroke();
    }
  }

  const noteHeight = Math.max(4, Math.min(9, semitone * 0.8));
  sheet.notes.forEach((note) => {
    const verdict = results[note.index]?.verdict;
    context.fillStyle =
      verdict === undefined || verdict === 'skipped'
        ? readAccent(0.16, 'rgba(50, 225, 234, 0.16)')
        : verdictColour(verdict, 0.92);
    drawRoundedRect(
      context,
      x(note.startMs),
      y(note.targetMidi) - noteHeight / 2,
      Math.max(2, x(note.endMs) - x(note.startMs) - 1),
      noteHeight,
      2,
    );
    context.fill();
  });

  context.font = '600 10px system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'alphabetic';
  sheet.lines.forEach((line) => {
    const { share } = karaokeLineResult(line, sheet, results);
    const left = x(line.startMs);
    const right = x(line.endMs);
    if (share !== undefined) {
      const tone = ratingTone(karaokeRating(share));
      let verdict: 'perfect' | 'late' | 'low' = 'perfect';
      if (tone === 'near') {
        verdict = 'late';
      } else if (tone === 'off') {
        verdict = 'low';
      }
      context.fillStyle = verdictColour(verdict, 0.9);
    } else {
      context.fillStyle = readAccent(0.2, 'rgba(50, 225, 234, 0.2)');
    }
    context.fillRect(left, height - FOOT + 4, Math.max(2, right - left - 2), 2);
    if (right - left >= LABEL_MIN_PX) {
      context.fillStyle = readTextInk();
      context.fillText(
        lineLabel(line.index, share === undefined ? undefined : share * 100),
        (left + right) / 2,
        height - 3,
        right - left - 4,
      );
    }
  });
};

export default paintKaraokeScoreMap;
