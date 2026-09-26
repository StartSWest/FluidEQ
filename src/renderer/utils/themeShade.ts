/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import {
  intoGamut,
  labToHex,
  parseCssColour,
  rgbToLab,
  toByte,
  type ILab,
} from './oklab';

/**
 * The theme as one slider from Black to a lighter Ocean (Ivan, 2026-09-25:
 * "we dont need light and dark theme since we now can have a slider … to
 * the left is like dark black as we have and to the right is the ocean that
 * we have but bit lighter").
 *
 * Every step is a set of surface colours, walked in OKLab so equal steps of
 * the thumb look like equal steps of light: Black at 0, Ocean as it shipped
 * at `OCEAN_SHADE`, and past it Ocean lifted by `LIGHT_LIFT`. Through
 * Ocean exactly, rather than straight from Black to the lighter end, so
 * somebody who had picked Ocean opens on the colours they chose and not on
 * a near miss of them.
 *
 * Black is declared here and nowhere else. Ocean is also the `:root` block in
 * `App.scss`, which is what the window paints before any script has run, and
 * `themeShade.test.ts` holds the two copies to each other.
 */

export const THEME_SHADE_MIN = 0;
export const THEME_SHADE_MAX = 100;

/**
 * Where Ocean as it shipped stands. Three quarters of the way, because the
 * lift past it is a third of Black-to-Ocean's lightness on the floor (0.045
 * of 0.115) and a quarter on the panes (of 0.171): there the thumb moves the
 * light about evenly from one end of the track to the other.
 */
export const OCEAN_SHADE = 75;

/** OKLab lightness Ocean's surfaces gain at the light end. */
const LIGHT_LIFT = 0.045;

