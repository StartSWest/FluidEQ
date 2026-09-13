/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import {
  contrast,
  GAMUT_EPSILON,
  intoGamut,
  labToHex,
  luminance,
  parseCssColour,
  rgbToLab,
  toByte,
  toGamma,
  toLinear,
  toward,
  type ILab,
  clamp01,
} from './oklab';
import type { ISceneSky } from './sceneTint';

/**
 * The theme toned in a scene's colours (`sceneTint.ts` finds them): which
 * tokens, and what each becomes.
 */

/** The surfaces a theme declares on `:root` that the sky recolours. */
export const SCENE_TINT_SURFACES = [
  '--surface-base',
  '--surface-panel',
  '--surface-block',
  '--surface-field',
  '--surface-field-end',
  '--surface-menu',
  '--surface-menu-top',
  '--surface-menu-face',
  '--surface-well',
  '--track-well',
] as const;

/** The edges, which are a light colour at a whisper of alpha. */
export const SCENE_TINT_EDGES = [
  '--border-subtle',
  '--border-panel',
  '--border-menu',
] as const;

/**
 * The accent in its four strengths: the filled button, its hover and the
 * kickers, its pressed state, and the deepest one. Everything the app draws
 * in the accent — stylesheets through `$secondary-*`, drawings through
 * `readAccent` — reads these.
 */
export const SCENE_TINT_ACCENTS = [
  '--accent',
  '--accent-light',
  '--accent-dark',
  '--accent-darker',
] as const;

/**
 * What says a thing is on — the attached profile, the live output, a project
 * that saves as it goes — a lime of its own in the theme. Only that: the
 * rainbow the music is drawn in, and red and amber, which mean off and wait,
 * keep their colours whatever is playing.
 */
export const SCENE_TINT_STATES = ['--active'] as const;

export const SCENE_TINT_TOKENS = [
  ...SCENE_TINT_SURFACES,
  ...SCENE_TINT_EDGES,
  ...SCENE_TINT_ACCENTS,
  ...SCENE_TINT_STATES,
] as const;

export type TSceneTintToken = (typeof SCENE_TINT_TOKENS)[number];
export type TSceneTintPalette = Partial<Record<TSceneTintToken, string>>;

// *** The theme in the sky's colour *******************************************

/**
 * How much chroma a surface is given per unit of its own lightness.
 *
 * Proportional to lightness because a dark colour holds less colour before it
 * stops reading as dark. Chosen on the window, beside Neon City's own sky, in
 * the black theme: at 0.24 the panes read as a grey with a violet cast, a
 * different colour from the picture they frame; at 0.44 they read as the same
 * night the skyline stands in. 0.4 keeps that and stops short of the panes
 * competing with the scene for attention.
 */
const SURFACE_CHROMA_PER_LIGHTNESS = 0.4;
/**
 * The ceiling on that, for the lighter rungs. The ocean theme's panes stand
 * around 0.33, where the proportion above would give a violet as saturated
 * as a button, and the track wells higher still; past this a surface stops
 * being something to stand on and becomes something to look at.
 */
const MAX_SURFACE_CHROMA = 0.07;
/**
 * The edges' chroma. They are drawn at six to twenty-two percent alpha, so
 * this is what keeps them from reading as grey wire on a coloured pane and no
 * more.
 */
const EDGE_CHROMA = 0.06;
/**
 * A sky covering this much of the frame, at this chroma, recolours the theme
 * completely; less of either leaves some of the theme's own tone showing, so a
 * faint or patchy colour tints the window faintly instead of repainting it.
 */
const FULL_SKY_SHARE = 0.4;
const FULL_SKY_CHROMA = 0.08;

/** How far the theme moves toward the sky's colour, 0 to 1. */
export const sceneTintStrength = (sky: ISceneSky) =>
  clamp01(sky.share / FULL_SKY_SHARE) * clamp01(sky.chroma / FULL_SKY_CHROMA);

const formatAlpha = (alpha: number) => String(Math.round(alpha * 1000) / 1000);

/**
 * A scene in one colour lends that colour to its accent only once it tints
 * the window at least this strongly. Below it the panes are still mostly the
 * theme's and the theme's accent still belongs on them; above it they are
 * plainly the scene's colour, and Eclipse at 0.32 — brown panes round cyan
 * buttons — was the clash this exists to prevent.
 */
const MIN_SKY_ACCENT_STRENGTH = 0.25;

/**
 * The least contrast a filled button's label keeps against its fill. The
 * label is the theme's darkest surface; seven to one is the stricter of the
 * two WCAG levels, and the theme's own accents sit well above it.
 */
