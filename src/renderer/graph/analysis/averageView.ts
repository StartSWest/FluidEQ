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
  type IAnalysisReading,
  type IAnalysisState,
} from './analysisFrame';
import { paintSpectrum, spectrumInk, spectrumLine } from './spectrumPaint';
import { asMate } from './channelInk';

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
 *
 * Laid out here for both painters: this file's canvas drawing, and the
 * engine's (`engineLooks/averageLook.ts`).
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

/** The body under the slow reading: its share of the look's fill. */
export const AVERAGE_BODY = 0.4;

/**
 * The ribbon, up from its foot: where on the look's ramp each stop takes its
 * colour, and how solid it is there.
 */
export const AVERAGE_RIBBON: readonly (readonly [
  at: number,
  ramp: number,
  alpha: number,
])[] = [
  [0, 0.25, 0.28],
  [1, 1, 0.66],
];

/** The fast body printed inside the ribbon: its share of the look's fill. */
export const AVERAGE_RIBBON_BODY = 0.5;

/** How much heavier than the look's edge the slow line is drawn. */
export const AVERAGE_SLOW_HEAVIER = 0.6;

/** The instant's hairline: its width, and how solid within its figure. */
export const AVERAGE_FAST_WIDTH = 1;
export const AVERAGE_FAST_ALPHA = 0.8;

/** The high-water mark: dashed this long on and off, this solid, this wide. */
export const AVERAGE_CREST_DASH = 3;
export const AVERAGE_CREST_ALPHA = 0.42;
export const AVERAGE_CREST_WIDTH = 1;

/** How present the right channel is, drawn behind the left. */
export const AVERAGE_BEHIND = 0.7;

export interface IAverageReadings {
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
  readings: IAverageReadings,
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

export interface IAverageFrame {
  /** The joined readings, or the left channel's. */
  front: IAverageReadings;
  /** The right channel's, on a split. */
  behind?: IAverageReadings;
  /** Whether anything is still moving, for the frame loop. */
  moving: boolean;
}

/** This frame's readings, advanced by the reading's time. */
export const advanceAverage = (
  reading: IAnalysisReading,
  state: IAnalysisState,
): IAverageFrame | undefined => {
  const { levels, split, deltaMs } = reading;
  const size = levels.length;
  if (state.slow.length !== size) {
    return undefined;
  }

  if (split) {
    // Six working arrays: a slow reading, a high-water mark and its hang
    // timer, for each channel.
    const [leftSlow, leftCrest, leftMs, rightSlow, rightCrest, rightMs] =
      scratch(state, size, 6);
    const left: IAverageReadings = {
      fast: split[0],
      slow: leftSlow,
      crest: leftCrest,
      crestMs: leftMs,
    };
    const right: IAverageReadings = {
      fast: split[1],
      slow: rightSlow,
      crest: rightCrest,
      crestMs: rightMs,
    };
    const behind = advance(right, deltaMs);
    const front = advance(left, deltaMs);
    return {
      front: left,
      behind: right,
      moving:
        Math.max(front.widest, behind.widest) > STILL_ENOUGH ||
        Math.max(front.crest, behind.crest) > STILL_ENOUGH,
    };
  }

  const joined: IAverageReadings = {
    fast: levels,
    slow: state.slow,
    crest: state.crest,
    crestMs: state.holdMs,
  };
  const { widest, crest } = advance(joined, deltaMs);
  return {
    front: joined,
    moving: widest > STILL_ENOUGH || crest > STILL_ENOUGH,
  };
};

/** One channel's picture: the body, the ribbon, the two lines and the mark. */
const paintChannel = (
  frame: IAnalysisFrame,
  readings: IAverageReadings,
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
    fillAlpha: tuning.fillOpacity * AVERAGE_BODY,
    edgeAlpha: 0,
    textured: false,
  });

  const foot = band.flipped ? band.top : band.bottom;
  const head = band.flipped ? band.bottom : band.top;
  const ribbonPaint = context.createLinearGradient(0, foot, 0, head);
  AVERAGE_RIBBON.forEach(([at, ramp, alpha]) =>
    ribbonPaint.addColorStop(at, rampRgba(colours, ramp, alpha)),
  );
  context.globalAlpha = band.opacity * strength;
  context.fillStyle = ribbonPaint;
  context.fill(ribbon);
  if (tuning.filled) {
    // The pattern goes in the ribbon, not in the body: the ribbon is the
    // reading here, and a texture belongs on what is being read.
    context.save();
    context.clip(ribbon);
    paintSpectrum(frame, fast, {
      fillAlpha: tuning.fillOpacity * AVERAGE_RIBBON_BODY,
      edgeAlpha: 0,
    });
    context.restore();
  }

  // The slow reading's own line, heavier than the fast one: it is the
  // reference the ribbon is measured from, so it has to look like a rule.
  context.globalAlpha = band.opacity * strength;
  context.lineWidth = frame.edge.width + AVERAGE_SLOW_HEAVIER;
  context.lineJoin = 'round';
  context.strokeStyle = spectrumInk(frame, slow);
  context.stroke(spectrumLine(frame, slow));

  // The instant, as a hairline along the top of the ribbon.
  context.globalAlpha = band.opacity * strength * AVERAGE_FAST_ALPHA;
  context.lineWidth = AVERAGE_FAST_WIDTH;
  context.strokeStyle = rampRgba(colours, 1, 1);
  context.stroke(spectrumLine(frame, fast));

  // The high-water mark, dashed so it never reads as a third live trace.
  context.globalAlpha = band.opacity * strength * AVERAGE_CREST_ALPHA;
  context.setLineDash([AVERAGE_CREST_DASH, AVERAGE_CREST_DASH]);
  context.lineWidth = AVERAGE_CREST_WIDTH;
  context.strokeStyle = '#fff';
  context.stroke(spectrumLine(frame, readings.crest));
  context.setLineDash([]);
  context.globalAlpha = 1;
};

const drawAverageView = (
  frame: IAnalysisFrame,
  state: IAnalysisState,
): boolean => {
  const advanced = advanceAverage(frame, state);
  if (!advanced) {
    return false;
  }
  if (advanced.behind) {
    paintChannel(asMate(frame), advanced.behind, AVERAGE_BEHIND);
  }
  paintChannel(frame, advanced.front, 1);
  return advanced.moving;
};

export default drawAverageView;
