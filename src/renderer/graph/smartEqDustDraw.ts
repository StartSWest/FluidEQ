/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { gainAtFrequency, getTFCoefficients } from 'common/response';
import { SMART_EQ_MAX_FREQUENCY, SMART_EQ_MIN_FREQUENCY } from 'common/smartEq';
import { SMART_EQ_LAYOUT } from '../utils/smartEqSolve';
import type { ISmartEqPreviewRegion } from '../utils/smartEqPreview';

/**
 * Settling dust (Ivan, 2026-11-20, Direction D of the Smart EQ curve
 * mockup): the correction forming on the EQ graph as a spray of points, three
 * per slice of the spectrum, scattered by how unsure each range still is. As
 * a range's confidence rises its points gather onto the line and the line
 * draws itself through them; when the song is held the points fade, a light
 * runs once along the finished curve, and the layer's own line is left.
 *
 * Pure drawing: the component owns the frame loop and the easing.
 */

/** One point of the spray, fixed for the life of the field. */
interface IDot {
  slice: number;
  /** Two Gaussian draws: where in its spread the point wanders. */
  g0: number;
  g1: number;
  /** How fast it wanders, in radians a second. */
  speed: number;
  /** Where across its slice it sits, -0.5..0.5 of a slice. */
  across: number;
  radius: number;
}

export interface IDustField {
  frequencies: Float64Array;
  xs: Float64Array;
  /** How much spread a slice may carry: none outside the measured span. */
  taper: Float64Array;
  step: number;
  dots: IDot[];
}

export interface IDustFrame {
  /** The curve drawn now, in dB, eased toward the measurement. */
  curve: Float64Array;
  /** Each slice's confidence drawn now, eased the same way. */
  confidence: Float64Array;
  seconds: number;
  /** 0..1: the whole drawing's arrival. */
  presence: number;
  /** 0..1: the points, fading once held. */
  dots: number;
  /** 0..1: the line from confidence-lit to whole, as it holds. */
  solid: number;
  /** 0..1: the line itself, handing over to the layer's own line. */
  line: number;
  /** The light along the held curve, 0..1, or below 0 for none. */
  pass: number;
}

export interface IDustPaint {
  ink: readonly [number, number, number];
  light: readonly [number, number, number];
  blend: GlobalCompositeOperation;
}

const DOTS_PER_SLICE = 3;
/** One slice per this many pixels of plot, within the bounds below. */
const PIXELS_PER_SLICE = 5;
const MIN_SLICES = 72;
const MAX_SLICES = 240;
/** The spray reaches a little past the correctable span and fades there. */
const SPRAY_LOW_HZ = 22;
const SPRAY_HIGH_HZ = 19000;

export const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
export const smoothstep = (from: number, to: number, value: number) => {
  const t = clamp01((value - from) / (to - from));
  return t * t * (3 - 2 * t);
};

/** Seeded, so the dust is the same pattern on every draw and every song. */
const seededRandom = (start: number) => {
  let seed = start;
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
};

export const createDustField = (
  frequencyAt: (x: number) => number,
  left: number,
  right: number,
): IDustField => {
  const width = Math.max(1, right - left);
  const count = Math.round(
    Math.max(MIN_SLICES, Math.min(MAX_SLICES, width / PIXELS_PER_SLICE)),
  );
  const frequencies = new Float64Array(count);
  const xs = new Float64Array(count);
  const taper = new Float64Array(count);
  const step = width / (count - 1);
  for (let index = 0; index < count; index += 1) {
    const x = left + index * step;
    const frequency = frequencyAt(x);
    xs[index] = x;
    frequencies[index] = frequency;
    // Full spread where the layer can move anything, a third of it at the
    // span's edges, none past the spray's reach.
    const inside =
      smoothstep(SPRAY_LOW_HZ, SMART_EQ_MIN_FREQUENCY, frequency) *
      (1 - smoothstep(SMART_EQ_MAX_FREQUENCY, SPRAY_HIGH_HZ, frequency));
    taper[index] = inside;
  }
  const random = seededRandom(7);
  const gauss = () =>
    Math.sqrt(-2 * Math.log(Math.max(1e-6, random()))) *
    Math.cos(2 * Math.PI * random());
  const dots: IDot[] = [];
  for (let slice = 0; slice < count; slice += 1) {
    if (taper[slice] > 0) {
      for (let copy = 0; copy < DOTS_PER_SLICE; copy += 1) {
        dots.push({
          slice,
          g0: gauss(),
          g1: gauss(),
          speed: 0.6 + random() * 1.4,
          across: random() - 0.5,
          radius: 0.85 + random() * 0.6,
        });
      }
    }
  }
  return { frequencies, xs, taper, step, dots };
};

/** The layer's response to `gains` at every slice, in dB. */
export const responseAt = (
  gains: Readonly<Record<string, number>> | undefined,
  frequencies: Float64Array,
  into: Float64Array,
): Float64Array => {
  into.fill(0);
  if (!gains) {
    return into;
  }
  SMART_EQ_LAYOUT.forEach((band) => {
    const gain = gains[band.id];
    if (!Number.isFinite(gain) || gain === 0) {
      return;
    }
    const coefficients = getTFCoefficients({ ...band, gain });
    for (let index = 0; index < frequencies.length; index += 1) {
      // eslint-disable-next-line no-param-reassign -- the scratch buffer is the point
      into[index] += gainAtFrequency(frequencies[index], coefficients);
    }
  });
  return into;
};