const MIN_LABEL_CONTRAST = 7;
/** How finely the accent's lightness is walked down, in OKLab lightness. */
const ACCENT_LIGHTNESS_STEP = 0.005;

/** A colour at `lightness`, `chroma` and `hue`, as the screen can show it. */
const accentAt = (lightness: number, chroma: number, hue: number) =>
  intoGamut(toward({ l: lightness, a: 0, b: 0 }, chroma, hue, 1));

/**
 * How far below the theme's accent lightness `hue` has to sit to keep the
 * theme's chroma.
 *
 * The theme's accents are light cyans, and cyan is the one hue the screen can
 * show that vividly at that lightness. Turned to pink, orange or violet at the
 * same lightness the gamut leaves half the colour behind, and the buttons came
 * out peach, baby pink and lilac beside scenes that are anything but pastel.
 * So the accent gives up lightness until it holds its chroma — stopping where
 * its label would drop below `MIN_LABEL_CONTRAST`, whichever comes first.
 */
const accentLightnessShift = (
  accent: ILab,
  label: number,
  hue: number,
): number => {
  const chroma = Math.hypot(accent.a, accent.b);
  let shift = 0;
  for (
    let next = 0;
    accent.l - next > ACCENT_LIGHTNESS_STEP;
    next += ACCENT_LIGHTNESS_STEP
  ) {
    const colour = accentAt(accent.l - next, chroma, hue);
    if (contrast(luminance(colour), label) < MIN_LABEL_CONTRAST) {
      return shift;
    }
    shift = next;
    const shown = rgbToLab(colour.map((channel) => toGamma(clamp01(channel))));
    if (Math.hypot(shown.a, shown.b) >= chroma - GAMUT_EPSILON * 10) {
      return shift;
    }
  }
  return shift;
};

/**
 * The hue the accent takes under `sky`: the scene's second colour, else the
 * sky's own for a scene strong in one colour, else undefined for the theme's
 * accent as it is.
 *
 * Never a hue part-way between the theme's accent and the scene's. Between
 * cyan and pink lie blue and violet, and a button in a colour neither the
 * theme nor the picture has would be worse than either.
 */
export const sceneAccentHue = (sky: ISceneSky): number | undefined => {
  if (sky.accent) {
    return sky.accent.hue;
  }
  return sceneTintStrength(sky) >= MIN_SKY_ACCENT_STRENGTH
    ? sky.hue
    : undefined;
};

/**
 * How far "on" may give up lightness to keep its colour. The buttons may go
 * deeper; a pill or a dot that says something is on has to look lit, and at
 * the buttons' depth a violet "ACT" read as a switch turned off.
 */
const MAX_ACTIVE_LIGHTNESS_SHIFT = 0.1;
/**
 * "On" in a scene with no colour fit for it — a fire, a desert, an eclipse,
 * all red and amber: a pale light of the sky's own hue, which looks lit
 * without saying "off" or "wait" beside the pills that do.
 */
const PALE_ACTIVE_LIGHTNESS = 0.92;
const PALE_ACTIVE_CHROMA = 0.045;

/**
 * `base`'s filled colour turned to `hue`: its own chroma, and only as much
 * less lightness — never more than `maxShift` — as it needs to keep that
 * chroma on this screen without its dark label dropping below
 * `MIN_LABEL_CONTRAST`.
 */
const turnFilled = (
  base: ILab,
  label: number,
  hue: number,
  maxShift = Number.POSITIVE_INFINITY,
) => {
  const shift = Math.min(maxShift, accentLightnessShift(base, label, hue));
  return {
    shift,
    hex: labToHex(
      toward(
        { l: Math.max(0, base.l - shift), a: 0, b: 0 },
        Math.hypot(base.a, base.b),
        hue,
        1,
      ),
    ),
  };
};

/**
 * What "on" looks like under `sky`, or undefined wherever the buttons keep
 * the theme's accent — lime stays beside cyan. The scene's colour for "on"
 * when it has one (`findSceneSky`), turned from the theme's lime; a pale
 * light of its sky when it has none.
 */
const activeUnder = (
  sky: ISceneSky,
  base: ILab,
  label: number,
): string | undefined => {
  if (sceneAccentHue(sky) === undefined) {
    return undefined;
  }
  if (sky.active) {
    return turnFilled(base, label, sky.active.hue, MAX_ACTIVE_LIGHTNESS_SHIFT)
      .hex;
  }
  return labToHex(
    toward(
      { l: PALE_ACTIVE_LIGHTNESS, a: 0, b: 0 },
      PALE_ACTIVE_CHROMA,
      sky.hue,
      1,
    ),
  );
};

