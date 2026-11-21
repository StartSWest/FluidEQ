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
 * per slice of the spectrum, scattered by how unsure each range still is.
 *
 * The points BECOME the line (Ivan, same day: "when it finds it those dots
 * become more like a solid line"). At the hold the points stop wandering,
 * spread out evenly along the curve and grow until each touches its
 * neighbours — a bead chain lying on the line — in one sweep from the bass
 * up, and only then does the stroke come up under them and the beads go, so
 * what the eye follows is points closing into a line, never points fading
 * while a separate line appears. A light runs once along the finished line,
 * and it hands over to the layer's own line.
 *
 * WHILE MEASURING NOTHING IS SOLID. A range that is found draws its points
 * in close to the curve, never into it. The first version closed each found
 * range into the stroke at once, and the running mode then went on settling
 * for up to a minute (`SONG_LISTEN_BOUNDS`), so a line that looked finished
 * kept moving: "it lands the dots but continues moving" (Ivan, 2026-11-20).
 * Solid means held, and held means still.
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
  /** Where across its slice it lies once closed: evenly, by its copy. */
  closedAcross: number;
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
  /**
   * Per slice, 0..1: how far its points have closed into the line — 0 a
   * wandering spray, 1 the solid stroke. See `closedOf`.
   */
  closed: Float64Array;
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
          closedAcross: (copy + 0.5) / DOTS_PER_SLICE - 0.5,
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

/**
 * How closed a slice's points are, from what the measurement knows of it and
 * from the hold's sweep: a found range draws in to `FOUND_CLOSED` — from
 * about two thirds sure to covered — short of where the beads touch and the
 * stroke begins, and only the hold closes anything, the bass first and the
 * top last, `HOLD_SWEEP_S` from one end to the other.
 * `sinceHeld` is undefined while measuring, and `reduced` closes the hold at
 * once.
 */
export const HOLD_SWEEP_S = 0.55;
export const HOLD_CLOSE_S = 0.4;
/** Under `strokeShare`'s start, so nothing measured is ever drawn solid. */
const FOUND_CLOSED = 0.6;

/**
 * How fast the drawn curve follows the measurement, in seconds to cover most
 * of the way: slowly while it forms, quickly once the song is held.
 *
 * A checkpoint every half second is a step, and a song's estimate still
 * moves while it settles: 1.2 dB between two checkpoints of a real song
 * where two overlapping bands traded gain, 2.5 dB at the top of the spectrum
 * on another where the air range was still uncertain (measured 2026-11-21,
 * 47 steps over half a decibel across eight records after the first six
 * seconds). Followed in 0.22 s, each step was drawn as a jolt: "it keeps
 * moving while it forms". Followed over a second, the same steps are a drift.
 * Once held the curve is the answer and catches up within the hold's sweep,
 * so the line it closes into is already where it stays.
 */
export const CURVE_EASE_FORMING_S = 1.1;
export const CURVE_EASE_HELD_S = 0.15;

/** The share of the way the drawn curve moves toward its target in `dt`. */
export const curveEaseShare = (dt: number, isHeld: boolean): number =>
  1 - Math.exp(-dt / (isHeld ? CURVE_EASE_HELD_S : CURVE_EASE_FORMING_S));

export const closedOf = (
  confidence: Float64Array,
  sinceHeld: number | undefined,
  reduced: boolean,
  into: Float64Array,
): Float64Array => {
  const last = Math.max(1, into.length - 1);
  for (let index = 0; index < into.length; index += 1) {
    const found = FOUND_CLOSED * smoothstep(0.62, 0.92, confidence[index]);
    let held = 0;
    if (sinceHeld !== undefined) {
      held = reduced
        ? 1
        : smoothstep(
            0,
            HOLD_CLOSE_S,
            sinceHeld - HOLD_SWEEP_S * (index / last),
          );
    }
    // eslint-disable-next-line no-param-reassign -- the scratch buffer is the point
    into[index] = Math.max(found, held);
  }
  return into;
};

/** The stroke's share of a slice: it comes up once the beads touch. */
const strokeShare = (closed: number) => smoothstep(0.78, 0.97, closed);

/** The beads' share: they go once the stroke under them is whole. */
const beadShare = (closed: number) => 1 - smoothstep(0.9, 1, closed);

/** A horizontal gradient whose alpha follows each slice. */
const sliceStroke = (
  context: CanvasRenderingContext2D,
  field: IDustField,
  paint: IDustPaint,
  alphaAt: (slice: number) => number,
) => {
  const { xs } = field;
  const gradient = context.createLinearGradient(xs[0], 0, xs[xs.length - 1], 0);
  // A stop every few slices, so the sweep's front is sharp where it runs.
  const stops = Math.min(xs.length - 1, 96);
  for (let stop = 0; stop <= stops; stop += 1) {
    const slice = Math.round((stop / stops) * (xs.length - 1));
    gradient.addColorStop(stop / stops, rgba(paint.ink, alphaAt(slice)));
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

/** The line's height at a point between slices, as the stroke draws it. */
const lineYAt = (ys: Float64Array, position: number) => {
  const clamped = Math.max(0, Math.min(ys.length - 1, position));
  const low = Math.floor(clamped);
  const high = Math.min(ys.length - 1, low + 1);
  return ys[low] + (ys[high] - ys[low]) * (clamped - low);
};

/** The stroke's width, which a closed bead's diameter matches. */
const LINE_WIDTH = 2.2;

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
  const lineAlpha = frame.line * frame.presence;

  // The stroke first, so the beads closing onto it sit on top of it until
  // they are gone into it.
  if (lineAlpha > 0.003) {
    context.lineJoin = 'round';
    context.lineCap = 'round';
    context.globalAlpha = lineAlpha;
    context.lineWidth = LINE_WIDTH;
    context.strokeStyle = sliceStroke(context, field, paint, (slice) =>
      strokeShare(frame.closed[slice]),
    );
    traceCurve(context, field, ys);
    context.stroke();
    context.globalAlpha = 1;
  }

  // The points, as light on the dark window and as ink on the white one.
  // Closing, each stops wandering, slides to its even place along its slice
  // and onto the line's own height there, and grows to the stroke's width:
  // three to a slice of five pixels, so neighbours overlap into a chain.
  if (frame.presence > 0.003) {
    context.globalCompositeOperation = paint.blend;
    field.dots.forEach((dot) => {
      const closed = frame.closed[dot.slice];
      const beads = beadShare(closed);
      const taper = field.taper[dot.slice];
      // Once closed a bead belongs to the line, which runs the whole width.
      const reach = taper + (1 - taper) * closed;
      const alpha = beads * frame.presence * reach * frame.line;
      if (alpha <= 0.003) {
        return;
      }
      const confidence = frame.confidence[dot.slice];
      const open = 1 - closed;
      const across = dot.across * open + dot.closedAcross * closed;
      const wander =
        dot.g0 * Math.cos(dot.speed * frame.seconds) +
        dot.g1 * Math.sin(dot.speed * frame.seconds);
      const spread = spreadDb(confidence) * (0.35 + 0.65 * taper) * open * open;
      const scattered = yOf(frame.curve[dot.slice] + wander * spread * 0.95);
      // On the stroke itself once closed, never on its slice's step.
      const onLine = lineYAt(ys, dot.slice + across);
      const y = scattered + (onLine - scattered) * closed;
      const radius =
        dot.radius * (1.25 + 0.55 * confidence) * open +
        (LINE_WIDTH / 2 + 0.25) * closed;
      context.fillStyle = rgba(
        paint.ink,
        ((0.3 + 0.6 * confidence) * open + 0.85 * closed) * alpha,
      );
      context.beginPath();
      context.arc(
        field.xs[dot.slice] + across * field.step,
        y,
        radius,
        0,
        Math.PI * 2,
      );
      context.fill();
    });
    context.globalCompositeOperation = 'source-over';
  }

  // The one moment: once closed, a light runs along the finished line.
  if (lineAlpha > 0.003 && frame.pass > 0 && frame.pass < 1) {
    const left = field.xs[0];
    const width = field.xs[field.xs.length - 1] - left;
    const head = left + frame.pass * width * 1.15 - width * 0.075;
    const light = context.createLinearGradient(head - 90, 0, head + 30, 0);
    light.addColorStop(0, rgba(paint.light, 0));
    light.addColorStop(0.8, rgba(paint.light, 0.95));
    light.addColorStop(1, rgba(paint.light, 0));
    context.globalAlpha = lineAlpha;
    context.lineJoin = 'round';
    context.lineCap = 'round';
    context.strokeStyle = light;
    context.lineWidth = LINE_WIDTH + 1.4;
    traceCurve(context, field, ys);
    context.stroke();
    context.globalAlpha = 1;
  }
};
