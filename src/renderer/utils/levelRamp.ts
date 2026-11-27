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

/** One stop of a ladder: its lightness, and the share of chroma it keeps. */
interface IRung {
  l: number;
  chroma: number;
}

/**
 * The five lightnesses a loudness ramp climbs, quiet to loud, for a colour
 * of lightness `colourL` over a ground of lightness `groundL`, and which rung
 * is the colour's own lightness: monotonic away from the ground, with the
 * colour in the middle, where most of a song's readings sit, and the loud
 * half spent leaving it, so loud passages stand out of the body of the
 * picture instead of sharing its colour. Light or dark is the ground's own
 * lightness, so the ramp cannot disagree with the floor it is drawn on.
 */
const ladderOf = (colourL: number, groundL: number): readonly IRung[] => {
  if (groundL >= 0.5) {
    const quiet = Math.min(0.97, groundL - QUIET_LIFT);
    const deep = Math.max(DEEP_FLOOR, Math.min(colourL, quiet) - DEEP_DROP);
    // The colour itself, unless it stands too near the ground or too near
    // the deep end to be a step of its own: then the ramp's own middle of
    // those two, so the stops still climb.
    const body = Math.min(
      quiet - MIN_STEP * 2,
      Math.max(deep + MIN_STEP, colourL),
    );
    return [
      { l: quiet, chroma: QUIET_CHROMA },
      { l: (quiet + body) / 2, chroma: MIDDLE_CHROMA },
      { l: body, chroma: 1 },
      { l: (body + deep) / 2, chroma: (1 + DEEP_CHROMA) / 2 },
      { l: deep, chroma: DEEP_CHROMA },
    ];
  }
  const quiet = Math.max(0.03, groundL + QUIET_LIFT);
  const hot = Math.min(0.97, Math.max(HOT_LIGHTNESS, colourL + MIN_STEP));
  const body = Math.max(
    quiet + MIN_STEP * 2,
    Math.min(Math.max(HOT_LIGHTNESS, colourL + MIN_STEP) - MIN_STEP, colourL),
  );
  return [
    { l: quiet, chroma: QUIET_CHROMA },
    { l: Math.max(quiet + MIN_STEP, body - DUSK_DROP), chroma: DEEP_CHROMA },
    { l: body, chroma: 1 },
    { l: (body + hot) / 2, chroma: (1 + HOT_CHROMA) / 2 },
    { l: hot, chroma: HOT_CHROMA },
  ];
};

/** The ladder's middle rung, which is the colour where it can be. */
const BODY_RUNG = 2;

/**
 * `colour`'s loudness ramp over a window whose ground is `ground`: five
 * stops, quiet to loud, climbing `ladderOf`'s lightnesses in that one hue,
 * the middle stop the colour itself.
 */
export const levelRampOf = (colour: string, ground: string): TLevelRamp => {
  const hue = labOf(colour);
  const floor = labOf(ground);
  if (!hue || !floor) {
    return [colour];
  }
  return ladderOf(hue.l, floor.l).map((rung, index) =>
    index === BODY_RUNG && rung.l === hue.l
      ? colour
      : atLightness(hue, rung.l, rung.chroma),
  );
};

/** `colours` read at `t` (0 to 1) in OKLab, straight between neighbours. */
const labAlong = (colours: readonly ILab[], t: number): ILab => {
  const at = Math.max(0, Math.min(1, t)) * (colours.length - 1);
  const from = Math.floor(at);
  const to = Math.min(colours.length - 1, from + 1);
  const toward = at - from;
  const [a, b] = [colours[from], colours[to]];
  return {
    l: a.l + (b.l - a.l) * toward,
    a: a.a + (b.a - a.a) * toward,
    b: a.b + (b.b - a.b) * toward,
  };
};

/**
 * A loudness ramp through several colours: each stop takes its hue from the
 * colours read at its place on the ramp, the first colour quiet and the
 * last loud, and its lightness from the ladder one colour of their average
 * lightness would climb (`ladderOf`).
 *
 * For the Spectrogram in the window's colours when there are two or more of
 * them: the Tint's second colour, a Plus scene's rainbow. Painted straight
 * through those colours by level, a raster's loud and quiet differed in hue
 * alone, and on a light window two light colours made a pastel wash where
 * a passage and the silence after it looked the same (Ivan, 2026-11-27,
 * Spectrogram on white: "let's improve all analyzers' colors", then "just
 * that one"). Taking lightness from the ladder, the quiet end sinks into the
 * ground and the loud end leaves it as far as the window allows, as the
 * one-colour ramp has done since 2026-11-24, and the colours still say
 * where on the ramp a reading stands.
 */
export const levelRampThrough = (
  colours: readonly string[],
  ground: string,
): TLevelRamp => {
  const labs = colours
    .map(labOf)
    .filter((lab): lab is ILab => lab !== undefined);
  const floor = labOf(ground);
  if (labs.length === 0 || !floor) {
    return colours;
  }
  const meanL = labs.reduce((sum, lab) => sum + lab.l, 0) / labs.length;
  const ladder = ladderOf(meanL, floor.l);
  return ladder.map((rung, index) =>
    atLightness(
      labAlong(labs, index / (ladder.length - 1)),
      rung.l,
      rung.chroma,
    ),
  );
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

/** `levelRampThrough`, one array per set of colours and ground, as above. */
export const levelRampAcross = (
  colours: readonly string[],
  ground: string,
): TLevelRamp => {
  const key = `${colours.join(',')}|${ground}|through`;
  const known = ramps.get(key);
  if (known) {
    return known;
  }
  if (ramps.size >= REMEMBERED) {
    ramps.clear();
  }
  const built = levelRampThrough(colours, ground);
  ramps.set(key, built);
  return built;
};
