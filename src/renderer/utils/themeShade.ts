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
import { EDGE_CONTRAST, cardOf, edgeOn, inkTokens } from './themeInk';

/**
 * The theme as one slider from Black to a lighter Ocean (Ivan, 2026-09-25:
 * "we dont need light and dark theme since we now can have a slider … to
 * the left is like dark black as we have and to the right is the ocean that
 * we have but bit lighter").
 *
 * Every step is a set of surface colours, walked in OKLab so equal steps of
 * the thumb look like equal steps of light within each stretch: Black at 0,
 * Ocean as it shipped at `OCEAN_SHADE`, and past it Ocean lifted by
 * `LIGHT_LIFT`, the last quarter the steeper since it took over the lift a
 * visualizer's colours had of their own. Through
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
 * Where Ocean as it shipped stands: three quarters of the way, so somebody
 * who had picked Ocean opens on it and the last quarter lightens past it.
 */
export const OCEAN_SHADE = 75;

/**
 * OKLab lightness Ocean's surfaces gain at the light end: 0.045 of the
 * theme's own and the 0.1 a visualizer's colours used to add on top of it
 * there. At 100% Colours stood that much lighter than the theme, and the
 * theme — Original — read as the dark one of the two at the same Brightness
 * (Ivan, 2026-09-26: "original needs to light a bit more to match colores
 * just the brightness internally not the slider"). The colours now follow
 * this scale exactly (`sceneTintStore.ts`), so the two agree at every step.
 */
const LIGHT_LIFT = 0.145;

/**
 * The lightest a surface is lifted to: 0.52 in OKLab, where the app's body
 * text still stands on it at about 5:1. The text stays light whatever the
 * Brightness, so a surface lifted past this would be a pale ground for pale
 * words; one already above it keeps its own.
 */
const LIGHT_CEILING = 0.52;

const lightEnd = (lightness: number) =>
  lightness >= LIGHT_CEILING
    ? lightness
    : Math.min(LIGHT_CEILING, lightness + LIGHT_LIFT);

/**
 * The most colour a lifted surface takes, in OKLab chroma: about where a
 * visualizer's colours stop (`MAX_SURFACE_CHROMA`, 0.07), a touch past it
 * for the block and the menus' faces.
 */
const LIGHT_MAX_CHROMA = 0.08;

/**
 * A surface at the light end: lifted, and as colourful for its lightness as
 * Ocean is. Lifted alone, its chroma stayed Ocean's 0.04-0.055 while its
 * lightness rose by half again, and the window at 100% read as a blue-grey
 * with no colour in it (Ivan, 2026-09-26: "the light original is too not
 * colored"). Ocean's own share of colour to light is kept, which is what
 * makes a lighter Ocean still Ocean — about 0.065 on the floor and 0.075
 * on the panes, level with Colours at the same Brightness.
 */
const liftedTo = (ocean: ILab, l: number): ILab => {
  const chroma = Math.hypot(ocean.a, ocean.b);
  if (chroma === 0 || ocean.l <= 0) {
    return { ...ocean, l };
  }
  const scale = Math.max(1, Math.min(l / ocean.l, LIGHT_MAX_CHROMA / chroma));
  return { l, a: ocean.a * scale, b: ocean.b * scale };
};

const lightSurface = (ocean: ILab): ILab => liftedTo(ocean, lightEnd(ocean.l));

/**
 * How far the floor stands under the panes at the light end, in OKLab
 * lightness: Black's own step, #050608 under #0c0e12 (0.041).
 *
 * Lifted by the panes' own amount the floor kept Ocean's gap to them, 0.1,
 * and the window at 100% was a dark navy with lit panes on it (Ivan,
 * 2026-09-27: "the whole app should be lighter almost matching the pane …
 * when brightness is 100 keep pane color as it is and make app more bright
 * too", "so they are close but still separated visually"). So the light end
 * takes the floor to just under the panes' light end instead, with the panes
 * where they were; from Ocean up the step closes gradually, and Ocean and
 * everything under it are as they shipped.
 */
