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

import {
  attachKaraokePitchToNote,
  easeKaraokeSingerTrace,
  IKaraokePitchPoint,
  IKaraokeTraceAxis,
  karaokeTraceSampleX,
  MATCH_TOLERANCE_SEMITONES,
  PLOT_LEFT,
  singerTargetAtTime,
  traceColor,
} from './karaokePitchGeometry';
import { readAccent, readAccentLight } from '../utils/theme';
import { drawRoundedRect } from './makerCanvasGeometry';
import {
  karaokeMakerNoteIsActive,
  karaokeMakerNoteProgress,
} from './makerCanvasLayout';
import {
  midiToNoteName,
  projectSingerPitchToTarget,
  singerPitchMatchesTarget,
  type TKaraokePitchOctavePolicy,
} from '../../common/karaoke/pitch';
import { karaokeLeadNoteShape } from '../../common/karaoke/melodyArticulation';
import { type IKaraokeToken } from '../../common/karaoke/types';

// The pitch lane's layers, each painted by one function in the order the
// lane stacks them: the pitch grid, the note blocks and the singer's trace. Called from the lane's frame with what that frame
// measured. The lane is the slim strip under the chords that the K1 mockup
// draws (Ivan, 2026-11-15, "fix the pitch as you promised"): the words
// band over it, the note names, the semitone labels, the seconds ruler,
// the review strip and the legend were all taken off it.

interface IPaintPitchGridInput {
  context: CanvasRenderingContext2D;
  yForMidi: (midi: number) => number;
  lowMidi: number;
  highMidi: number;
  semitoneHeight: number;
  plotWidth: number;
  textInk: string;
}

/** Where the note names end, right-aligned, left of the plot. */
const NOTE_NAME_RIGHT = PLOT_LEFT - 6;
/** Rows this tall have room for a name each; shorter, only the Cs. */
const NAME_EVERY_ROW_PX = 15;

/**
 * The Maker's pitch grid, drawn the same here (Ivan, 2026-11-16: "add the
 * notes to the pitch lane too, to the left"): a faint line for every note,
 * the Cs a step stronger in the accent, and the note names at the left -
 * every C, and every row where a row is tall enough to hold one
 * (`makerCanvas/paintBackdrop.ts`). Flat on the stage, nothing behind it.
 */
export const paintPitchGrid = ({
  context,
  yForMidi,
  lowMidi,
  highMidi,
  semitoneHeight,
  plotWidth,
  textInk,
}: IPaintPitchGridInput) => {
  context.lineWidth = 1;
  context.font = '10px system-ui, sans-serif';
  context.textAlign = 'right';
  context.textBaseline = 'alphabetic';
  for (
    let midi = Math.ceil(lowMidi - 1e-6);
    midi <= Math.floor(highMidi + 1e-6);
    midi += 1
  ) {
    const y = Math.round(yForMidi(midi)) + 0.5;
    const isOctave = midi % 12 === 0;
    context.strokeStyle = isOctave
      ? readAccent(0.09, 'rgba(65, 218, 203, .09)')
      : 'rgba(71, 116, 151, .045)';
    context.beginPath();
    context.moveTo(PLOT_LEFT, y);
    context.lineTo(PLOT_LEFT + plotWidth, y);
    context.stroke();
    if (isOctave || semitoneHeight >= NAME_EVERY_ROW_PX) {
      context.fillStyle = isOctave ? 'rgb(160, 244, 112)' : textInk;
      context.fillText(midiToNoteName(midi), NOTE_NAME_RIGHT, y + 3);
    }
  }
};

interface IPaintNoteBlocksInput {
  visibleNotes: IKaraokeToken[];
  xForSongTime: (timeMs: number) => number;
  semitoneHeight: number;
  latestVoicedPoint: IKaraokePitchPoint | undefined;
  octavePolicy: TKaraokePitchOctavePolicy;
  synchronizedPlayheadMs: number;
  yForMidi: (midi: number) => number;
  context: CanvasRenderingContext2D;
}

// The Maker's note, drawn the same here (Ivan, 2026-11-16: "fix the pitch
// notes and highlight to be like the Maker"): flat, a 2px corner, and the
// note under the playhead filling with the light accent as it is sung, with
// a ring standing off it (`makerCanvas/paintNotes.ts`).
const NOTE_CORNER = 2;
const NOTE_RING_GAP = 2.5;

