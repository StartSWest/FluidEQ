/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useSyncExternalStore } from 'react';
import type { ISceneColour, ISceneSky } from './sceneTint';
import {
  hueDistance,
  intoGamut,
  parseCssColour,
  rgbToLab,
  toByte,
  type ILab,
} from './oklab';

/**
 * RAINBOW MODE'S COLOURS: A PALETTE, NOT THE SPECTRUM.
 *
 * The mode painted red, orange, yellow, green, blue and violet in that order,
 * and in that order it is a flag (Ivan, 2026-09-26: "que podemos hacer para
 * que no se parezca al LGBT"). It paints Lagoon now — seven cold hues from
 * aqua through the original cyan to a soft azure, the colours of the app's
 * own icon (Ivan, 2026-09-26: "wave lagoon", picked over Aurora, which ran on
 * into violet and pink, because he wanted it "more close to our original
 * cyan") — and, while a Plus visualizer is chosen, a palette made from that
 * scene's own colours ("different rainbow modes depending on the current plus
 * viz"), so every scene has a rainbow of its own (`RainbowSource.tsx`).
 *
 * Always seven stops. The stylesheets read them from the root as
 * `--rainbow-1` … `--rainbow-7`: the sweeps are gradients through them and
 * the colour cycle steps through them (`Rainbow.scss`). Everything drawn
 * from a script reads them here: the bands and the graph's points, the
 * player's faders, the level meter, the traces and the karaoke lyrics.
 */

export const RAINBOW_STOP_COUNT = 7;

/**
 * The seven stops, in order: aqua, the original cyan, cyan, sky, azure, blue,
 * periwinkle. The icon's wave and edge are drawn in them too (`icon.svg`,
 * `SignalBrandMark`), so the mode and the mark are one set of colours.
 */
export const LAGOON: readonly string[] = [
  '#72f7dd',
  '#00e5cf',
  '#00dbe6',
  '#00ccf5',
  '#27b8ff',
  '#51a3ff',
  '#7a95ff',
];

/** The root's custom properties, one per stop. */
export const RAINBOW_TOKENS: readonly string[] = LAGOON.map(
  (_, index) => `--rainbow-${index + 1}`,
);

// *** A scene's colours, as a rainbow *****************************************

interface ILch {
  l: number;
  c: number;
  h: number;
}

const toLch = ({ l, a, b }: ILab): ILch => ({
  l,
  c: Math.hypot(a, b),
  h: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360,
});

const fromLch = ({ l, c, h }: ILch): ILab => {
  const radians = (h * Math.PI) / 180;
  return { l, a: c * Math.cos(radians), b: c * Math.sin(radians) };
};

const toHex = (lab: ILab) =>
  `#${intoGamut(lab)
    .map((channel) => toByte(channel).toString(16).padStart(2, '0'))
    .join('')}`;

const colourOf = (hex: string, chroma?: number): ISceneColour => {
  const parsed = parseCssColour(hex);
  const lch = toLch(parsed ? rgbToLab(parsed.rgb) : { l: 0, a: 0, b: 0 });
  return { lightness: lch.l, chroma: chroma ?? lch.c, hue: lch.h, share: 1 };
};

/**
 * Lagoon lent to the window the way a Plus visualizer lends its colours
 * (`sceneTintStore.ts`), for Rainbow mode with no visualizer chosen (Ivan,
 * 2026-09-26: "la interfaz ... debe también kind of match some of the aurora
 * color when there is not plus viz"). Some of it, not all: the panes toward
 * its sky at under half the strength a scene's own sky reaches
 * (`FULL_SKY_CHROMA` is 0.08), what is pressed and chosen in its cyan — the
 * accent the themes carry, so the buttons do not change colour with the mode
 * — and what is on in its azure.
 */
export const LAGOON_SKY: ISceneSky = {
  ...colourOf(LAGOON[3], 0.03),
  lightness: 0.3,
  accent: colourOf(LAGOON[2]),
  active: colourOf(LAGOON[5]),
};

