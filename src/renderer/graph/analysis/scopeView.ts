/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  clamp01,
  rampRgba,
  type IAnalysisBand,
  type IAnalysisFrame,
  type IAnalysisPlot,
  type IAnalysisReading,
  type IAnalysisState,
} from './analysisFrame';
import { asMate } from './channelInk';
import { beamPaint } from './spectrumPaint';

/**
 * The Oscilloscope: the samples themselves, against time.
 *
 * The only view on this graph that is not a spectrum. It answers the things
 * a spectrum cannot: whether the master is clipped flat at the top, whether
 * a bass note is a clean sine or a square, how hard the limiter is working,
 * and what the actual waveform of the thing you are listening to looks like.
 *
 * TRIGGERED, which is the whole difficulty and the whole value. Drawn from
 * wherever the block happens to start, a steady tone slides across the
 * screen at a speed that means nothing; started at a rising zero crossing
 * instead, the same tone stands still and you can read it. The search walks
 * backward from the middle of the block so there is always a whole screen of
 * samples after the trigger, and falls back to the middle when a block has
 * no crossing in it at all — silence, or a run that never crosses.
 *
 * With Left & right chosen the two channels are drawn one over the other in
 * their own colours, which is how a phase problem looks before it becomes a
 * number on the stereo panel: two traces that do not sit on each other.
 *
 * Laid out here for both painters: this file's canvas drawing, and the
 * engine's (`engineLooks/scopeLook.ts`).
 */

/** How much of the block is drawn, so the trigger has room to move. */
const SHOWN = 0.62;

/** Never search further back than this for a crossing, as a share of a block. */
const SEARCH = 0.34;

/** A sample smaller than this is silence and cannot trigger anything. */
const QUIET = 0.0008;

/** The rule silence sits on, and the two rows full scale reaches. */
export const SCOPE_RULE_INK = 'rgba(255, 255, 255, 0.22)';
export const SCOPE_EDGE_INK = 'rgba(255, 96, 112, 0.28)';
export const SCOPE_EDGE_DASH: readonly [on: number, off: number] = [3, 5];

/** The level hint drawn before any samples arrive: how solid, how wide. */
export const SCOPE_HINT_ALPHA = 0.5;
export const SCOPE_HINT_WIDTH = 1.5;
export const SCOPE_HINT_RAMP = 0.7;

/**
 * The beam's three passes, widest first: a soft glow, a body and a hot core,
 * each's alpha within its trace and its width from the look's edge.
 */
export const SCOPE_BEAM: readonly {
  alpha: number;
  width: (edge: number) => number;
}[] = [
  { alpha: 0.16, width: (edge) => Math.max(5, edge + 4) },
  { alpha: 0.55, width: (edge) => Math.max(2, edge) },
  { alpha: 1, width: () => 1 },
];

/** How present the right channel is, drawn behind the left. */
export const SCOPE_BEHIND = 0.85;

/**
 * Where the trace starts: the last rising zero crossing before the middle.
 *
 * Backward from the middle rather than forward from the start, because a
 * forward search locks onto the first crossing in the block, and the first
 * crossing of a block that begins mid-cycle is half a period away from where
 * the eye expects the trace to begin — so the picture jumps by half a cycle
 * whenever the block boundary lands somewhere else.
 */
const triggerAt = (samples: Float32Array): number => {
  const middle = Math.floor(samples.length / 2);
  const earliest = Math.max(1, middle - Math.floor(samples.length * SEARCH));
  for (let index = middle; index > earliest; index -= 1) {
    if (samples[index] >= 0 && samples[index - 1] < 0) {
      // A crossing in silence is noise crossing itself, and locking onto one
      // makes a quiet passage flicker rather than lie still.
      if (
        Math.abs(samples[index]) > QUIET ||
        Math.abs(samples[index - 1]) > QUIET
      ) {
        return index;
      }
    }
  }
  return middle;
};

/** One channel's trace: which samples, from its trigger, across the band. */
export interface IScopeTrace {
  samples: Float32Array;
  start: number;
  count: number;
  /**
   * How many samples one drawn point stands for. At most one point per
   * pixel: past that the extra samples land on columns already drawn and the
   * path grows without the picture changing.
   */
  step: number;
  /** Painted in the other channel's colours, behind. */
  mate: boolean;
  strength: number;
}

const traceOf = (
  plot: IAnalysisPlot,
  samples: Float32Array,
  mate: boolean,
  strength: number,
): IScopeTrace => {
  const start = triggerAt(samples);
  const count = Math.min(
    samples.length - start,
    Math.floor(samples.length * SHOWN),
  );
  return {
    samples,
    start,
    count,
    step: Math.max(1, Math.floor(count / Math.max(1, plot.right - plot.left))),
    mate,
    strength,
  };
};

