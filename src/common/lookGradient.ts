/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

/**
 * A look's gradient as points somebody can move (Ivan, 2026-11-26: "pick
 * gradients easily instead of colour by colour, still with customizable
 * keypoints").
 *
 * Every drawing of a look — the 2D bars, the SVG traces, the shaders — reads
 * its colours as a ramp of EVENLY SPACED stops, in some forty places. Rather
 * than teach all of them positions, a point may stand only on a grid of
 * `LOOK_GRADIENT_STEPS`, and the drawing is handed the ramp sampled at every
 * step of the coarsest grid that holds all the points (`lookRampFromStops`).
 * Between two grid steps both are straight lines between the same colours, so
 * the even ramp IS the gradient the points describe, not an approximation of
 * it. Sixty, because it is the smallest grid every older look lands on
 * exactly: one to seven evenly spaced colours put their points on halves,
 * thirds, quarters, fifths and sixths, and sixty is divisible by all of them.
 *
 * A look is stored with its points AND with `colours`, the same gradient as
 * at most seven evenly spaced colours (`legacyColoursFromStops`). Older
 * versions of FluidEQ read only `colours` and never knew there could be more
 * than seven, so that is what they are given: the gradient exactly wherever
 * its points sit on sevenths of the bar or coarser, sampled at seven points
 * otherwise.
 */

import type { GraphPalette } from './graphStyles';

export const LOOK_GRADIENT_STEPS = 60;
/** A gradient is two colours at least; one is a flat fill (`signal`). */
export const MIN_LOOK_STOPS = 2;
/**
 * Eight: one more than the seven colours a look could hold before, so
 * nothing ever saved is out of reach, and few enough that the points stay
 * far enough apart on a 228px bar to be picked up one at a time.
 */
export const MAX_LOOK_STOPS = 8;
/** What older versions keep of `colours` (`MAX_LOOK_COLOURS` there). */
const LEGACY_COLOURS = 7;

export interface ILookStop {
  /** `#rrggbb`. */
  colour: string;
  /** Where it stands, 0 to 1, always on the grid (`snapLookStop`). */
  at: number;
}

const HEX_COLOUR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

type Rgb = [number, number, number];

const readHex = (colour: string): Rgb => {
  const digits = colour.slice(1);
  const full =
    digits.length === 3
      ? digits
          .split('')
          .map((digit) => digit + digit)
          .join('')
      : digits;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
};