/** Under this chroma a colour is a grey and lends a rainbow no hue. */
const GREY_CHROMA = 0.035;
/**
 * The lightness every stop is held inside. The marks are thin — a 2px bar, a
 * name clipped to its letters, a slider's thumb — on a floor near black, and
 * a scene's deep blue at its own lightness disappears into it; above the top
 * the stops wash out to white and the palette stops reading as colour.
 */
const MIN_LIGHTNESS = 0.7;
const MAX_LIGHTNESS = 0.88;
/** At least this much colour, or a pale scene's rainbow is a grey sweep. */
const MIN_CHROMA = 0.12;
/** Two colours nearer than this in hue are one stop, not two. */
const SAME_HUE = 16;
/** A scene in one colour: its neighbours this far either side of it. */
const LONE_HUE_SPREAD = 28;
/**
 * Stops further apart than this in hue are not blended at all: a stop between
 * them is the nearer of the two. Round the wheel an orange and a blue scene
 * would pass through yellow and green — colours the scene does not have, and
 * the flag again — and straight through OKLab a teal and a pink one passed
 * through a grey, which in a neon scene's rainbow read as a dead stop.
 */
const MAX_WHEEL_STEP = 90;

/**
 * Seven stops from a Plus scene's colours — its swatch, the colours its
 * picker icon is drawn in — or undefined for a scene in greys, which keeps
 * Lagoon.
 *
 * Each colour is lifted into the band the marks can be read in, one stop per
 * hue, taken round the wheel from the scene's first colour so the sweep turns
 * one way, and resampled to seven around that loop: the sweep runs out of
 * the last stop into the first again.
 */
export const rainbowFromColours = (
  colours: readonly string[],
): string[] | undefined => {
  const hues: ILch[] = [];
  colours.forEach((text) => {
    const parsed = parseCssColour(text);
    if (!parsed) {
      return;
    }
    const own = toLch(rgbToLab(parsed.rgb));
    if (own.c < GREY_CHROMA) {
      return;
    }
    const stop = {
      l: Math.min(MAX_LIGHTNESS, Math.max(MIN_LIGHTNESS, own.l)),
      c: Math.max(MIN_CHROMA, own.c),
      h: own.h,
    };
    if (hues.every((kept) => hueDistance(kept.h, stop.h) >= SAME_HUE)) {
      hues.push(stop);
    }
  });
  const [first] = hues;
  if (!first) {
    return undefined;
  }
  const loop =
    hues.length === 1
      ? [
          { ...first, h: (first.h + 360 - LONE_HUE_SPREAD) % 360 },
          first,
          { ...first, h: (first.h + LONE_HUE_SPREAD) % 360 },
        ]
      : [...hues].sort(
          (left, right) =>
            ((left.h - first.h + 360) % 360) -
            ((right.h - first.h + 360) % 360),
        );
  return Array.from({ length: RAINBOW_STOP_COUNT }, (_, index) => {
    const position = (index / RAINBOW_STOP_COUNT) * loop.length;
    const from = loop[Math.floor(position) % loop.length];
    const to = loop[(Math.floor(position) + 1) % loop.length];
    const amount = position - Math.floor(position);
    const step = (to.h - from.h + 360) % 360;
    if (step <= MAX_WHEEL_STEP) {
      return toHex(
        fromLch({
          l: from.l + (to.l - from.l) * amount,
          c: from.c + (to.c - from.c) * amount,
          h: (from.h + step * amount) % 360,
        }),
      );
    }
    return toHex(fromLch(amount < 0.5 ? from : to));
  });
};

// *** The palette in use ******************************************************

let stops: readonly string[] = LAGOON;
const listeners = new Set<() => void>();

