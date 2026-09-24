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
  type IAnalysisState,
} from './analysisFrame';
import { paintChannelLegend } from './channelInk';
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
 */

/** How much of the block is drawn, so the trigger has room to move. */
const SHOWN = 0.62;

/** Never search further back than this for a crossing, as a share of a block. */
const SEARCH = 0.34;

/** A sample smaller than this is silence and cannot trigger anything. */
const QUIET = 0.0008;

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

/** One channel's trace, from its trigger, across the band. */
const traceOf = (
  frame: IAnalysisFrame,
  band: IAnalysisBand,
  samples: Float32Array,
): Path2D => {
  const { plot } = frame;
  const start = triggerAt(samples);
  const count = Math.min(
    samples.length - start,
    Math.floor(samples.length * SHOWN),
  );
  const { left } = plot;
  const width = plot.right - plot.left;
  const middle = (band.top + band.bottom) / 2;
  const reach = (band.bottom - band.top) / 2;
  const path = new Path2D();
  // At most one point per pixel: past that the extra samples land on columns
  // already drawn and the path grows without the picture changing.
  const step = Math.max(1, Math.floor(count / Math.max(1, width)));
  for (let index = 0; index < count; index += step) {
    const x = left + (index / Math.max(1, count - 1)) * width;
    const y =
      middle - Math.max(-1, Math.min(1, samples[start + index])) * reach;
    if (index === 0) {
      path.moveTo(x, y);
    } else {
      path.lineTo(x, y);
    }
  }
  return path;
};

/** The beam: a wide soft pass, a body, and a hot core along the middle. */
const paintBeam = (
  frame: IAnalysisFrame,
  trace: Path2D,
  colours: readonly string[],
  strength: number,
): void => {
  const { context, band } = frame;
  context.lineJoin = 'round';
  context.lineCap = 'round';
  context.strokeStyle = beamPaint(frame, colours, 1);
  context.globalAlpha = band.opacity * strength * 0.16;
  context.lineWidth = Math.max(5, frame.edge.width + 4);
  context.stroke(trace);
  context.globalAlpha = band.opacity * strength * 0.55;
  context.lineWidth = Math.max(2, frame.edge.width);
  context.stroke(trace);
  context.globalAlpha = band.opacity * strength;
  context.lineWidth = 1;
  context.strokeStyle = beamPaint(frame, colours, 1);
  context.stroke(trace);
  context.globalAlpha = 1;
};

const drawScopeView = (
  frame: IAnalysisFrame,
  state: IAnalysisState,
): boolean => {
  const { context, band, scope, colours, mate, tuning, plot, levels } = frame;
  const middle = (band.top + band.bottom) / 2;

  // The rule the trace is read against: silence down the middle, and the
  // two rows a sample of full scale would reach.
  context.globalAlpha = band.opacity;
  const rules = new Path2D();
  rules.moveTo(plot.left, middle);
  rules.lineTo(plot.right, middle);
  context.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  context.lineWidth = 1;
  context.stroke(rules);
  const edges = new Path2D();
  [band.top, band.bottom].forEach((row) => {
    edges.moveTo(plot.left, row);
    edges.lineTo(plot.right, row);
  });
  context.setLineDash([3, 5]);
  context.strokeStyle = 'rgba(255, 96, 112, 0.28)';
  context.stroke(edges);
  context.setLineDash([]);
  context.globalAlpha = 1;

  if (!scope) {
    /**
     * No samples measured yet. Rather than an empty box, the loudest reading
     * of the shared spectrum is drawn as the pair of rows a wave of that
     * size would reach — a true statement about the level, and one that
     * disappears the moment the real trace arrives.
     */
    let loudest = 0;
    for (let index = 0; index < levels.length; index += 1) {
      if (levels[index] > loudest) {
        loudest = levels[index];
      }
    }
    const reach = ((band.bottom - band.top) / 2) * clamp01(loudest);
    const hint = new Path2D();
    hint.moveTo(plot.left, middle - reach);
    hint.lineTo(plot.right, middle - reach);
    hint.moveTo(plot.left, middle + reach);
    hint.lineTo(plot.right, middle + reach);
    context.globalAlpha = band.opacity * 0.5;
    context.lineWidth = 1.5;
    context.strokeStyle = rampRgba(colours, 0.7, 1);
    context.stroke(hint);
    context.globalAlpha = 1;
    return loudest > 0.002;
  }

  if (tuning.channels === 'split') {
    paintBeam(frame, traceOf(frame, band, scope[1]), mate, 0.85);
    paintBeam(frame, traceOf(frame, band, scope[0]), colours, 1);
    paintChannelLegend(frame, frame.channelLabels);
  } else {
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
    paintBeam(
      frame,
      traceOf(frame, band, summed.subarray(0, count)),
      colours,
      1,
    );
  }
  // The samples move whenever there is sound, so the loop runs while the
  // capture does; it settles with the capture, like every other view.
  return frame.playing;
};

export default drawScopeView;
