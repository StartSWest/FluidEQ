/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type TKaraokePitchOctavePolicy } from '../../common/karaoke/pitch';
import {
  type IKaraokePitchPoint,
  PERFORMANCE_BUCKET_MS,
  placeKaraokeTraceSample,
  VISUAL_PITCH_SILENCE_HOLD_MS,
} from './karaokePitchGeometry';
import { drawRoundedRect } from './makerCanvasGeometry';
import { NOTE_CORNER } from './pitchNoteBox';
import { pitchLineColour } from './pitchLaneVerdicts';

// What the singer's voice leaves inside a note on the pitch strip (Ivan,
// 2026-11-16: "the filling inside the notes needs to be like the voice
// filling"). The box fills from its left as it is sung, each stretch in the
// colour the singer's line had there - green in tune, yellow close, red off,
// the same classes and the same folding to the note's octave - blended from
// one sample to the next as the line is, and glowing as the line does. The
// fill stays once the note has ended: the note keeps what was sung over it
// as its verdict, beside the chip that names it. It used to fill with one
// flat pale colour while sung and then turn into a solid block of its
// verdict's colour, which said nothing about which part went wrong.

/** One sample of the voice inside a note: where it lands and its colour. */
export interface ISungStop {
  x: number;
  colour: string;
}

/** A stretch the singer kept singing, from `left` to `right`. */
export interface ISungRun {
  left: number;
  right: number;
  stops: readonly ISungStop[];
}

/**
 * A note's part the playhead has crossed with nobody singing: the mockup's
 * faint text colour, the colour a missed note's chip wears, so silence reads
 * as neither a note still to sing (accent) nor a pitch (green, yellow, red).
 */
const PASSED_WELL = 'rgba(236, 245, 251, 0.2)';
const GOLDEN_PASSED_WELL = 'rgba(255, 210, 90, 0.26)';
const GOLDEN_EDGE = 'rgba(255, 224, 130, 0.9)';
/** The fill a shade under full, so the box's own edge still reads. */
const FILL_STRENGTH = 0.92;
/**
 * The light the voice spills round its fill, as the line's glow does: two
 * halos, each standing this far off the box at this strength. Never a canvas
 * blur filter, which cost 40 ms a frame on this strip (`pitchLaneTrace.ts`).
 */
const GLOW_HALOS: readonly { spreadPx: number; alpha: number }[] = [
  { spreadPx: 3.5, alpha: 0.1 },
  { spreadPx: 1.5, alpha: 0.18 },
];

interface ISungRunsInput {
  /** The attempt behind the playhead, in song order. */
  trace: readonly IKaraokePitchPoint[];
  startMs: number;
  endMs: number;
  playheadMs: number;
  targetMidi: number;
  centerMidi: number;
  octavePolicy: TKaraokePitchOctavePolicy;
  xForSongTime: (timeMs: number) => number;
}

/**
 * The stretches of a note the singer has sung so far. Runs break exactly
 * where the line does (`voicedRuns` in `pitchLaneTrace.ts`): a dropout no
 * longer than the eased trace holds through silence is bridged, so the fill
 * never shows a hole the line does not. Each sample covers its bucket of
 * the attempt; the run being sung reaches the playhead, where the line's
 * head is.
 */
export const sungRunsOverNote = ({
  trace,
  startMs,
  endMs,
  playheadMs,
  targetMidi,
  centerMidi,
  octavePolicy,
  xForSongTime,
}: ISungRunsInput): ISungRun[] => {
  const untilMs = Math.min(endMs, playheadMs);
  if (untilMs <= startMs) {
    return [];
  }
  const halfBucketMs = PERFORMANCE_BUCKET_MS / 2;
  const newest = trace[trace.length - 1];
  const runs: ISungRun[] = [];
  let points: IKaraokePitchPoint[] = [];
  const close = () => {
    if (points.length === 0) {
      return;
    }
    const first = points[0];
    const last = points[points.length - 1];
    // Still being sung: the fill meets the playhead, as the line does.
    const reachesPlayhead =
      last === newest &&
      playheadMs - last.songTimeMs <= VISUAL_PITCH_SILENCE_HOLD_MS;
    const leftMs = Math.max(startMs, first.songTimeMs - halfBucketMs);
    const rightMs = reachesPlayhead
      ? untilMs
      : Math.min(untilMs, last.songTimeMs + halfBucketMs);
    if (rightMs > leftMs) {
      runs.push({
        left: xForSongTime(leftMs),
        right: xForSongTime(rightMs),
        stops: points.map((point) => ({
          x: xForSongTime(point.songTimeMs),
          colour: pitchLineColour(
            placeKaraokeTraceSample(
              point.midi,
              targetMidi,
              centerMidi,
              octavePolicy,
            ).cents,
          ),
        })),
      });
    }
    points = [];
  };
  trace.forEach((point) => {
    if (
      !point.voiced ||
      point.songTimeMs < startMs - halfBucketMs ||
      point.songTimeMs > untilMs
    ) {
      return;
    }
    const previous = points[points.length - 1];
    if (
      previous &&
      point.songTimeMs - previous.songTimeMs > VISUAL_PITCH_SILENCE_HOLD_MS
    ) {
      close();
    }
    points.push(point);
  });
  close();
  return runs;
};