const toHex = (rgb: Rgb): string =>
  `#${rgb.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;

const asHex6 = (colour: string): string => toHex(readHex(colour));

/** The grid step a position stands on. */
export const stepOf = (at: number): number =>
  Math.round(Math.max(0, Math.min(1, at)) * LOOK_GRADIENT_STEPS);

/** A position put on the grid. */
export const snapLookStop = (at: number): number =>
  stepOf(at) / LOOK_GRADIENT_STEPS;

/**
 * The gradient's colour at `at`, rounded to whole channels the way the
 * drawing rounds them (`rampAt` in `lookColours.ts`). Before the first point
 * the first colour holds, after the last the last.
 */
export const lookColourAt = (
  stops: readonly ILookStop[],
  at: number,
): string => {
  if (!stops.length) {
    return '#000000';
  }
  const first = stops[0];
  const last = stops[stops.length - 1];
  if (at <= first.at) {
    return asHex6(first.colour);
  }
  if (at >= last.at) {
    return asHex6(last.colour);
  }
  const upper = stops.findIndex((stop) => stop.at >= at);
  const to = stops[upper];
  const from = stops[upper - 1];
  const blend = (at - from.at) / Math.max(1e-9, to.at - from.at);
  const a = readHex(from.colour);
  const b = readHex(to.colour);
  return toHex([
    Math.round(a[0] + (b[0] - a[0]) * blend),
    Math.round(a[1] + (b[1] - a[1]) * blend),
    Math.round(a[2] + (b[2] - a[2]) * blend),
  ]);
};

/**
 * Evenly spaced colours as points: how every look saved before points
 * existed opens, and how a ready-made gradient is laid on the bar. One colour
 * becomes two points of it, which draws the same flat figure.
 */
export const lookStopsFromColours = (
  colours: readonly string[],
): ILookStop[] => {
  if (!colours.length) {
    return [];
  }
  if (colours.length === 1) {
    return [
      { colour: asHex6(colours[0]), at: 0 },
      { colour: asHex6(colours[0]), at: 1 },
    ];
  }
  return colours.map((colour, index) => ({
    colour: asHex6(colour),
    at: snapLookStop(index / (colours.length - 1)),
  }));
};

const sampleEvenly = (stops: readonly ILookStop[], segments: number) =>
  Array.from({ length: segments + 1 }, (_unused, index) =>
    lookColourAt(stops, index / segments),
  );

/**
 * The fewest segments that put every point on a segment boundary: a divisor
 * of the grid, so the answer always exists (the grid itself).
 */
const coarsestGrid = (stops: readonly ILookStop[]): number => {
  const steps = stops.map((stop) => stepOf(stop.at));
  for (let segments = 1; segments <= LOOK_GRADIENT_STEPS; segments += 1) {
    if (
      LOOK_GRADIENT_STEPS % segments === 0 &&
      steps.every((step) => (step * segments) % LOOK_GRADIENT_STEPS === 0)
    ) {
      return segments;
    }
  }
  return LOOK_GRADIENT_STEPS;
};

/**
 * The ramp the drawing reads: the gradient sampled at every step of the
 * coarsest grid that holds its points, so straight lines between evenly
 * spaced samples retrace it exactly. Seven evenly spaced points come back as
 * their own seven colours, which is what such a look drew before points.
 */
export const lookRampFromStops = (stops: readonly ILookStop[]): string[] =>
  stops.length ? sampleEvenly(stops, coarsestGrid(stops)) : [];

/** The same gradient for a version that knows only `colours`. */
export const legacyColoursFromStops = (
  stops: readonly ILookStop[],
): string[] => {
  const ramp = lookRampFromStops(stops);
  return ramp.length <= LEGACY_COLOURS
    ? ramp
    : sampleEvenly(stops, LEGACY_COLOURS - 1);
};

/**
 * The points a stored look carries, or none.
 *
 * None for a flat palette, which is one colour and has no axis to run a
 * gradient along, and for anything that is not two to eight readable points
 * — the look then draws from its `colours`, as every older one does. Points
 * are put on the grid, ordered, and two on the same step keep the first:
 * the drawing could not tell them apart.
 */
export const normalizeLookStops = (
  raw: unknown,
  palette: GraphPalette,
): ILookStop[] => {
  if (palette === 'signal' || !Array.isArray(raw)) {
    return [];
  }
  const read = raw.flatMap((entry: unknown): ILookStop[] => {
    if (!entry || typeof entry !== 'object') {
      return [];
    }
    const { colour, at } = entry as Record<string, unknown>;
    if (
      typeof colour !== 'string' ||
      !HEX_COLOUR.test(colour.trim()) ||
      typeof at !== 'number' ||
      !Number.isFinite(at)
    ) {
      return [];
    }
    return [
      { colour: asHex6(colour.trim().toLowerCase()), at: snapLookStop(at) },
    ];
  });
  const ordered = read
    .map((stop, index) => ({ stop, index }))
    .sort((a, b) => a.stop.at - b.stop.at || a.index - b.index)
    .map(({ stop }) => stop)
    .filter(
      (stop, index, list) => index === 0 || list[index - 1].at !== stop.at,
    );
  return ordered.length >= MIN_LOOK_STOPS && ordered.length <= MAX_LOOK_STOPS
    ? ordered
    : [];
};

/** Whether two sets of points are the same gradient, point for point. */
export const sameLookStops = (
  a: readonly ILookStop[],
  b: readonly ILookStop[],
): boolean =>
  a.length === b.length &&
  a.every(
    (stop, index) =>
      stepOf(stop.at) === stepOf(b[index].at) &&
      asHex6(stop.colour) === asHex6(b[index].colour),
  );

/**
 * A point added where the bar was pressed: the colour the gradient already
 * has there, so adding one changes nothing until it is recoloured or moved.
 * Answers the new points and where the new one landed, or nothing when the
 * bar is full or a point already stands on that step.
 */
export const addLookStop = (
  stops: readonly ILookStop[],
  at: number,
): { stops: ILookStop[]; index: number } | undefined => {
  const snapped = snapLookStop(at);
  if (
    stops.length >= MAX_LOOK_STOPS ||
    stops.some((stop) => stepOf(stop.at) === stepOf(snapped))
  ) {
    return undefined;
  }
  const added = { colour: lookColourAt(stops, snapped), at: snapped };
  const next = [...stops, added].sort((a, b) => a.at - b.at);
  return { stops: next, index: next.indexOf(added) };
};

/**
 * A point moved, never past its neighbours: the order of the points is
 * which one is which, and two on one step could not both be drawn.
 */
export const moveLookStop = (
  stops: readonly ILookStop[],
  index: number,
  at: number,
): ILookStop[] => {
  const low = index > 0 ? stepOf(stops[index - 1].at) + 1 : 0;
  const high =
    index < stops.length - 1
      ? stepOf(stops[index + 1].at) - 1
      : LOOK_GRADIENT_STEPS;
  const step = Math.max(low, Math.min(high, stepOf(at)));
  return stops.map((stop, place) =>
    place === index ? { ...stop, at: step / LOOK_GRADIENT_STEPS } : stop,
  );
};

/** A point taken away, never below two. */
export const removeLookStop = (
  stops: readonly ILookStop[],
  index: number,
): ILookStop[] =>
  stops.length > MIN_LOOK_STOPS
    ? stops.filter((_stop, place) => place !== index)
    : [...stops];

export const recolourLookStop = (
  stops: readonly ILookStop[],
  index: number,
  colour: string,
): ILookStop[] =>
  stops.map((stop, place) =>
    place === index ? { ...stop, colour: asHex6(colour.toLowerCase()) } : stop,
  );

/** A CSS gradient of exactly the ramp the drawing reads. */
export const lookRampCss = (ramp: readonly string[]): string => {
  if (!ramp.length) {
    return 'none';
  }
  const stops = ramp.length === 1 ? [ramp[0], ramp[0]] : ramp;
  return `linear-gradient(to right, ${stops.join(', ')})`;
};