/** Each slice's confidence, between the range centres on a log axis. */
export const confidenceAt = (
  regions: readonly ISmartEqPreviewRegion[],
  frequencies: Float64Array,
  into: Float64Array,
): Float64Array => {
  if (regions.length === 0) {
    return into.fill(0);
  }
  const centres = regions.map((region) => Math.log(region.centreFrequency));
  for (let index = 0; index < frequencies.length; index += 1) {
    const at = Math.log(frequencies[index]);
    let value = regions[regions.length - 1].confidence;
    if (at <= centres[0]) {
      value = regions[0].confidence;
    } else {
      for (let region = 0; region < regions.length - 1; region += 1) {
        if (at <= centres[region + 1]) {
          const t =
            (at - centres[region]) / (centres[region + 1] - centres[region]);
          value =
            regions[region].confidence +
            (regions[region + 1].confidence - regions[region].confidence) * t;
          break;
        }
      }
    }
    // eslint-disable-next-line no-param-reassign -- the scratch buffer is the point
    into[index] = clamp01(value);
  }
  return into;
};

/**
 * How far a slice's points may stray from the line, in dB: wide while a
 * range is barely heard, a quarter of a decibel once it is certain.
 */
const spreadDb = (confidence: number) => 0.3 + 4.6 * (1 - confidence);

const rgba = (rgb: readonly number[], alpha: number) =>
  `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${clamp01(alpha).toFixed(3)})`;

/** A horizontal gradient whose alpha follows each slice's confidence. */
const confidenceStroke = (
  context: CanvasRenderingContext2D,
  field: IDustField,
  frame: IDustFrame,
  paint: IDustPaint,
  alphaOf: (confidence: number) => number,
) => {
  const { xs } = field;
  const gradient = context.createLinearGradient(xs[0], 0, xs[xs.length - 1], 0);
  const stops = 32;
  for (let stop = 0; stop <= stops; stop += 1) {
    const slice = Math.round((stop / stops) * (xs.length - 1));
    gradient.addColorStop(
      stop / stops,
      rgba(paint.ink, alphaOf(frame.confidence[slice])),
    );
  }
  return gradient;
};

const traceCurve = (
  context: CanvasRenderingContext2D,
  field: IDustField,
  ys: Float64Array,
) => {
  context.beginPath();
  context.moveTo(field.xs[0], ys[0]);
  for (let index = 1; index < ys.length; index += 1) {
    context.lineTo(field.xs[index], ys[index]);
  }
};

export const drawDust = (
  context: CanvasRenderingContext2D,
  field: IDustField,
  frame: IDustFrame,
  paint: IDustPaint,
  yOf: (db: number) => number,
  ys: Float64Array,
) => {
  for (let index = 0; index < ys.length; index += 1) {
    // eslint-disable-next-line no-param-reassign -- the scratch buffer is the point
    ys[index] = yOf(frame.curve[index]);
  }

  // The points, as light on the dark window and as ink on the white one.
  const dotAlpha = frame.dots * frame.presence;
  if (dotAlpha > 0.003) {
    context.globalCompositeOperation = paint.blend;
    field.dots.forEach((dot) => {
      const confidence = frame.confidence[dot.slice];
      const wander =
        dot.g0 * Math.cos(dot.speed * frame.seconds) +
        dot.g1 * Math.sin(dot.speed * frame.seconds);
      const spread =
        spreadDb(confidence) * (0.35 + 0.65 * field.taper[dot.slice]);
      const y = yOf(frame.curve[dot.slice] + wander * spread * 0.95);
      context.fillStyle = rgba(
        paint.ink,
        (0.3 + 0.6 * confidence) * dotAlpha * field.taper[dot.slice],
      );
      context.beginPath();
      context.arc(
        field.xs[dot.slice] + dot.across * field.step,
        y,
        dot.radius * (1.25 + 0.55 * confidence),
        0,
        Math.PI * 2,
      );
      context.fill();
    });
    context.globalCompositeOperation = 'source-over';
  }

  // The line, drawing itself in where a range is sure, whole once held.
  const lineAlpha = frame.line * frame.presence;
  if (lineAlpha > 0.003) {
    context.lineJoin = 'round';
    context.lineCap = 'round';
    context.globalAlpha = lineAlpha;
    context.lineWidth = 1.8 + 0.6 * frame.solid;
    context.strokeStyle = confidenceStroke(
      context,
      field,
      frame,
      paint,
      (confidence) =>
        frame.solid +
        (1 - frame.solid) * smoothstep(0.45, 1, confidence) * 0.95,
    );
    traceCurve(context, field, ys);
    context.stroke();

    // The one moment: as it holds, a light runs along the finished curve.
    if (frame.pass > 0 && frame.pass < 1) {
      const left = field.xs[0];
      const width = field.xs[field.xs.length - 1] - left;
      const head = left + frame.pass * width * 1.15 - width * 0.075;
      const light = context.createLinearGradient(head - 90, 0, head + 30, 0);
      light.addColorStop(0, rgba(paint.light, 0));
      light.addColorStop(0.8, rgba(paint.light, 0.95));
      light.addColorStop(1, rgba(paint.light, 0));
      context.strokeStyle = light;
      context.lineWidth = 3.4;
      traceCurve(context, field, ys);
      context.stroke();
    }
    context.globalAlpha = 1;
  }
};
