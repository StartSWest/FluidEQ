/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useSyncExternalStore } from 'react';
import { paletteLinear, type IScenePaletteValue } from 'common/scenePalette';
import type { ISceneColour, ISceneSky } from './sceneTint';
import {
  contrast,
  hueDistance,
  intoGamut,
  luminance,
  parseCssColour,
  rgbToLab,
  toByte,
  toGamma,
  toLinear,
  type ILab,
} from './oklab';
import { isLightWindow, subscribeWindowSide } from './windowSide';

/**
 * RAINBOW MODE'S COLOURS: A PALETTE, NOT THE SPECTRUM.
 *
 * The mode painted red, orange, yellow, green, blue and violet in that order,
 * and in that order it is a flag (Ivan, 2026-09-26: "que podemos hacer para
 * que no se parezca al LGBT"). Then it painted Lagoon — seven cold hues from
 * aqua through the original cyan to a soft azure, the colours of the app's
 * own icon, which the icon still wears (`LAGOON`). Since the mode lost its
 * switch (2026-11-18, `euphoriaMode.ts`) a standard look paints the window's
 * own pair: one colour, or the Tint's gradient to a second
 * (`rainbowBetween`); while a Plus visualizer is chosen, a palette made from
 * that scene's own colours ("different rainbow modes depending on the current
 * plus viz", `RainbowSource.tsx`).
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

/**
 * Seven stops from a scene's own palette (contract 9), in the palette's own
 * order, bass to treble — never re-sorted round the wheel as a swatch is,
 * because the palette IS the order: the scene paints its bass in the first
 * stop and its treble in the last, and the bands and the wave read the
 * rainbow first to last the same way (`rainbowRgbAt`), so each band wears the
 * colour the scene gives that band (Ivan, 2026-11-08: "what ever user picks
 * for that scene makes app goes that palette in wave and meters").
 *
 * Sampled where the palette's own positions put its colours, mixed in OKLab
 * as the scene's texture is (`paletteLinear`), then held inside the band the
 * marks read in — the lightness of every stop between `MIN_LIGHTNESS` and
 * `MAX_LIGHTNESS`, a coloured stop at least `MIN_CHROMA` — so a palette that
 * runs into black or navy still reads as a 2px mark on the window's floor at
 * every theme shade. A stop that is grey stays grey. A palette of greys alone
 * is no rainbow, as a swatch of greys is not: undefined, and the caller falls
 * back to what it had.
 */
export const rainbowFromPalette = (
  value: IScenePaletteValue,
): string[] | undefined => {
  const coloured = value.stops.some((hex) => {
    const parsed = parseCssColour(hex);
    return parsed !== undefined && toLch(rgbToLab(parsed.rgb)).c >= GREY_CHROMA;
  });
  if (!coloured) {
    return undefined;
  }
  const linear = paletteLinear(value, RAINBOW_STOP_COUNT);
  return Array.from({ length: RAINBOW_STOP_COUNT }, (_, index) => {
    const own = toLch(
      rgbToLab([
        toGamma(linear[index * 3]),
        toGamma(linear[index * 3 + 1]),
        toGamma(linear[index * 3 + 2]),
      ]),
    );
    return toHex(
      fromLch({
        l: Math.min(MAX_LIGHTNESS, Math.max(MIN_LIGHTNESS, own.l)),
        c: own.c < GREY_CHROMA ? own.c : Math.max(MIN_CHROMA, own.c),
        h: own.h,
      }),
    );
  });
};

/**
 * A measured scene colour as the hex the palettes are written in, at the
 * lightness and chroma it was measured at: `rainbowFromColours` lifts it into
 * the band the marks read in.
 */
export const sceneColourHex = ({ lightness, chroma, hue }: ISceneColour) =>
  toHex(fromLch({ l: lightness, c: chroma, h: hue }));

/**
 * Seven stops from `from` to `to`, the window's own pair of colours
 * (`windowTint.ts`): lightness and chroma in a straight line and the hue the
 * short way round the wheel, in OKLCH, so a cyan to a violet passes through
 * blue and never back through green and yellow. The two ends are the colours
 * as given, every stop of them, so one colour twice is that colour seven
 * times and nothing reads as a gradient. A grey has no hue of its own and
 * takes the other end's, so the way to it is a fade of one colour rather
 * than a turn through whatever hue its rounding left it.
 */
export const rainbowBetween = (from: string, to: string): string[] => {
  const labOf = (hex: string) => {
    const parsedHex = parseCssColour(hex);
    return toLch(parsedHex ? rgbToLab(parsedHex.rgb) : { l: 0, a: 0, b: 0 });
  };
  const start = labOf(from);
  const end = labOf(to);
  const startHue = start.c < GREY_CHROMA ? end.h : start.h;
  const endHue = end.c < GREY_CHROMA ? startHue : end.h;
  const turn = ((endHue - startHue + 540) % 360) - 180;
  const last = RAINBOW_STOP_COUNT - 1;
  return Array.from({ length: RAINBOW_STOP_COUNT }, (_, index) => {
    if (index === 0 || from === to) {
      return from;
    }
    if (index === last) {
      return to;
    }
    const amount = index / last;
    return toHex(
      fromLch({
        l: start.l + (end.l - start.l) * amount,
        c: start.c + (end.c - start.c) * amount,
        h: (startHue + turn * amount + 360) % 360,
      }),
    );
  });
};

