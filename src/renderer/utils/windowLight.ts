/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  contrast,
  labToHex,
  luminance,
  parseCssColour,
  rgbToLab,
  toLinear,
  toward,
  type ILab,
} from './oklab';
import {
  cardHexOf,
  EDGE_TINT,
  edgeOn,
  groundOf,
  inkTokens,
  LIGHT_INK,
  type IInkSet,
  type TInkToken,
} from './themeInk';
import {
  ACCENT_DARK_STEP,
  atL,
  chromaOf,
  clampL,
  clearOf,
  filledFace,
  GREY_CHROMA,
  labOf,
  type IFillGround,
} from './windowFill';
import {
  WINDOW_EDGES,
  WINDOW_LABELS,
  WINDOW_SURFACES,
  type TWindowSurface,
} from './windowTokens';

/**
 * A WHOLE WINDOW FROM ITS SURFACES AND TWO COLOURS, LIGHT OR DARK (Ivan,
 * 2026-11-17: "depending on the setting, the app needs to color white or
 * dark", and for the Brightness: "just grow the scale from 0 full dark to 100
 * fully white").
 *
 * Everything else the window wears follows from what it stands on: the
 * hairlines, the three text tiers, the dim tier, the graph's rules, the
 * controls' edges (`inkTokens`), the accent's four strengths and the colour
 * for "on". A light window's ink is dark, solved to the very contrasts a dark
 * window's light ink is, so one set of token names serves both and the
 * stylesheets never ask which it is.
 *
 * Two callers build on this: the theme's light end (`themeShade.ts`, from
 * Brightness 77 to 100), and colours somebody named (`pickedWindow.ts`).
 * Imports nothing that imports the theme, so the theme can import it.
 */

/** The ink a window wears: light ink on a dark window, dark on a light one. */
export type TWindowInk = 'light' | 'dark';

/**
 * Dark ink when it reads better on `surface` than white does: the WCAG
 * crossover, a relative luminance of about 0.18.
 */
export const inkForSurface = (surface: string): TWindowInk => {
  const parsed = parseCssColour(surface);
  if (!parsed) {
    return 'light';
  }
  const lum = luminance(parsed.rgb.map(toLinear));
  return contrast(lum, 0) > contrast(lum, 1) ? 'dark' : 'light';
};

/**
 * The light window's surfaces, in OKLab lightness under its surface, which is
 * the panes and the fields themselves (the mockup Ivan chose, "white panes on
 * a soft floor"). The floor is the step that makes a pane a shape without a
 * shadow; the wells and the empty tracks are recesses cut below it, where a
 * fader's slot or a switch that is off has to read as empty on white.
 */
const LIGHT_LADDER: Record<TWindowSurface, number> = {
  '--surface-base': -0.058,
  '--surface-panel': 0,
  '--surface-block': -0.014,
  '--surface-field': 0,
  '--surface-field-end': -0.022,
  '--surface-menu': 0,
  '--surface-menu-top': 0,
  '--surface-menu-face': 0,
  '--surface-well': -0.07,
  '--track-well': -0.12,
};

/** The menus are the card's own colour, as on every theme shade. */
const CARD_COLOURED: readonly TWindowSurface[] = [
  '--surface-menu',
  '--surface-menu-top',
  '--surface-menu-face',
];

/**
 * The whisper of colour a grey surface's floor, wells and tracks take from
 * the accent, so white panes stand on a floor of their scene rather than on
 * an office grey (the chosen mockup's floor, #ebe9ef under a deep violet).
 * The panes keep the surface exactly.
 */
const GREY_SURFACE_CHROMA = 0.008;

/**
 * The accent as ink and edge on a light window (`--accent-light`: the
 * kickers, the lit controls' words, the control edges): AA for words on the
 * panes. On a dark window it is the pale light every theme's is.
 */
const ACCENT_INK_CONTRAST = 4.5;
const DARK_ACCENT_LIGHT_LIGHTNESS = 0.88;

/**
 * The accent's deepest strength, in OKLab lightness below it; its pressed one
 * is `ACCENT_DARK_STEP`.
 */
const ACCENT_DARKER_STEP = 0.16;

/** The light window's edge colour: a deep ink leaning to the window's hue. */
const DARK_EDGE_LIGHTNESS = 0.25;
const EDGE_CHROMA = 0.03;

/** Where the light window's text tiers start, before contrast moves them. */
const DARK_TEXT_LIGHTNESS = {
  '--text-primary': 0.22,
  '--text-muted': 0.4,
  '--text-faint': 0.52,
} as const;
const DARK_INK_LIGHTNESS = 0.17;
const DARK_TEXT_CHROMA = 0.03;

/** Whether `hex` has no hue to speak of: black, a grey, white. */
export const isHueless = (hex: string): boolean => {
  const lab = labOf(hex);
  return lab !== undefined && chromaOf(lab) < GREY_CHROMA;
};

/** `hex` at its own lightness with its hue taken out: the grey it stands at. */
export const withoutHue = (hex: string): string => {
  const lab = labOf(hex);
  return lab ? labToHex({ l: lab.l, a: 0, b: 0 }) : hex;
};

export const hueOf = (lab: ILab) =>
  ((Math.atan2(lab.b, lab.a) * 180) / Math.PI + 360) % 360;

/**
 * The hue a window's greys and inks lean to: the accent's when it has one,
 * else the surface's, else none.
 */