const SURFACES = [
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

/** Everything the two themes declared differently. */
export const THEME_SHADE_TOKENS = [
  ...SURFACES,
  '--border-subtle',
  '--border-panel',
  '--border-menu',
  '--accent',
  '--accent-light',
  '--accent-dark',
  '--accent-darker',
] as const;

export type TThemeShadeToken = (typeof THEME_SHADE_TOKENS)[number];
type TThemeTable = Record<TThemeShadeToken, string>;

/**
 * Black: near-black, cool, and quiet — not a high-contrast theme.
 *
 * The first cut was white on true black with grey hairlines, and it read as
 * an accessibility mode: every edge shouting, every button a white slab. What
 * makes a dark theme feel expensive is the opposite — the surfaces are a few
 * values apart on a faintly cool near-black, the edges are barely there
 * (at the first cut's alphas they drew a wireframe over the window), and the
 * accent is a colour with some restraint in it rather than pure white.
 *
 * The accent is Ocean's cyan a little softer, so it sits on near-black
 * without glowing. Both themes' accents are the cyan at the middle of the
 * icon's Lagoon wave, between its aqua and its azure (Ivan, 2026-09-26: "i
 * wanna see app colors match more the icon"); they were a greener teal, the
 * wave's first colour only, and next to the icon every button read as a
 * different colour from it. The filled controls run the wave's own span
 * either side of the accent (`--accent-fill`, `App.scss`). The rainbow stays
 * — it is the music.
 */
export const BLACK_THEME: TThemeTable = {
  '--surface-base': '#050608',
  '--surface-panel': '#0c0e12',
  '--surface-block': '#12151a',
  '--surface-field': '#14181d',
  '--surface-field-end': '#0f1216',
  '--surface-menu': '#0e1116',
  '--surface-menu-top': '#13171c',
  '--surface-menu-face': '#171c23',
  '--surface-well': '#030405',
  '--track-well': '#222731',
  '--border-subtle': 'rgba(190, 205, 225, 0.06)',
  '--border-panel': 'rgba(190, 205, 225, 0.08)',
  '--border-menu': 'rgba(190, 205, 225, 0.14)',
  '--accent': '#4fe6ef',
  '--accent-light': '#b4f6fa',
  '--accent-dark': '#22ccdb',
  '--accent-darker': '#1a9bab',
};

export const OCEAN_THEME: TThemeTable = {
  '--surface-base': '#0d2030',
  '--surface-panel': '#1a3a4e',
  '--surface-block': '#1e4257',
  '--surface-field': '#1c3a4e',
  '--surface-field-end': '#173245',
  '--surface-menu': '#163244',
  '--surface-menu-top': '#1a3a52',
  '--surface-menu-face': '#1c4a5f',
  '--surface-well': '#0d2030',
  '--track-well': '#2e4f63',
  '--border-subtle': 'rgba(214, 233, 247, 0.09)',
  '--border-panel': 'rgba(214, 233, 247, 0.11)',
  '--border-menu': 'rgba(156, 250, 255, 0.22)',
  '--accent': '#1bdee7',
  '--accent-light': '#a1fcff',
  '--accent-dark': '#00a9d6',
  '--accent-darker': '#007f95',
};

/**
 * Smart EQ's coverage columns on Black: grey, not the accent. They stand at
 * 6-20% opacity over the whole plot, and in the accent they were a green wash
 * behind a green curve that the two fought over; a cool mid grey reads as
 * shading on the floor and leaves the accent to what is chosen or live. From
 * Ocean up they are the accent, by reference, so a Plus scene lending the
 * window its accent recolours them with it (`App.scss`).
 */
const BLACK_COVERAGE = '#7a8594';

interface IStop {
  lab: ILab;
  alpha: number;
}

const stopOf = (text: string): IStop => {
  const parsed = parseCssColour(text);
  if (!parsed) {
    throw new Error(`Not a theme colour: ${text}`);
  }
  return { lab: rgbToLab(parsed.rgb), alpha: parsed.alpha };
};

const isSurface = (token: TThemeShadeToken) =>
  (SURFACES as readonly string[]).includes(token);

/** Each token at Black, at Ocean, and at the light end. */
const ENDS = THEME_SHADE_TOKENS.map((token) => {
  const ocean = stopOf(OCEAN_THEME[token]);
  return {
    token,
    black: stopOf(BLACK_THEME[token]),
    ocean,
    light: isSurface(token)
      ? { ...ocean, lab: { ...ocean.lab, l: ocean.lab.l + LIGHT_LIFT } }
      : ocean,
  };
});

const between = (from: IStop, to: IStop, amount: number): IStop => ({
  lab: {
    l: from.lab.l + (to.lab.l - from.lab.l) * amount,
    a: from.lab.a + (to.lab.a - from.lab.a) * amount,
    b: from.lab.b + (to.lab.b - from.lab.b) * amount,
  },
  alpha: from.alpha + (to.alpha - from.alpha) * amount,
});

// Opaque as a hex, like the stylesheet writes them and like the drawings
// that read a surface back (`readSurfaceAlpha`) expect; an edge as `rgba`.
const format = ({ lab, alpha }: IStop) => {
  if (alpha >= 1) {
    return labToHex(lab);
  }
  const [red, green, blue] = intoGamut(lab).map(toByte);
  return `rgba(${red}, ${green}, ${blue}, ${Number(alpha.toFixed(3))})`;
};

export const clampThemeShade = (shade: number) =>
  Number.isFinite(shade)
    ? Math.min(THEME_SHADE_MAX, Math.max(THEME_SHADE_MIN, Math.round(shade)))
    : THEME_SHADE_MIN;

/** Every token the themes differ in, as the slider at `shade` paints it. */
export const themeShadeTokens = (shade: number): TThemeTable => {
  const at = clampThemeShade(shade);
  return Object.fromEntries(
    ENDS.map(({ token, black, ocean, light }) => [
      token,
      format(
        at <= OCEAN_SHADE
          ? between(black, ocean, at / OCEAN_SHADE)
          : between(
              ocean,
              light,
              (at - OCEAN_SHADE) / (THEME_SHADE_MAX - OCEAN_SHADE),
            ),
      ),
    ]),
  ) as TThemeTable;
};

/**
 * The rule the window wears: every token on `:root`, at a weight the
 * stylesheet's own `:root` block cannot outrank whichever loads last. A
 * scene's tint still does — it writes the root's inline style — and reads
 * these back as the theme it tones.
 */
export const themeShadeRule = (shade: number) => {
  const tokens = themeShadeTokens(shade);
  const declarations = THEME_SHADE_TOKENS.map(
    (token) => `${token}: ${tokens[token]};`,
  ).join(' ');
  const accentShare = Math.round(
    (Math.min(clampThemeShade(shade), OCEAN_SHADE) / OCEAN_SHADE) * 100,
  );
  return `:root:root:root { ${declarations} --coverage-band: color-mix(in oklab, ${BLACK_COVERAGE}, var(--accent) ${accentShare}%); }`;
};

/** The slider's track: the panes from one end to the other, through Ocean. */
export const THEME_SHADE_TRACK = `linear-gradient(in oklab 90deg, ${
  themeShadeTokens(THEME_SHADE_MIN)['--surface-panel']
}, ${themeShadeTokens(OCEAN_SHADE)['--surface-panel']} ${OCEAN_SHADE}%, ${
  themeShadeTokens(THEME_SHADE_MAX)['--surface-panel']
})`;