/** The target's notes, as the Maker draws them. */
export const paintNoteBlocks = ({
  visibleNotes,
  xForSongTime,
  semitoneHeight,
  latestVoicedPoint,
  octavePolicy,
  synchronizedPlayheadMs,
  yForMidi,
  context,
}: IPaintNoteBlocksInput) => {
  visibleNotes.forEach((note) => {
    const startMs = note.startMs as number;
    const shape = karaokeLeadNoteShape({
      startMs,
      endMs: note.endMs as number,
      targetMidi: note.targetMidi,
      kind: note.kind,
    });
    const midi = note.targetMidi as number;
    const left = xForSongTime(shape.startMs);
    const right = Math.max(left + 5, xForSongTime(shape.endMs));
    const noteHeight = Math.max(8, semitoneHeight * 0.8);
    const top = yForMidi(midi) - noteHeight / 2;
    const isGolden = note.kind === 'golden';
    const isFree = note.kind === 'free';
    const active = karaokeMakerNoteIsActive(
      shape.startMs,
      shape.endMs,
      synchronizedPlayheadMs,
    );
    // Sung in tune right now: the note takes the Maker's selected fill.
    const isPitchMatch =
      !isFree &&
      latestVoicedPoint !== undefined &&
      latestVoicedPoint.songTimeMs >= shape.startMs &&
      latestVoicedPoint.songTimeMs <= shape.endMs &&
      singerPitchMatchesTarget(
        latestVoicedPoint.midi,
        midi,
        octavePolicy,
        MATCH_TOLERANCE_SEMITONES,
      );

    let fill = readAccent(0.85, 'rgba(88, 191, 215, .85)');
    if (isPitchMatch) {
      fill = readAccentLight(1, '#bffff7');
    }
    if (isGolden) {
      fill = '#ffd25a';
    } else if (isFree) {
      fill = readAccent(0.24, 'rgba(88, 191, 215, .24)');
    }
    context.save();
    context.fillStyle = fill;
    drawRoundedRect(context, left, top, right - left, noteHeight, NOTE_CORNER);
    context.fill();
    if (isFree) {
      // Hollow: a note sung to no pitch.
      context.setLineDash([4, 3]);
      context.lineWidth = 1.6;
      context.strokeStyle = readAccent(0.85, 'rgba(88, 191, 215, .85)');
      context.stroke();
      context.setLineDash([]);
    }
    if (active) {
      const progressRight =
        left +
        (right - left) *
          karaokeMakerNoteProgress(
            shape.startMs,
            shape.endMs,
            synchronizedPlayheadMs,
          );
      // The sung part in the light accent, flat as the note under it.
      context.save();
      drawRoundedRect(
        context,
        left,
        top,
        right - left,
        noteHeight,
        NOTE_CORNER,
      );
      context.clip();
      context.fillStyle = isGolden ? '#fff0a8' : readAccentLight(1, '#e8fffd');
      context.fillRect(
        left,
        top,
        Math.max(1, progressRight - left),
        noteHeight,
      );
      context.restore();
      const playbackX = Math.max(left, Math.min(right, progressRight));
      context.strokeStyle = isGolden
        ? '#fff7a3'
        : readAccentLight(1, '#effffc');
      context.lineWidth = 1.2;
      context.beginPath();
      context.moveTo(playbackX, top + 1);
      context.lineTo(playbackX, top + noteHeight - 1);
      context.stroke();
      // The ring round the note, apart from it by a hair.
      context.lineWidth = 1.5;
      context.strokeStyle = isGolden
        ? 'rgba(255, 240, 168, .95)'
        : readAccentLight(0.95, 'rgba(191, 255, 247, .95)');
      drawRoundedRect(
        context,
        left - NOTE_RING_GAP,
        top - NOTE_RING_GAP,
        right - left + NOTE_RING_GAP * 2,
        noteHeight + NOTE_RING_GAP * 2,
        NOTE_CORNER + NOTE_RING_GAP,
      );
      context.stroke();
    }
    context.restore();
    // Each note's name over it, as the Maker prints it, lifted clear of
    // the ring when there is one.
    context.fillStyle = active
      ? 'rgba(245, 255, 254, .98)'
      : readAccentLight(1, '#cfe7ee');
    context.font = `${active ? 700 : 600} 9px system-ui, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'alphabetic';
    context.fillText(
      midiToNoteName(midi),
      left + (right - left) / 2,
      top - 4 - (active ? NOTE_RING_GAP + 1 : 0),
    );
  });
};

interface IPaintTraceInput {
  trace: IKaraokePitchPoint[];
  synchronizedPlayheadMs: number;
  now: number;
  plotWidth: number;
  hasSongClock: boolean;
  hasTargets: boolean;
  visibleNotes: IKaraokeToken[];
  centerMidi: number;
  octavePolicy: TKaraokePitchOctavePolicy;
  yForMidi: (midi: number) => number;
  context: CanvasRenderingContext2D;
  plotTop: number;
  plotHeight: number;
}

/**
 * The singer's own pitch, the newest sample on the cursor, folded to the
 * target's octave by the lane's octave policy.
 */
export const paintTrace = ({
  trace,
  synchronizedPlayheadMs,
  now,
  plotWidth,
  hasSongClock,
  hasTargets,
  visibleNotes,
  centerMidi,
  octavePolicy,
  yForMidi,
  context,
  plotTop,
  plotHeight,
}: IPaintTraceInput) => {
  if (trace.length > 0) {
    // See `karaokeTraceSampleX`: the newest sample lands on the cursor.
    const traceAxis: IKaraokeTraceAxis = {
      playheadMs: synchronizedPlayheadMs,
      nowMs: now,
      plotWidth,
      hasSongClock,
      usesSongTime: hasTargets,
    };
    const xForTracePoint = (point: IKaraokePitchPoint) =>
      karaokeTraceSampleX(point, traceAxis);
    const visualPitchSamples = trace.map((point) => {
      // `visibleNotes`, not the whole chart: every point drawn here is
      // inside the window those notes were selected for, and searching a
      // three-minute song's worth of syllables per sample per frame was
      // paying for several thousand lookups a second to answer with one
      // of the forty notes on screen.
      const noteMidi = singerTargetAtTime(visibleNotes, point.songTimeMs);
      return {
        // Three steps, in this order, and each undoes a different kind of
        // wrongness. The octave projection decides whether a bass singing
        // an octave down counts as the same note. The attachment draws the
        // remaining error against that note instead of against the whole
        // lane — see `attachKaraokePitchToNote` for why compressing beats
        // snapping. The easing, further down, calms the detector.
        //
        // Only the picture is touched. Scoring and the performance review
        // read the raw samples, so a curve that sits on the note does not
        // quietly award marks the singing did not earn.
        midi: point.voiced
          ? attachKaraokePitchToNote(
              projectSingerPitchToTarget(
                point.midi,
                noteMidi ?? centerMidi,
                octavePolicy,
              ),
              noteMidi,
            )
          : centerMidi,
        timeMs: hasTargets ? point.songTimeMs : point.wallTimeMs,
        voiced: point.voiced,
      };
    });
    const easedMidis = easeKaraokeSingerTrace(visualPitchSamples, centerMidi);
    const plottedTrace = trace.map((point, index) => ({
      ...point,
      x: xForTracePoint(point),
      y: yForMidi(easedMidis[index]),
    }));
    const first = plottedTrace[0];
    const last = plottedTrace[plottedTrace.length - 1];
    const previous = plottedTrace[plottedTrace.length - 2];
    const headColor = traceColor(last, previous, visibleNotes, octavePolicy);
    const tracePath = () => {
      context.beginPath();
      context.moveTo(first.x, first.y);
      for (let index = 1; index < plottedTrace.length - 1; index += 1) {
        const point = plottedTrace[index];
        const next = plottedTrace[index + 1];
        context.quadraticCurveTo(
          point.x,
          point.y,
          (point.x + next.x) / 2,
          (point.y + next.y) / 2,
        );
      }
      context.lineTo(last.x, last.y);
    };

    context.lineJoin = 'round';
    context.lineCap = 'round';
    // The curve is the one thing on this canvas whose extent is decided by
    // a microphone rather than by the layout, so it is the one thing that
    // can run off the plot and paint over the semitone labels in the left
    // gutter. Held to the plot rectangle it simply leaves at the edge.
    context.save();
    context.beginPath();
    context.rect(PLOT_LEFT, plotTop - 6, plotWidth, plotHeight + 12);
    context.clip();

    // The microphone is one continuous pitch curve over the song blocks.
    // Input energy changes its weight; the presentation-only pitch easing
    // above calms detector wobble without changing scoring coordinates.
    const microphoneGradient = context.createLinearGradient(
      first.x,
      0,
      Math.max(first.x + 1, last.x),
      0,
    );
    const range = Math.max(1, last.x - first.x);
    plottedTrace.forEach((point, index) => {
      microphoneGradient.addColorStop(
        Math.max(0, Math.min(1, (point.x - first.x) / range)),
        traceColor(point, plottedTrace[index - 1], visibleNotes, octavePolicy),
      );
    });
    // One stroke that thickens as the voice gets louder. It was a 6px
    // haze under a glow sized by the same energy — the loudness is still
    // there, in the line's own weight rather than in a blur round it.
    context.globalAlpha = Math.max(0.72, last.confidence);
    context.strokeStyle = microphoneGradient;
    context.lineWidth = 2.1 + Math.min(1.6, last.energy * 3);
    tracePath();
    context.stroke();
    context.globalAlpha = 1;

    // The voice's head: a ring that breathes while it sings, round a
    // point. It was a radial glow the ring's size.
    const pulse = last.voiced ? 4.6 + Math.sin(now / 145) * 0.75 : 2.7;
    context.strokeStyle = headColor;
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(last.x, last.y, pulse, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = last.voiced ? '#ffffff' : headColor;
    context.beginPath();
    context.arc(last.x, last.y, 1.8, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
};
