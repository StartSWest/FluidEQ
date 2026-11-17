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
// that draws the boxes has to be exact as I told you"): a line at the pitch
// sung, straight through the note boxes, each stretch in the colour of how
// far it is from its note, broken where the singer stops, and a small ring
// on its newest point. The mockup's 1.7px hairline was sent back the same
// day as "too skinny" - on his window it all but vanished - so it now has
// the mockup ribbon's weight: a base that grows with the voice's level, a
// soft glow of its own colour, and a dark edge that keeps it apart from a
// note filled in that same colour (`pitchNoteFill.ts`). Only the weight came
// back from the line before the mockup, which was also drawn against a
// squashed copy of the pitch, coloured sharp-green and flat-red, and ran on
// through every breath.

/** A strip taller than this draws a heavier line. */
const TALL_STRIP_PX = 150;
const LINE_WIDTH = 2.5;
const TALL_LINE_WIDTH = 2.9;
/** The most a loud voice adds to the line: the mockup ribbon's 1.6. */
const LEVEL_GROWTH_PX = 1.6;
/**
 * The level the line reads, from a sample's RMS: the scale the microphone's
 * own meter is drawn on (`rms * 3.2`, in `useKaraokeMicrophone.ts`).
 */
const LEVEL_PER_RMS = 3.2;
/** The meter level at which the line has grown all the way. */
const LEVEL_FOR_FULL_GROWTH = 0.65;
/**
 * The glow: two halos of the line's colour, each this much wider than the
 * line at this strength, softening outwards. Strokes, never a canvas blur
 * filter: `filter: blur()` cost 40 ms a frame on this strip in Chromium
 * against 2 ms without it, and the strip repaints every frame.
 */
const GLOW_HALOS: readonly { extraPx: number; alpha: number }[] = [
  { extraPx: 6, alpha: 0.1 },
  { extraPx: 3, alpha: 0.16 },
];
/**
 * The dark edge: under a pixel either side of the line, enough to part it
 * from a fill of its own colour without hiding the fill.
 */
const EDGE_EXTRA_PX = 1.6;
const EDGE_COLOUR = 'rgba(3, 9, 16, 0.62)';
const HEAD_RADIUS = 5;
const HEAD_PULSE = 0.6;
/** Radians a second of the head's breathing: the mockup's `sin(T * 7)`. */
const HEAD_PULSE_RATE = 7;
const HEAD_DOT_RADIUS = 1.9;

interface IPlacedSample {
  x: number;
  y: number;
  timeMs: number;
  colour: string;
  /** The voice's level here, 0 to 1, eased over its neighbours. */
  level: number;
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

/** The piece of a run around one sample, from midpoint to midpoint. */
const tracePiece = (
  context: CanvasRenderingContext2D,
  run: readonly IPlacedSample[],
  index: number,
) => {
  const last = run.length - 1;
  const point = run[index];
  const before = run[Math.max(0, index - 1)];
  const after = run[Math.min(last, index + 1)];
  context.moveTo((before.x + point.x) / 2, (before.y + point.y) / 2);
  context.quadraticCurveTo(
    point.x,
    point.y,
    (point.x + after.x) / 2,
    (point.y + after.y) / 2,
  );
};

/**
 * One stretch, smoothed through the midpoints between its samples. Under it,
 * a glow per colour and one dark edge for the whole stretch - each a single
 * path, so a translucent stroke never doubles up where two pieces meet -
 * then each piece, opaque, in its own sample's colour and as wide as the
 * voice was loud there. Round caps close the joins between them.
 */
const strokeRun = (
  context: CanvasRenderingContext2D,
  run: readonly IPlacedSample[],
  baseWidth: number,
) => {
  if (run.length < 2) {
    return;
  }
  const widthAt = (point: IPlacedSample) =>
    baseWidth + LEVEL_GROWTH_PX * point.level;
  const widest = Math.max(...run.map(widthAt));
  const colours = new Set(run.map((point) => point.colour));
  context.save();
  colours.forEach((colour) => {
    context.strokeStyle = colour;
    context.beginPath();
    run.forEach((point, index) => {
      if (point.colour === colour) {
        tracePiece(context, run, index);
      }
    });
    GLOW_HALOS.forEach(({ extraPx, alpha }) => {
      context.globalAlpha = alpha;
      context.lineWidth = widest + extraPx;
      context.stroke();
    });
  });
  context.restore();
  context.strokeStyle = EDGE_COLOUR;
  context.lineWidth = widest + EDGE_EXTRA_PX;
  context.beginPath();
  run.forEach((_, index) => tracePiece(context, run, index));
  context.stroke();
  run.forEach((point, index) => {
    context.strokeStyle = point.colour;
    context.lineWidth = widthAt(point);
    context.beginPath();
    tracePiece(context, run, index);
    context.stroke();
  });
};

/**
 * Each sample's level, the mean of it and its neighbours: one bucket's RMS
 * jumps, and a line that jumped with it would look frayed.
 */
const easedLevels = (trace: readonly IKaraokePitchPoint[]) =>
  trace.map((_, index) => {
    const around = trace.slice(Math.max(0, index - 1), index + 2);
    const rms =
      around.reduce((sum, point) => sum + point.energy, 0) / around.length;
    return Math.min(1, (rms * LEVEL_PER_RMS) / LEVEL_FOR_FULL_GROWTH);
  });

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
  const levels = easedLevels(trace);
  const samples = trace.map((point, index): IPlacedSample | undefined => {
    const placement = placements[index];
    return placement
      ? {
          x: karaokeTraceSampleX(point, traceAxis),
          y: yForMidi(easedMidis[index]),
          timeMs: hasTargets ? point.songTimeMs : point.wallTimeMs,
          colour: pitchLineColour(placement.cents),
          level: levels[index],
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
  const baseWidth = stripHeight > TALL_STRIP_PX ? TALL_LINE_WIDTH : LINE_WIDTH;
  voicedRuns(samples).forEach((run) => strokeRun(context, run, baseWidth));

  // The head only while the newest sample is sung: a breath ends the line
  // and takes its ring with it.
  const head = samples[samples.length - 1];
  if (head) {
    const pulse = prefersReducedMotion()
      ? 0
      : Math.sin((now / 1000) * HEAD_PULSE_RATE) * HEAD_PULSE;
    context.beginPath();
    context.arc(head.x, head.y, HEAD_RADIUS + pulse, 0, Math.PI * 2);
    context.strokeStyle = EDGE_COLOUR;
    context.lineWidth = 1.5 + EDGE_EXTRA_PX;
    context.stroke();
    context.strokeStyle = head.colour;
    context.lineWidth = 1.5;
    context.stroke();
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.arc(head.x, head.y, HEAD_DOT_RADIUS, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
};

export default paintTrace;
