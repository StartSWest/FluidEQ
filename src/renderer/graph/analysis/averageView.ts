/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  STILL_ENOUGH,
  advanceHold,
  easeFactor,
  placeLevel,
  rampRgba,
  scratch,
  type IAnalysisFrame,
  type IAnalysisState,
} from './analysisFrame';
import { paintSpectrum, spectrumInk, spectrumLine } from './spectrumPaint';
import { asMate, paintChannelLegend, paintLegend } from './channelInk';

/**
 * Peak & average: how far the music is moving, band by band.
 *
 * Three readings of the same spectrum at three speeds, and the SPACE between
 * two of them is the point. The slow line is where this song has been sitting
 * for the last second and a half; the fast body is where it is at this
 * instant; the ribbon between them is that band's dynamic range, right now.
 *
 * A wide ribbon across the whole plot is a record that breathes. A ribbon
 * that collapses to the line is one that has been squashed flat, and it
 * collapses in the bands that were squashed — which is a thing you cannot see
 * on any single-trace analyser, and the reason this view exists beside the
 * Analyzer rather than instead of it.
 *
 * Over both, the high-water mark: the loudest each band has been since the
 * view opened, falling only slowly, so an hour of listening leaves an
 * envelope of everything the programme has ever reached.
 *
 * With Left & right chosen it is two ribbons over one another, the right
 * behind and dimmer — so the channel whose dynamics have been squeezed is
 * the one whose ribbon has closed up.
 */

/**
 * The slow reading's half-life.
 *
 * 420 ms halves the distance, so it is within a decibel of a steady level in
 * about two seconds — slow enough to sit still through a bar of music, quick
 * enough to follow a change of section rather than averaging the whole song
 * into a flat line.
 */
const SLOW_HALF_LIFE_MS = 420;

/** The high-water mark hangs this long, then falls this fast. */
const CREST_HANG_MS = 2600;
const CREST_FALL = 0.022;

interface IReadings {
  /** The instant. */
  fast: Float64Array;
  /** Where it has been sitting. */
  slow: Float64Array;
  /** The loudest it has been, and how long that mark still hangs. */
  crest: Float64Array;
  crestMs: Float64Array;
}

/** Advance one channel's three readings; answers how open its ribbon is. */
const advance = (
  readings: IReadings,
  deltaMs: number,
): { widest: number; crest: number } => {
  const toward = easeFactor(deltaMs, SLOW_HALF_LIFE_MS);
  let widest = 0;
  for (let index = 0; index < readings.fast.length; index += 1) {
    readings.slow[index] +=
      (readings.fast[index] - readings.slow[index]) * toward;
    const gap = Math.abs(readings.fast[index] - readings.slow[index]);
    if (gap > widest) {
      widest = gap;
    }
  }
  return {
    widest,
    crest: advanceHold(
      readings.crest,
      readings.crestMs,
      readings.fast,
      deltaMs,
      CREST_HANG_MS,
      CREST_FALL,
    ),
  };
};

