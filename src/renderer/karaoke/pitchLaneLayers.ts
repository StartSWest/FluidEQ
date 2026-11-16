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
  type IKaraokeMelodyGuidePoint,
  IKaraokePitchPoint,
  IKaraokeTraceAxis,
  karaokeNoteTimingState,
  karaokeTraceSampleX,
  MATCH_TOLERANCE_SEMITONES,
  PLOT_LEFT,
  roundedRectPath,
  singerTargetAtTime,
  targetAtTime,
  traceColor,
} from './karaokePitchGeometry';
import { readAccent, readAccentLight } from '../utils/theme';
import {
  projectSingerPitchToTarget,
  singerPitchMatchesTarget,
  type TKaraokePitchOctavePolicy,
} from '../../common/karaoke/pitch';
import { karaokeLeadNoteShape } from '../../common/karaoke/melodyArticulation';
import { type IKaraokeToken } from '../../common/karaoke/types';

// The pitch lane's layers, each painted by one function in the order the
// lane stacks them: the pitch grid, the note blocks, the guide melody and
// the singer's trace. Called from the lane's frame with what that frame
// measured. The lane is the slim strip under the chords that the K1 mockup
// draws (Ivan, 2026-11-15, "fix the pitch as you promised"): the words
// band over it, the note names, the semitone labels, the seconds ruler,
// the review strip and the legend were all taken off it.

interface IPaintPitchGridInput {
  firstPitchTick: number;
  topPitchTick: number;
  lineStep: number;
  yForMidi: (midi: number) => number;
  context: CanvasRenderingContext2D;
  plotWidth: number;
}

/** Faint pitch lines every `lineStep` semitones from a C, unlabelled. */
export const paintPitchGrid = ({
  firstPitchTick,
  topPitchTick,
  lineStep,
  yForMidi,
  context,
  plotWidth,
}: IPaintPitchGridInput) => {
  context.strokeStyle = 'rgba(214, 233, 247, 0.06)';
  context.lineWidth = 1;
  for (
    let tickMidi = firstPitchTick;
    tickMidi <= topPitchTick;
    tickMidi += lineStep
  ) {
    const y = Math.round(yForMidi(tickMidi)) + 0.5;
    context.beginPath();
    context.moveTo(PLOT_LEFT, y);
    context.lineTo(PLOT_LEFT + plotWidth, y);
    context.stroke();
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

/** The target's note blocks, lit while the singer is on them. */
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
    const { endMs } = karaokeLeadNoteShape({
      startMs,
      endMs: note.endMs as number,
      targetMidi: note.targetMidi,
      kind: note.kind,
    });
    const midi = note.targetMidi as number;
    const x = xForSongTime(startMs);
    const noteWidth = Math.max(3, xForSongTime(endMs) - x);
    const noteHeight = Math.max(4, semitoneHeight * 0.76);
    let noteColor = 'rgba(83, 139, 238, 0.68)';
    let noteEdge = readAccent(0.88, 'rgba(61, 214, 226, 0.88)');
    if (note.kind === 'free') {
      noteColor = 'rgba(83, 139, 238, 0.25)';
      noteEdge = 'rgba(83, 139, 238, 0.42)';
    }
    const isPitchMatch =
      note.kind !== 'free' &&
      latestVoicedPoint !== undefined &&
      latestVoicedPoint.songTimeMs >= startMs &&
      latestVoicedPoint.songTimeMs <= endMs &&
      singerPitchMatchesTarget(
        latestVoicedPoint.midi,
        midi,
        octavePolicy,
        MATCH_TOLERANCE_SEMITONES,
      );
    const timingState = karaokeNoteTimingState(
      startMs,
      endMs,
      synchronizedPlayheadMs,
    );
    if (isPitchMatch) {
      noteColor = readAccent(0.96, 'rgba(40, 242, 213, 0.96)');
      noteEdge = readAccentLight(1, 'rgba(226, 255, 250, 1)');
    }
    const noteY = yForMidi(midi) - noteHeight / 2;
    const noteGradient = context.createLinearGradient(
      x,
      noteY,
      x + noteWidth,
      noteY,
    );
    noteGradient.addColorStop(0, noteEdge);
    noteGradient.addColorStop(0.35, noteColor);
    noteGradient.addColorStop(1, noteColor);
    context.fillStyle = noteGradient;
    roundedRectPath(context, x, noteY, noteWidth, noteHeight);
    context.fill();

    if (timingState !== 'idle') {
      let timingBorder = readAccent(0.5, 'rgba(34, 224, 214, 0.5)');
      if (timingState === 'active') {
        timingBorder = 'rgba(48, 145, 255, 1)';
      }
      if (isPitchMatch) {
        timingBorder = readAccentLight(1, 'rgba(226, 255, 250, 1)');
      }
      context.strokeStyle = timingBorder;
      context.lineWidth = timingState === 'active' ? 2.2 : 1.35;
      context.setLineDash([]);
      roundedRectPath(context, x, noteY, noteWidth, noteHeight);
      context.stroke();
    }
  });
};