/**
 * The theme's tokens, `base`, as they look under `sky`: the same lightness,
 * the sky's hue for what things stand on and the scene's accent hue for what
 * is pressed and chosen. Tokens missing from `base` or written in a form
 * `parseCssColour` cannot read are left out, so the theme's own value stays.
 *
 * Surfaces and accents come back as `#rrggbb`, because the drawings read them
 * with a six-digit pattern; edges as `rgba()` with the alpha they had.
 */
export const tintThemePalette = (
  base: Readonly<Record<string, string>>,
  sky: ISceneSky,
): TSceneTintPalette => {
  const amount = sceneTintStrength(sky);
  const palette: TSceneTintPalette = {};
  SCENE_TINT_SURFACES.forEach((token) => {
    const colour = parseCssColour(base[token] ?? '');
    if (colour) {
      const lab = rgbToLab(colour.rgb);
      const chroma = Math.min(
        MAX_SURFACE_CHROMA,
        SURFACE_CHROMA_PER_LIGHTNESS * lab.l,
      );
      palette[token] = labToHex(toward(lab, chroma, sky.hue, amount));
    }
  });
  SCENE_TINT_EDGES.forEach((token) => {
    const colour = parseCssColour(base[token] ?? '');
    if (colour) {
      const tinted = intoGamut(
        toward(rgbToLab(colour.rgb), EDGE_CHROMA, sky.hue, amount),
      ).map(toByte);
      palette[token] = `rgba(${tinted.join(', ')}, ${formatAlpha(
        colour.alpha,
      )})`;
    }
  });
  const accentHue = sceneAccentHue(sky);
  const accent = parseCssColour(base['--accent'] ?? '');
  const label = parseCssColour(base['--surface-base'] ?? '');
  const labelLuminance = label ? luminance(label.rgb.map(toLinear)) : undefined;
  const active = parseCssColour(base['--active'] ?? '');
  const activeColour =
    active && labelLuminance !== undefined
      ? activeUnder(sky, rgbToLab(active.rgb), labelLuminance)
      : undefined;
  if (activeColour) {
    palette['--active'] = activeColour;
  }
  if (accentHue !== undefined && accent && labelLuminance !== undefined) {
    const { shift } = turnFilled(
      rgbToLab(accent.rgb),
      labelLuminance,
      accentHue,
    );
    SCENE_TINT_ACCENTS.forEach((token) => {
      const colour = parseCssColour(base[token] ?? '');
      if (colour) {
        const lab = rgbToLab(colour.rgb);
        // Every strength moves down together so pressed stays darker than
        // rest; the light one is the hover and the kickers, which are meant
        // to be pale, and moving it would only take them toward the others.
        const lightness =
          token === '--accent-light' ? lab.l : Math.max(0, lab.l - shift);
        palette[token] = labToHex(
          toward(
            { l: lightness, a: 0, b: 0 },
            Math.hypot(lab.a, lab.b),
            accentHue,
            1,
          ),
        );
      }
    });
  }
  return palette;
};

/**
 * The darkest the backdrop behind a loading scene may be lit, and the most
 * colour it may carry. The sky as measured is the scene's busiest colour, and
 * for a scene like Floración that is a mid-tone: waiting on it read as a pale
 * grey card where a dark scene was about to appear. What a scene draws against
 * is dark, so the backdrop keeps the sky's hue at a scene's darkness.
 */
const BACKDROP_LIGHTNESS = 0.14;
const BACKDROP_CHROMA = 0.03;

/** The colour a scene waits on: its sky's hue, as dark as a scene's ground. */
export const sceneSkyColour = (sky: ISceneSky) =>
  labToHex(
    toward(
      { l: Math.min(sky.lightness, BACKDROP_LIGHTNESS), a: 0, b: 0 },
      Math.min(sky.chroma, BACKDROP_CHROMA),
      sky.hue,
      1,
    ),
  );

/** Lightness and chroma of the toggle's swatch: bright enough to see on a pane. */
const SWATCH_LIGHTNESS = 0.78;
const SWATCH_CHROMA = 0.13;

/**
 * The sky as a colour a small glyph can show: its hue, lifted to a lightness
 * that reads on a dark pane. The sky itself is usually too dark to see at the
 * size of an icon — which is the reason it makes a good surface.
 */
export const sceneTintSwatch = (sky: ISceneSky) =>
  labToHex(
    toward({ l: SWATCH_LIGHTNESS, a: 0, b: 0 }, SWATCH_CHROMA, sky.hue, 1),
  );