/**
 * The box's own colour with the part the playhead has crossed in the passed
 * well: the voice's runs are painted over that, so what was not sung stays
 * visibly unsung.
 */
export const passedNoteFill = (
  context: CanvasRenderingContext2D,
  {
    left,
    right,
    passedX,
    unsung,
    golden,
  }: {
    left: number;
    right: number;
    passedX: number;
    unsung: string;
    golden: boolean;
  },
): string | CanvasGradient => {
  const well = golden ? GOLDEN_PASSED_WELL : PASSED_WELL;
  if (passedX <= left) {
    return unsung;
  }
  if (passedX >= right) {
    return well;
  }
  const split = (passedX - left) / (right - left);
  const gradient = context.createLinearGradient(left, 0, right, 0);
  gradient.addColorStop(0, well);
  gradient.addColorStop(split, well);
  gradient.addColorStop(split, unsung);
  gradient.addColorStop(1, unsung);
  return gradient;
};

/** One run's colours along it, blended between samples as the line is. */
const runGradient = (context: CanvasRenderingContext2D, run: ISungRun) => {
  if (run.stops.length === 1 || run.right - run.left < 1) {
    return run.stops[0].colour;
  }
  const gradient = context.createLinearGradient(run.left, 0, run.right, 0);
  const span = run.right - run.left;
  run.stops.forEach(({ x, colour }) => {
    gradient.addColorStop(
      Math.min(1, Math.max(0, (x - run.left) / span)),
      colour,
    );
  });
  return gradient;
};

interface IPaintSungFillInput {
  left: number;
  right: number;
  top: number;
  height: number;
  runs: readonly ISungRun[];
  /** A golden note the playhead has reached keeps its gold edge. */
  goldEdge: boolean;
}

/**
 * The voice inside the box: a soft glow of its colours round it, then the
 * colours themselves clipped to the box, lit from above. A golden note
 * keeps a gold edge, so it still reads as golden however it was sung.
 */
export const paintSungFill = (
  context: CanvasRenderingContext2D,
  { left, right, top, height, runs, goldEdge }: IPaintSungFillInput,
) => {
  if (runs.length === 0 && !goldEdge) {
    return;
  }
  context.save();
  runs.forEach((run) => {
    context.fillStyle = runGradient(context, run);
    GLOW_HALOS.forEach(({ spreadPx, alpha }) => {
      context.globalAlpha = alpha;
      drawRoundedRect(
        context,
        run.left - spreadPx,
        top - spreadPx,
        run.right - run.left + spreadPx * 2,
        height + spreadPx * 2,
        NOTE_CORNER + spreadPx,
      );
      context.fill();
    });
  });
  context.globalAlpha = 1;
  drawRoundedRect(context, left, top, right - left, height, NOTE_CORNER);
  context.clip();
  if (runs.length) {
    const sheen = context.createLinearGradient(0, top, 0, top + height);
    sheen.addColorStop(0, 'rgba(255, 255, 255, 0.34)');
    sheen.addColorStop(0.45, 'rgba(255, 255, 255, 0)');
    sheen.addColorStop(1, 'rgba(0, 0, 0, 0.14)');
    runs.forEach((run) => {
      const width = run.right - run.left;
      context.globalAlpha = FILL_STRENGTH;
      context.fillStyle = runGradient(context, run);
      context.fillRect(run.left, top, width, height);
      context.globalAlpha = 1;
      context.fillStyle = sheen;
      context.fillRect(run.left, top, width, height);
    });
  }
  if (goldEdge) {
    // Clipped to the box, so half of it shows: a 1px edge inside.
    context.lineWidth = 2;
    context.strokeStyle = GOLDEN_EDGE;
    drawRoundedRect(context, left, top, right - left, height, NOTE_CORNER);
    context.stroke();
  }
  context.restore();
};