/** Each palette's stops in OKLab, parsed once per palette. */
const parsed = new WeakMap<readonly string[], readonly ILab[]>();
const labsOf = (palette: readonly string[]): readonly ILab[] => {
  const known = parsed.get(palette);
  if (known) {
    return known;
  }
  const labs = palette.map((hex) => {
    const colour = parseCssColour(hex);
    return colour ? rgbToLab(colour.rgb) : { l: 0, a: 0, b: 0 };
  });
  parsed.set(palette, labs);
  return labs;
};

const paintRoot = () => {
  if (typeof document === 'undefined') {
    return;
  }
  const { style } = document.documentElement;
  RAINBOW_TOKENS.forEach((token, index) => {
    style.setProperty(token, stops[index]);
  });
};

/** The seven stops in use now. */
export const getRainbowStops = (): readonly string[] => stops;

/**
 * Put `next` in use — Lagoon for undefined — on the root and for every
 * script that draws in it. Anything but seven stops is refused, keeping the
 * palette there is.
 */
export const setRainbowStops = (next: readonly string[] | undefined) => {
  const wanted = next ?? LAGOON;
  if (
    wanted.length !== RAINBOW_STOP_COUNT ||
    wanted.every((stop, index) => stop === stops[index])
  ) {
    return;
  }
  stops = wanted;
  paintRoot();
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The stops, for a component that has to draw again when they change. */
export const useRainbowStops = (): readonly string[] =>
  useSyncExternalStore(
    subscribe,
    () => stops,
    () => LAGOON,
  );

const mix = (from: ILab, to: ILab, amount: number): ILab => ({
  l: from.l + (to.l - from.l) * amount,
  a: from.a + (to.a - from.a) * amount,
  b: from.b + (to.b - from.b) * amount,
});

const toRgb = (lab: ILab): [number, number, number] => {
  const [red, green, blue] = intoGamut(lab).map(toByte);
  return [red, green, blue];
};

/**
 * The palette from its first stop to its last, `progress` 0 to 1: the bands
 * low to high, as the band spectrum ran before it. `palette` is the one in
 * use unless a component that drew with `useRainbowStops` hands its own.
 */
export const rainbowRgbAt = (
  progress: number,
  palette: readonly string[] = stops,
): [number, number, number] => {
  const labs = labsOf(palette);
  const position =
    Math.max(0, Math.min(1, progress)) * (RAINBOW_STOP_COUNT - 1);
  const index = Math.min(RAINBOW_STOP_COUNT - 2, Math.floor(position));
  return toRgb(mix(labs[index], labs[index + 1], position - index));
};

/**
 * The palette as a loop, `phase` any number of turns: what the hue sweep
 * was, for everything that turned the colour wheel in time with the mode.
 * `lift` moves it toward white (positive) or black (negative), in OKLab
 * lightness, for the lit and the shaded parts of one mark; `alpha` under 1
 * makes it `rgba` for a glow.
 */
export const rainbowColourAt = (phase: number, lift = 0, alpha = 1): string => {
  const labs = labsOf(stops);
  const turn = ((phase % 1) + 1) % 1;
  const position = turn * RAINBOW_STOP_COUNT;
  const index = Math.floor(position) % RAINBOW_STOP_COUNT;
  const lab = mix(
    labs[index],
    labs[(index + 1) % RAINBOW_STOP_COUNT],
    position - Math.floor(position),
  );
  const [red, green, blue] = toRgb({
    ...lab,
    l: Math.max(0, Math.min(1, lab.l + lift)),
  });
  return alpha < 1
    ? `rgba(${red}, ${green}, ${blue}, ${Math.max(0, alpha).toFixed(3)})`
    : `rgb(${red}, ${green}, ${blue})`;
};

/** The stops as a canvas gradient's, evenly spaced first to last. */
export const rainbowGradientStops = (): ReadonlyArray<{
  offset: number;
  colour: string;
}> =>
  stops.map((colour, index) => ({
    offset: index / (RAINBOW_STOP_COUNT - 1),
    colour,
  }));
