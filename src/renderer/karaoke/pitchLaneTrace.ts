/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  easeKaraokeSingerTrace,
  IKaraokePitchPoint,
  IKaraokeTraceAxis,
  karaokeTraceSampleX,
  placeKaraokeTraceSample,
  PLOT_LEFT,
  singerTargetAtTime,
  VISUAL_PITCH_SILENCE_HOLD_MS,
} from './karaokePitchGeometry';
import { type TKaraokePitchOctavePolicy } from '../../common/karaoke/pitch';
import { type IKaraokeToken } from '../../common/karaoke/types';
import { prefersReducedMotion } from '../utils/bandReveal';
import { pitchLineColour } from './pitchLaneVerdicts';

// The singer's line as the E mockup draws it (Ivan, 2026-11-16, "the line
// that draws the boxes has to be exact as I told you"): a thin line at the
// pitch sung, straight through the note boxes, each stretch in the colour of
// how far it is from its note, broken where the singer stops, and a small
// ring on its newest point. It was a thick line on a gradient, sized by the
// voice's loudness, drawn against a squashed copy of the pitch, coloured
// sharp-green and flat-red and running on through every breath.

/** A strip taller than this draws the mockup's heavier line. */
const TALL_STRIP_PX = 150;
const LINE_WIDTH = 1.7;
const TALL_LINE_WIDTH = 2;
const HEAD_RADIUS = 4.6;
const HEAD_PULSE = 0.6;
/** Radians a second of the head's breathing: the mockup's `sin(T * 7)`. */
const HEAD_PULSE_RATE = 7;
const HEAD_DOT_RADIUS = 1.9;

interface IPlacedSample {
  x: number;
  y: number;
  timeMs: number;
  colour: string;
}

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
 * The voiced stretches of the line. A gap no longer than the eased trace
 * holds through silence is bridged: the detector drops a frame now and then
 * mid-vowel, and the mockup's singer never breaks inside a note.
 */
const voicedRuns = (samples: readonly (IPlacedSample | undefined)[]) => {
  const runs: IPlacedSample[][] = [];
  let run: IPlacedSample[] = [];
  samples.forEach((sample) => {
    if (!sample) {
      return;
    }
    const previous = run[run.length - 1];
    if (
      previous &&
      sample.timeMs - previous.timeMs > VISUAL_PITCH_SILENCE_HOLD_MS
    ) {
      runs.push(run);
      run = [];
    }
    run.push(sample);
  });
  if (run.length) {
    runs.push(run);
  }
  return runs;
};

/**
 * One stretch, smoothed through the midpoints between its samples, each piece
 * in its own sample's colour. Round caps close the joins between colours.
 */
const strokeRun = (
  context: CanvasRenderingContext2D,
  run: readonly IPlacedSample[],
) => {
  if (run.length < 2) {
    return;
  }
  const last = run.length - 1;
  for (let index = 0; index <= last; index += 1) {
    const point = run[index];
    const before = run[Math.max(0, index - 1)];
    const after = run[Math.min(last, index + 1)];
    context.strokeStyle = point.colour;
    context.beginPath();
    context.moveTo((before.x + point.x) / 2, (before.y + point.y) / 2);
    context.quadraticCurveTo(
      point.x,
      point.y,
      (point.x + after.x) / 2,
      (point.y + after.y) / 2,
    );
    context.stroke();
  }
};

/**
 * The singer's own pitch, the newest sample on the cursor, folded to the
 * target's octave by the lane's octave policy.
 */
const paintTrace = ({
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
  if (trace.length === 0) {
    return;
  }
  // See `karaokeTraceSampleX`: the newest sample lands on the cursor.
  const traceAxis: IKaraokeTraceAxis = {
    playheadMs: synchronizedPlayheadMs,
    nowMs: now,
    plotWidth,
    hasSongClock,
    usesSongTime: hasTargets,
  };
  // `visibleNotes`, not the whole chart: every point drawn here is inside
  // the window those notes were selected for.
  const placements = trace.map((point) =>
    point.voiced
      ? placeKaraokeTraceSample(
          point.midi,
          singerTargetAtTime(visibleNotes, point.songTimeMs),
          centerMidi,
          octavePolicy,
        )
      : undefined,
  );
  // Only the picture is eased. Scoring and the review read the raw samples,
  // and the colour is the raw sample's, so the line never looks in tune for
  // a moment the singing was not.
  const easedMidis = easeKaraokeSingerTrace(
    trace.map((point, index) => ({
      midi: placements[index]?.midi ?? centerMidi,
      timeMs: hasTargets ? point.songTimeMs : point.wallTimeMs,
      voiced: point.voiced,
    })),
    centerMidi,
  );
  const samples = trace.map((point, index): IPlacedSample | undefined => {
    const placement = placements[index];
    return placement
      ? {
          x: karaokeTraceSampleX(point, traceAxis),
          y: yForMidi(easedMidis[index]),
          timeMs: hasTargets ? point.songTimeMs : point.wallTimeMs,
          colour: pitchLineColour(placement.cents),
        }
      : undefined;
  });

  const stripHeight = plotHeight + plotTop * 2;
  context.save();
  // The line is the one thing on this canvas a microphone places, so it is
  // held to the plot and never paints over the note names in the gutter.
  context.beginPath();
  context.rect(PLOT_LEFT, 0, plotWidth, stripHeight);
  context.clip();
  context.lineJoin = 'round';
  context.lineCap = 'round';
  context.lineWidth =
    stripHeight > TALL_STRIP_PX ? TALL_LINE_WIDTH : LINE_WIDTH;
  voicedRuns(samples).forEach((run) => strokeRun(context, run));

  // The head only while the newest sample is sung: a breath ends the line
  // and takes its ring with it.
  const head = samples[samples.length - 1];
  if (head) {
    const pulse = prefersReducedMotion()
      ? 0
      : Math.sin((now / 1000) * HEAD_PULSE_RATE) * HEAD_PULSE;
    context.strokeStyle = head.colour;
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(head.x, head.y, HEAD_RADIUS + pulse, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.arc(head.x, head.y, HEAD_DOT_RADIUS, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
};

export default paintTrace;