// *** The palette on a light window *******************************************

/**
 * What a stop has to keep on a light window: a 2px line in it, the analyser's
 * edge, a fader's lit mark, the meter's ramp, reads on the white panes at
 * 3:1, the contrast a graphical object needs (WCAG 1.4.11).
 */
export const LINE_ON_WHITE = 3;
const WHITE_LUMINANCE = 1;

/**
 * `colour` (any colour `parseCssColour` reads) moved in OKLab lightness -
 * down when `darker`, up otherwise - its hue kept and its chroma kept as far
 * as the screen can show it, to the nearest step that stands at `target`
 * against a ground of `groundLuminance` (WCAG relative luminance); a colour
 * that already does is returned as it is, and one that cannot be read too.
 * Sixteen halvings land within a 65,000th of the step.
 */
export const clearedFor = (
  colour: string,
  groundLuminance: number,
  target: number,
  darker: boolean,
): string => {
  const parsed = parseCssColour(colour);
  if (!parsed) {
    return colour;
  }
  const reads = (lab: ILab) =>
    contrast(luminance(intoGamut(lab)), groundLuminance) >= target;
  const lab = rgbToLab(parsed.rgb);
  if (reads(lab)) {
    return colour;
  }
  // `reached` always reads (the end of the range, as near as it gets),
  // `fails` never does.
  let reached = darker ? 0 : 1;
  let fails = lab.l;
  for (let step = 0; step < 16; step += 1) {
    const middle = (reached + fails) / 2;
    if (reads({ ...lab, l: middle })) {
      reached = middle;
    } else {
      fails = middle;
    }
  }
  // Written in whole bytes, the step that reads can round a hair past itself:
  // Lagoon's lightest stop came out at 2.985:1 on white. Moved on a 512th of
  // lightness at a time until the colour as written reads as well.
  const writtenReads = (hex: string): boolean => {
    const written = parseCssColour(hex);
    return (
      written !== undefined &&
      contrast(luminance(written.rgb.map(toLinear)), groundLuminance) >= target
    );
  };
  const end = darker ? 0 : 1;
  let out = toHex({ ...lab, l: reached });
  while (!writtenReads(out) && reached !== end) {
    reached = darker
      ? Math.max(0, reached - 1 / 512)
      : Math.min(1, reached + 1 / 512);
    out = toHex({ ...lab, l: reached });
  }
  return out;
};

/**
 * `hex` taken down in OKLab lightness, its hue kept and its chroma kept as far
 * as the screen can show it, to the lightest step that still reads on white;
 * a stop that already reads is returned as it is (`deepenedFor`).
 *
 * Every palette was built for a dark window - Lagoon is held between 0.70 and
 * 0.88 so a thin mark stands out of a floor near black - and on a white window
 * the same stops were neon pastel on white, 1.2 to 1.9:1, which Ivan read as
 * garish (2026-11-18, "we need to look professional for the light theme").
 * A transform of whatever palette is chosen, never a palette of its own, so a
 * scene's colours, the listener's pick and the tint keep their hues on both
 * sides of the Brightness.
 */
export const stopOnWhite = (hex: string): string =>
  clearedFor(hex, WHITE_LUMINANCE, LINE_ON_WHITE, true);

/** Each palette's light-window copy, made once per palette. */
const onWhite = new WeakMap<readonly string[], readonly string[]>();
const paletteOnWhite = (palette: readonly string[]): readonly string[] => {
  const known = onWhite.get(palette);
  if (known) {
    return known;
  }
  const made = palette.map(stopOnWhite);
  onWhite.set(palette, made);
  return made;
};

// *** The palette in use ******************************************************

/** The palette chosen, before the window's side has a say. */
let chosen: readonly string[] = LAGOON;
/** What is worn: the chosen palette, or its copy on a light window. */
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

/** The seven stops in use now, as worn on this side of the Brightness. */
export const getRainbowStops = (): readonly string[] => stops;

/** Wear the chosen palette as this side of the window wants it. */
const wear = () => {
  const next = isLightWindow() ? paletteOnWhite(chosen) : chosen;
  if (next === stops) {
    return;
  }
  stops = next;
  paintRoot();
  listeners.forEach((listener) => listener());
};

/**
 * Put `next` in use — Lagoon for undefined — on the root and for every
 * script that draws in it. Anything but seven stops is refused, keeping the
 * palette there is.
 */
export const setRainbowStops = (next: readonly string[] | undefined) => {
  const wanted = next ?? LAGOON;
  if (
    wanted.length !== RAINBOW_STOP_COUNT ||
    wanted.every((stop, index) => stop === chosen[index])
  ) {
    return;
  }
  chosen = wanted;
  wear();
};

// A window that opens light has said so before the first palette is chosen.
wear();
subscribeWindowSide(wear);

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