/** One channel's picture: the body, the ribbon, the two lines and the mark. */
const paintChannel = (
  frame: IAnalysisFrame,
  readings: IReadings,
  strength: number,
): void => {
  const { context, tuning, xs, band, colours } = frame;
  const { fast, slow } = readings;
  const size = fast.length;

  /**
   * The ribbon: out along the fast reading, back along the slow one. One
   * closed figure, so a band where the two have crossed — the moment after a
   * transient, where the instant is now QUIETER than the average — pinches
   * and swaps sides by itself rather than needing a second path.
   */
  const ribbon = new Path2D();
  for (let index = 0; index < size; index += 1) {
    const y = placeLevel(band, fast[index]);
    if (index === 0) {
      ribbon.moveTo(xs[index], y);
    } else {
      ribbon.lineTo(xs[index], y);
    }
  }
  for (let index = size - 1; index >= 0; index -= 1) {
    ribbon.lineTo(xs[index], placeLevel(band, slow[index]));
  }
  ribbon.closePath();

  // The body under the slow reading, quiet, so the ribbon reads as space
  // above a floor rather than as a shape floating in the middle of the plot.
  context.globalAlpha = band.opacity * strength;
  paintSpectrum(frame, slow, {
    fillAlpha: tuning.fillOpacity * 0.4,
    edgeAlpha: 0,
    textured: false,
  });

  const foot = band.flipped ? band.top : band.bottom;
  const head = band.flipped ? band.bottom : band.top;
  const ribbonPaint = context.createLinearGradient(0, foot, 0, head);
  ribbonPaint.addColorStop(0, rampRgba(colours, 0.25, 0.28));
  ribbonPaint.addColorStop(1, rampRgba(colours, 1, 0.66));
  context.globalAlpha = band.opacity * strength;
  context.fillStyle = ribbonPaint;
  context.fill(ribbon);
  if (tuning.filled) {
    // The pattern goes in the ribbon, not in the body: the ribbon is the
    // reading here, and a texture belongs on what is being read.
    context.save();
    context.clip(ribbon);
    paintSpectrum(frame, fast, {
      fillAlpha: tuning.fillOpacity * 0.5,
      edgeAlpha: 0,
    });
    context.restore();
  }

  // The slow reading's own line, heavier than the fast one: it is the
  // reference the ribbon is measured from, so it has to look like a rule.
  context.globalAlpha = band.opacity * strength;
  context.lineWidth = frame.edge.width + 0.6;
  context.lineJoin = 'round';
  context.strokeStyle = spectrumInk(frame, slow);
  context.stroke(spectrumLine(frame, slow));

  // The instant, as a hairline along the top of the ribbon.
  context.globalAlpha = band.opacity * strength * 0.8;
  context.lineWidth = 1;
  context.strokeStyle = rampRgba(colours, 1, 1);
  context.stroke(spectrumLine(frame, fast));

  // The high-water mark, dashed so it never reads as a third live trace.
  context.globalAlpha = band.opacity * strength * 0.42;
  context.setLineDash([3, 3]);
  context.lineWidth = 1;
  context.strokeStyle = '#fff';
  context.stroke(spectrumLine(frame, readings.crest));
  context.setLineDash([]);
  context.globalAlpha = 1;
};

const drawAverageView = (
  frame: IAnalysisFrame,
  state: IAnalysisState,
): boolean => {
  const { levels, split, deltaMs } = frame;
  const size = levels.length;
  if (state.slow.length !== size) {
    return false;
  }

  if (split) {
    // Six working arrays: a slow reading, a high-water mark and its hang
    // timer, for each channel.
    const [leftSlow, leftCrest, leftMs, rightSlow, rightCrest, rightMs] =
      scratch(state, size, 6);
    const left: IReadings = {
      fast: split[0],
      slow: leftSlow,
      crest: leftCrest,
      crestMs: leftMs,
    };
    const right: IReadings = {
      fast: split[1],
      slow: rightSlow,
      crest: rightCrest,
      crestMs: rightMs,
    };
    const behind = advance(right, deltaMs);
    const front = advance(left, deltaMs);
    paintChannel(asMate(frame), right, 0.7);
    paintChannel(frame, left, 1);
    paintChannelLegend(frame, frame.channelLabels);
    return (
      Math.max(front.widest, behind.widest) > STILL_ENOUGH ||
      Math.max(front.crest, behind.crest) > STILL_ENOUGH
    );
  }

  const joined: IReadings = {
    fast: levels,
    slow: state.slow,
    crest: state.crest,
    crestMs: state.holdMs,
  };
  const { widest, crest } = advance(joined, deltaMs);
  paintChannel(frame, joined, 1);
  paintLegend(frame, [
    { label: frame.legend.peak, ink: rampRgba(frame.colours, 1, 1) },
    { label: frame.legend.average, ink: rampRgba(frame.colours, 0.5, 1) },
    { label: frame.legend.max, ink: 'rgba(255, 255, 255, 0.95)' },
  ]);
  return widest > STILL_ENOUGH || crest > STILL_ENOUGH;
};

export default drawAverageView;