export const leanOf = (surface: ILab, accent: ILab): number | undefined => {
  if (chromaOf(accent) >= GREY_CHROMA) {
    return hueOf(accent);
  }
  return chromaOf(surface) >= GREY_CHROMA ? hueOf(surface) : undefined;
};

/** A colour at `l` and `chroma`, leaning to `hue` (a grey with none). */
export const leaning = (
  l: number,
  chroma: number,
  hue: number | undefined,
): ILab =>
  hue === undefined
    ? { l, a: 0, b: 0 }
    : toward({ l, a: 0, b: 0 }, chroma, hue, 1);

/** A grey surface's derived rungs: the whisper of the window's hue. */
export const greyRung = (l: number, lean: number | undefined): ILab =>
  leaning(l, GREY_SURFACE_CHROMA, lean);

/**
 * The light window's surfaces, the panes exactly `surface`, the rest
 * `dim` lighter units lower (0 for none: the Brightness's soft grey end
 * passes more).
 */
export const lightSurfaces = (
  surface: ILab,
  lean: number | undefined,
  dim = 0,
): Record<TWindowSurface, string> => {
  const grey = chromaOf(surface) < GREY_CHROMA;
  const out = {} as Record<TWindowSurface, string>;
  WINDOW_SURFACES.forEach((token) => {
    const step = LIGHT_LADDER[token];
    const l = clampL(surface.l + step - dim);
    out[token] = labToHex(
      step === 0 || !grey ? atL(surface, l) : greyRung(l, lean),
    );
  });
  return out;
};

/** The ink set a light window wears: deep inks leaning to its hue. */
export const darkInkSet = (lean: number | undefined): IInkSet => {
  const tier = (l: number) => labToHex(leaning(l, DARK_TEXT_CHROMA, lean));
  return {
    edge: labToHex(leaning(DARK_EDGE_LIGHTNESS, EDGE_CHROMA, lean)),
    ink: tier(DARK_INK_LIGHTNESS),
    text: {
      '--text-primary': tier(DARK_TEXT_LIGHTNESS['--text-primary']),
      '--text-muted': tier(DARK_TEXT_LIGHTNESS['--text-muted']),
      '--text-faint': tier(DARK_TEXT_LIGHTNESS['--text-faint']),
    },
    toward: 'black',
  };
};

/** A dark window's ink set: the theme's own, its edge leaning to its hue. */
const lightInkSet = (lean: number | undefined): IInkSet => {
  const edge = labOf(EDGE_TINT);
  return {
    ...LIGHT_INK,
    edge:
      edge && lean !== undefined
        ? labToHex(toward(edge, EDGE_CHROMA, lean, 1))
        : EDGE_TINT,
  };
};

export type TWindowToken =
  | TWindowSurface
  | (typeof WINDOW_EDGES)[number]
  | '--accent'
  | '--accent-light'
  | '--accent-dark'
  | '--accent-darker'
  | '--active'
  | (typeof WINDOW_LABELS)[number]
  | TInkToken;

export interface IWindow {
  ink: TWindowInk;
  tokens: Record<TWindowToken, string>;
}

/**
 * Every token the window wears on `surfaces`, with `accent` and `glow` worn
 * as filled controls wear a picked colour (`filledFace`: as picked wherever
 * a label reads on it, which on the white window may be its dark ink), the
 * label each one carries, and the ink the panes ask for. The menus become
 * the card's own colour here.
 */
export const windowOn = (
  surfaces: Record<TWindowSurface, string>,
  accentPicked: ILab,
  glowPicked: ILab,
  lean: number | undefined,
): IWindow => {
  const built = { ...surfaces };
  const card = cardHexOf(built['--surface-base'], built['--surface-panel']);
  CARD_COLOURED.forEach((token) => {
    built[token] = card;
  });
  const floor = built['--surface-base'];
  const pane = built['--surface-panel'];
  const ink = inkForSurface(pane);
  const isLight = ink === 'dark';
  const set = isLight ? darkInkSet(lean) : lightInkSet(lean);
  const ground = groundOf(floor, pane, set.toward);
  const groundHex = labToHex(rgbToLab(ground));

  const fillGround: IFillGround = { floor, pane, ink: set.ink, isLight };
  const accentFace = filledFace(accentPicked, fillGround);
  const activeFace = filledFace(glowPicked, fillGround);
  const accentHex = accentFace.fill;
  const accent = labOf(accentHex) ?? accentPicked;
  const accentLight = isLight
    ? clearOf(accent, groundHex, ACCENT_INK_CONTRAST, true)
    : labToHex(atL(accent, Math.max(accent.l, DARK_ACCENT_LIGHT_LIGHTNESS)));
  const edges = {} as Record<(typeof WINDOW_EDGES)[number], string>;
  const edge = parseCssColour(set.edge);
  WINDOW_EDGES.forEach((token) => {
    const [red, green, blue] = (edge?.rgb ?? [1, 1, 1]).map((channel) =>
      Math.round(channel * 255),
    );
    edges[token] = edgeOn(token, `rgb(${red}, ${green}, ${blue})`, ground);
  });
  return {
    ink,
    tokens: {
      ...built,
      ...edges,
      '--accent': accentHex,
      '--accent-light': accentLight,
      '--accent-dark': labToHex(atL(accent, accent.l - ACCENT_DARK_STEP)),
      '--accent-darker': labToHex(atL(accent, accent.l - ACCENT_DARKER_STEP)),
      '--active': activeFace.fill,
      '--on-accent': accentFace.label,
      '--on-active': activeFace.label,
      ...inkTokens(ground, accentLight, set),
    },
  };
};
