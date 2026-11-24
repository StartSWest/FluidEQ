/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type ILab, labToHex, parseCssColour, rgbToLab } from './oklab';

/**
 * A LOUDNESS RAMP OUT OF ONE COLOUR, for a drawing whose whole content is a
 * level painted as a colour: the Spectrogram's raster.
 *
 * With no second colour on the Tint it was handed seven copies of one colour
 * (Colourful mode's stops, `windowTintStops`) or the primary's walk, three
 * deep teals within a few points of each other on a light window: the plot
 * came out one flat teal with pale streaks where it was quiet, loud and
 * quiet barely apart (Ivan, 2026-11-24: "if I don't select a secondary color
 * there is a flat thing, not good"). A raster with one colour in it still needs a ramp,
 * so the ramp is built from that colour and the window's own ground: silence
 * starts at the ground, the reading climbs through the colour, and the
 * loudest end leaves the ground as far as the window allows — a deep,
 * saturated version of the colour on a light window, a pale hot one on a
 * dark window, where light is what stands out.
 *
 * Worked in OKLab, where equal steps of lightness look equal, and every stop
 * is pulled into the screen's gamut along its own hue (`labToHex`), so a deep
 * cyan stays cyan rather than clipping into blue.
 */

/** The ramp's stops, quiet to loud, as `#rrggbb`. */
export type TLevelRamp = readonly string[];

/**
 * How far the quiet end stands off the ground, in OKLab lightness, and how
 * much of the colour's chroma it carries: just enough hue that a quiet
 * passage reads as the picture thinning out rather than as holes in it.
 */
const QUIET_LIFT = 0.05;
const QUIET_CHROMA = 0.25;

/** The middle stop: halfway from the ground to the colour, mostly coloured. */
const MIDDLE_CHROMA = 0.75;

/**
 * The loud end on a light window: this far under the colour in lightness,
 * never under `DEEP_FLOOR` (a near-black of the hue reads as ink, not as a
 * colour), and a little more saturated than the colour before the gamut
 * pulls it back.
 */
const DEEP_DROP = 0.3;
const DEEP_FLOOR = 0.26;
const DEEP_CHROMA = 1.15;

/**
 * The loud end on a dark window: a pale version of the colour at least this
 * light, keeping some of its chroma so the crest is still the colour's own
 * and not white.
 */
const HOT_LIGHTNESS = 0.93;
const HOT_CHROMA = 0.4;

/**
 * The step just under the colour on a dark window: the colour sunk this far
 * and saturated, so the climb from the ground passes through a deep version
 * of it before the colour itself.
 */
const DUSK_DROP = 0.22;

/** Smallest lightness step between two neighbouring stops. */
const MIN_STEP = 0.08;

const atLightness = (lab: ILab, l: number, chroma: number): string =>
  labToHex({ l, a: lab.a * chroma, b: lab.b * chroma });

const labOf = (colour: string): ILab | undefined => {
  const parsed = parseCssColour(colour);
  return parsed ? rgbToLab(parsed.rgb) : undefined;
};

/**
 * `colour`'s loudness ramp over a window whose ground is `ground`: five
 * stops, quiet to loud, monotonic in lightness away from the ground, with
 * the colour itself in the middle, where most of a song's readings sit, and
 * the loud half spent leaving it, so loud passages stand out of the body of
 * the picture instead of sharing its colour. Light
 * or dark is the ground's own lightness, so the ramp cannot disagree with
 * the floor it is drawn on.
 */
export const levelRampOf = (colour: string, ground: string): TLevelRamp => {
  const hue = labOf(colour);
  const floor = labOf(ground);
  if (!hue || !floor) {
    return [colour];
  }
  if (floor.l >= 0.5) {
    const quiet = Math.min(0.97, floor.l - QUIET_LIFT);
    const deep = Math.max(DEEP_FLOOR, Math.min(hue.l, quiet) - DEEP_DROP);
    // The colour itself, unless it stands too near the ground or too near
    // the deep end to be a step of its own: then the ramp's own middle of
    // those two, so the stops still climb.
    const body = Math.min(
      quiet - MIN_STEP * 2,
      Math.max(deep + MIN_STEP, hue.l),
    );
    const middle = (quiet + body) / 2;
    return [
      atLightness(hue, quiet, QUIET_CHROMA),
      atLightness(hue, middle, MIDDLE_CHROMA),
      body === hue.l ? colour : atLightness(hue, body, 1),
      atLightness(hue, (body + deep) / 2, (1 + DEEP_CHROMA) / 2),
      atLightness(hue, deep, DEEP_CHROMA),
    ];
  }
  const quiet = Math.max(0.03, floor.l + QUIET_LIFT);
  const hot = Math.max(HOT_LIGHTNESS, hue.l + MIN_STEP);
  const body = Math.max(quiet + MIN_STEP * 2, Math.min(hot - MIN_STEP, hue.l));
  const dusk = Math.max(quiet + MIN_STEP, body - DUSK_DROP);
  return [
    atLightness(hue, quiet, QUIET_CHROMA),
    atLightness(hue, dusk, DEEP_CHROMA),
    body === hue.l ? colour : atLightness(hue, body, 1),
    atLightness(hue, (body + Math.min(0.97, hot)) / 2, (1 + HOT_CHROMA) / 2),
    atLightness(hue, Math.min(0.97, hot), HOT_CHROMA),
  ];
};

/**
 * How far apart, in OKLab, a set's stops may lie and still be one colour.
 * The window's stops with no second colour on the Tint are seven copies of
 * the first (`windowTintStops`), and a light window's wearing of them
 * (`paletteOnWhite`) keeps them within a hair of each other; two picked
 * colours, or a Plus scene's own rainbow, lie far further apart than this.
 */
const ONE_COLOUR_SPREAD = 0.06;

/** Whether every stop of `stops` is, to the eye, the same colour. */
export const isOneColour = (stops: readonly string[]): boolean => {
  const [first, ...rest] = stops.map(labOf);
  if (!first) {
    return true;
  }
  return rest.every(
    (stop) =>
      stop !== undefined &&
      Math.hypot(stop.l - first.l, stop.a - first.a, stop.b - first.b) <=
        ONE_COLOUR_SPREAD,
  );
};

const REMEMBERED = 16;
const ramps = new Map<string, TLevelRamp>();

/**
 * `levelRampOf`, one array per colour and ground: the drawings cache what
 * they build from a ramp by the array it came in, and every frame asks.
 */
export const levelRamp = (colour: string, ground: string): TLevelRamp => {
  const key = `${colour}|${ground}`;
  const known = ramps.get(key);
  if (known) {
    return known;
  }
  if (ramps.size >= REMEMBERED) {
    ramps.clear();
  }
  const built = levelRampOf(colour, ground);
  ramps.set(key, built);
  return built;
};