/** Where drawn sample `index` of `trace` stands. */
export const scopePoint = (
  plot: IAnalysisPlot,
  band: IAnalysisBand,
  trace: IScopeTrace,
  index: number,
): { x: number; y: number } => ({
  x:
    plot.left +
    (index / Math.max(1, trace.count - 1)) * (plot.right - plot.left),
  y:
    (band.top + band.bottom) / 2 -
    Math.max(-1, Math.min(1, trace.samples[trace.start + index])) *
      ((band.bottom - band.top) / 2),
});

/**
 * The traces this frame draws, back to front; none before any samples have
 * been measured.
 */
export const scopeTraces = (
  reading: IAnalysisReading,
  state: IAnalysisState,
): IScopeTrace[] | undefined => {
  const { scope, tuning, plot } = reading;
  if (!scope) {
    return undefined;
  }
  if (tuning.channels === 'split') {
    return [
      traceOf(plot, scope[1], true, SCOPE_BEHIND),
      traceOf(plot, scope[0], false, 1),
    ];
  }
  /**
   * Joined: the two channels summed, which is the signal a mono speaker
   * plays and the one a clipping master clips. Halved, so a centred signal
   * reaches the same height it does on its own rather than twice it.
   */
  const summed = state.sum;
  const count = Math.min(scope[0].length, scope[1].length, summed.length);
  for (let index = 0; index < count; index += 1) {
    summed[index] = (scope[0][index] + scope[1][index]) * 0.5;
  }
  return [traceOf(plot, summed.subarray(0, count), false, 1)];
};

/**
 * No samples measured yet: rather than an empty box, the loudest reading of
 * the shared spectrum, as the pair of rows a wave of that size would reach —
 * a true statement about the level, and one that disappears the moment the
 * real trace arrives. Answers that level, and how far from the middle those
 * rows stand.
 */
export const scopeHint = (
  reading: IAnalysisReading,
): { loudest: number; reach: number } => {
  const { levels, band } = reading;
  let loudest = 0;
  for (let index = 0; index < levels.length; index += 1) {
    if (levels[index] > loudest) {
      loudest = levels[index];
    }
  }
  return { loudest, reach: ((band.bottom - band.top) / 2) * clamp01(loudest) };
};

/** The beam: a wide soft pass, a body, and a hot core along the middle. */
const paintBeam = (frame: IAnalysisFrame, trace: IScopeTrace): void => {
  const painted = trace.mate ? asMate(frame) : frame;
  const { context, band, plot } = painted;
  const path = new Path2D();
  for (let index = 0; index < trace.count; index += trace.step) {
    const { x, y } = scopePoint(plot, band, trace, index);
    if (index === 0) {
      path.moveTo(x, y);
    } else {
      path.lineTo(x, y);
    }
  }
  context.lineJoin = 'round';
  context.lineCap = 'round';
  context.strokeStyle = beamPaint(painted, painted.colours, 1);
  SCOPE_BEAM.forEach(({ alpha, width }) => {
    context.globalAlpha = band.opacity * trace.strength * alpha;
    context.lineWidth = width(painted.edge.width);
    context.stroke(path);
  });
  context.globalAlpha = 1;
};

const drawScopeView = (
  frame: IAnalysisFrame,
  state: IAnalysisState,
): boolean => {
  const { context, band, plot, colours } = frame;
  const middle = (band.top + band.bottom) / 2;

  // The rule the trace is read against: silence down the middle, and the
  // two rows a sample of full scale would reach.
  context.globalAlpha = band.opacity;
  const rules = new Path2D();
  rules.moveTo(plot.left, middle);
  rules.lineTo(plot.right, middle);
  context.strokeStyle = SCOPE_RULE_INK;
  context.lineWidth = 1;
  context.stroke(rules);
  const edges = new Path2D();
  [band.top, band.bottom].forEach((row) => {
    edges.moveTo(plot.left, row);
    edges.lineTo(plot.right, row);
  });
  context.setLineDash([...SCOPE_EDGE_DASH]);
  context.strokeStyle = SCOPE_EDGE_INK;
  context.stroke(edges);
  context.setLineDash([]);
  context.globalAlpha = 1;

  const traces = scopeTraces(frame, state);
  if (!traces) {
    const { loudest, reach } = scopeHint(frame);
    const hint = new Path2D();
    hint.moveTo(plot.left, middle - reach);
    hint.lineTo(plot.right, middle - reach);
    hint.moveTo(plot.left, middle + reach);
    hint.lineTo(plot.right, middle + reach);
    context.globalAlpha = band.opacity * SCOPE_HINT_ALPHA;
    context.lineWidth = SCOPE_HINT_WIDTH;
    context.strokeStyle = rampRgba(colours, SCOPE_HINT_RAMP, 1);
    context.stroke(hint);
    context.globalAlpha = 1;
    return loudest > 0.002;
  }
  traces.forEach((trace) => paintBeam(frame, trace));
  // The samples move whenever there is sound, so the loop runs while the
  // capture does; it settles with the capture, like every other view.
  return frame.playing;
};

export default drawScopeView;