interface IPaintMelodyGuideInput {
  melodyGuide: IKaraokeMelodyGuidePoint[];
  context: CanvasRenderingContext2D;
  xForSongTime: (timeMs: number) => number;
  yForMidi: (midi: number) => number;
  plotWidth: number;
  visibleNotes: IKaraokeToken[];
  synchronizedPlayheadMs: number;
}

/**
 * The guide melody as one singer-like curve over the note blocks.
 */
export const paintMelodyGuide = ({
  melodyGuide,
  context,
  xForSongTime,
  yForMidi,
  plotWidth,
  visibleNotes,
  synchronizedPlayheadMs,
}: IPaintMelodyGuideInput) => {
  if (melodyGuide.length > 1) {
    const guidePath = () => {
      context.beginPath();
      let previous: { x: number; y: number; startsPhrase: boolean } | undefined;
      melodyGuide.forEach((point) => {
        const plotted = {
          x: xForSongTime(point.songTimeMs),
          y: yForMidi(point.midi),
          startsPhrase: point.startsPhrase,
        };
        if (!previous || plotted.startsPhrase) {
          context.moveTo(plotted.x, plotted.y);
        } else {
          const controlX = (previous.x + plotted.x) / 2;
          context.bezierCurveTo(
            controlX,
            previous.y,
            controlX,
            plotted.y,
            plotted.x,
            plotted.y,
          );
        }
        previous = plotted;
      });
    };
    const guideGradient = context.createLinearGradient(
      PLOT_LEFT,
      0,
      PLOT_LEFT + plotWidth,
      0,
    );
    guideGradient.addColorStop(0, 'rgba(91, 147, 235, 0.34)');
    guideGradient.addColorStop(0.2, 'rgba(123, 195, 255, 0.82)');
    guideGradient.addColorStop(
      1,
      readAccent(0.76, 'rgba(107, 233, 242, 0.76)'),
    );
    // One sharp line. It ran over a 6px haze of its own blue under a
    // 10px glow, and the lane read as lit fog (Ivan, 2026-09-26: the
    // pitch lane "need to be clean and nice").
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.setLineDash([]);
    context.strokeStyle = guideGradient;
    context.lineWidth = 1.8;
    guidePath();
    context.stroke();

    const guideTargetMidi = targetAtTime(
      visibleNotes.filter((note) => note.kind !== 'free'),
      synchronizedPlayheadMs,
    );
    if (guideTargetMidi !== undefined) {
      const guideY = yForMidi(guideTargetMidi);
      const guideX = xForSongTime(synchronizedPlayheadMs);
      context.fillStyle = readAccentLight(1, '#dff8ff');
      context.beginPath();
      context.arc(guideX, guideY, 3, 0, Math.PI * 2);
      context.fill();
    }
  }
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