const LIGHT_FLOOR_STEP = 0.04;

/**
 * The floor alone. The wells stay where the lift puts them, under the new
 * floor: a fader's slot, a knob's well and a meter's recess sit in cards,
 * and taken up with the floor they stood 0.035 under the cards instead of
 * 0.1 and read as faded ("some colors look faded in the sliders and lines").
 * A well darker than the floor is what Black has too (#030405 on #050608).
 */
const FLOORS: readonly string[] = ['--surface-base'];

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
  // The edges as painted: each one's colour here, at the opacity that reaches
  // its contrast on this shade's card (`themeInk.ts`). They were 0.06, 0.08
  // and 0.14 — the "barely there" of the paragraph above, 1.1:1, which Ivan
  // called lines he hated against the background (2026-09-27).
  '--border-subtle': 'rgba(190, 205, 225, 0.166)',
  '--border-panel': 'rgba(190, 205, 225, 0.225)',
  '--border-menu': 'rgba(190, 205, 225, 0.306)',
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
  // As painted, like Black's (`themeInk.ts`); they shipped at 0.09, 0.11, 0.22.
  '--border-subtle': 'rgba(214, 233, 247, 0.124)',
  '--border-panel': 'rgba(214, 233, 247, 0.183)',
  '--border-menu': 'rgba(156, 250, 255, 0.262)',
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

/** Where the floor ends up at the light end: one step under the panes. */
const LIGHT_FLOOR =
  lightEnd(stopOf(OCEAN_THEME['--surface-panel']).lab.l) - LIGHT_FLOOR_STEP;

const lightStop = (token: TThemeShadeToken, ocean: IStop): IStop => {
  if (FLOORS.includes(token)) {
    return { ...ocean, lab: liftedTo(ocean.lab, LIGHT_FLOOR) };
  }
  return isSurface(token) ? { ...ocean, lab: lightSurface(ocean.lab) } : ocean;
};

/** Each token at Black, at Ocean, and at the light end. */
const ENDS = THEME_SHADE_TOKENS.map((token) => {
  const ocean = stopOf(OCEAN_THEME[token]);
  return {
    token,
    black: stopOf(BLACK_THEME[token]),
    ocean,
    light: lightStop(token, ocean),
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

/**
 * Every token the themes differ in, as the slider at `shade` paints it. The
 * edges keep the colour their stops walk through and take the opacity that
 * reaches their contrast on this shade's card (`themeInk.ts`).
 */
export const themeShadeTokens = (shade: number): TThemeTable => {
  const at = clampThemeShade(shade);
  const table = Object.fromEntries(
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
  const card = cardOf(table['--surface-base'], table['--surface-panel']);
  (Object.keys(EDGE_CONTRAST) as (keyof typeof EDGE_CONTRAST)[]).forEach(
    (token) => {
      table[token] = edgeOn(token, table[token], card);
    },
  );
  return table;
};

/** The inks at `shade` that are not surfaces or edges: text, disabled, fields. */
export const themeInkTokens = (shade: number) => {
  const table = themeShadeTokens(shade);
  return inkTokens(
    cardOf(table['--surface-base'], table['--surface-panel']),
    table['--accent-light'],
  );
};

/**
 * The rule the window wears: every token on `:root`, at a weight the
 * stylesheet's own `:root` block cannot outrank whichever loads last. A
 * scene's tint still does — it writes the root's inline style — and reads
 * these back as the theme it tones.
 */
export const themeShadeRule = (shade: number) => {
  const tokens = themeShadeTokens(shade);
  const inks = themeInkTokens(shade);
  const declarations = [
    ...THEME_SHADE_TOKENS.map((token) => `${token}: ${tokens[token]};`),
    ...Object.entries(inks).map(([token, value]) => `${token}: ${value};`),
  ].join(' ');
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
