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
import {
  EDGE_CONTRAST,
  INK_TOKENS,
  cardHexOf,
  edgeOn,
  groundOf,
  inkTokens,
  type TInkToken,
} from './themeInk';
import {
  hueOf,
  labOf,
  lightSurfaces,
  windowOn,
  type IWindow,
} from './windowLight';
import { WINDOW_SURFACES } from './windowTokens';

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
 * Black is declared here and nowhere else. Ocean is also the shipped theme
 * App.scss puts on `:root` (`_shippedTheme.scss`), which is what the window
 * paints before any script has run, and
 * `themeShade.test.ts` holds the two copies to each other.
 */

export const THEME_SHADE_MIN = 0;
export const THEME_SHADE_MAX = 100;

/**
 * FROM FULLY DARK TO FULLY WHITE (Ivan, 2026-11-17: "if user set brightness
 * to 100% it turns it white", "so just grow the scale from 0 full dark to
 * 100 fully white").
 *
 * The slider used to end at a lifted Ocean, still a dark window with light
 * words. It now runs on into a light window with dark words: up to
 * `DARK_END_SHADE` it is the dark walk it always was, squeezed into that
 * stretch, and past it a light window from a soft grey to white panes
 * (`windowLight.ts`).
 *
 * The two stretches meet with a step, on purpose. Between a lifted Ocean
 * (surfaces near OKLab 0.5) and a soft grey (0.83) lie the mid-greys, where
 * neither white nor black words reach the contrast the text tiers are held
 * to - at the crossover neither gets past 4.6:1, short of the 7:1 the body
 * text keeps on every shade. Walking through them would make every word in
 * the window hard to read for a stretch of the slider; jumping them keeps
 * every step readable.
 *
 * A stored Brightness from before the light stretch is moved onto the dark
 * stretch once (`theme.ts`), so nobody's window turns light on the update.
 */
export const DARK_END_SHADE = 76;

/**
 * The dark walk's own scale, 0 to 100, which every constant below it was
 * tuned on (Black at 0, Ocean at 75, the lifted end at 100).
 */
const DARK_MAX = 100;
const DARK_OCEAN = 75;

/** Where `shade` stands on the dark walk's own scale. */
export const darkStepOf = (shade: number) =>
  (Math.min(shade, DARK_END_SHADE) / DARK_END_SHADE) * DARK_MAX;

/** A slider position for a place on the dark walk's own scale. */
export const shadeOfDarkStep = (step: number) =>
  Math.round((step / DARK_MAX) * DARK_END_SHADE);

/** Whether `shade` is on the light stretch: dark words on light surfaces. */
export const isLightShade = (shade: number) =>
  clampThemeShade(shade) > DARK_END_SHADE;

/**
 * Where Ocean as it shipped stands: three quarters of the dark walk, so
 * somebody who had picked Ocean opens on it.
 */
export const OCEAN_SHADE = shadeOfDarkStep(DARK_OCEAN);

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
 * How far the panes stand over the floor, in OKLab lightness, at the light
 * end: a touch more than Black's 0.041 (Ivan, 2026-09-27, at 100%: "add bit
 * more contrast just a bit").
 *
 * Lifted by the panes' own amount the floor kept Ocean's gap to them, 0.1,
 * and the window at 100% was a dark navy with lit panes on it ("the whole app
 * should be lighter almost matching the pane … when brightness is 100 keep
 * pane color as it is and make app more bright too", "so they are close but
 * still separated visually"). So the light end takes the floor to this step
 * under the panes' light end, with the panes where they were.
 */
const LIGHT_PANE_STEP = 0.052;

/**
 * The floor alone. The wells stay where the lift puts them, under the new
 * floor: a fader's slot, a knob's well and a meter's recess sit in cards,
 * and taken up with the floor they stood 0.035 under the cards instead of
 * 0.1 and read as faded ("some colors look faded in the sliders and lines").
 * A well darker than the floor is what Black has too (#030405 on #050608).
 */
const FLOORS: readonly string[] = ['--surface-base'];

const SURFACES = WINDOW_SURFACES;

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
  // its contrast on this shade's lightest ground (`themeInk.ts`). They were
  // 0.06, 0.08 and 0.14 — the "barely there" of the paragraph above, 1.1:1,
  // which Ivan called lines he hated against the background (2026-09-27).
  '--border-subtle': 'rgba(190, 205, 225, 0.253)',
  '--border-panel': 'rgba(190, 205, 225, 0.288)',
  '--border-menu': 'rgba(190, 205, 225, 0.363)',
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
  '--border-subtle': 'rgba(214, 233, 247, 0.218)',
  '--border-panel': 'rgba(214, 233, 247, 0.258)',
  '--border-menu': 'rgba(156, 250, 255, 0.333)',
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
  lightEnd(stopOf(OCEAN_THEME['--surface-panel']).lab.l) - LIGHT_PANE_STEP;

/**
 * The panes and what stands on them at their level — a block, a field, a
 * menu — which keep their places relative to one another when the panes
 * move. Not the floor, and not the wells and tracks, which are recesses
 * measured from the cards and read as faded when they came up with them.
 */
const PANES: readonly TThemeShadeToken[] = [
  '--surface-panel',
  '--surface-block',
  '--surface-field',
  '--surface-field-end',
  '--surface-menu',
  '--surface-menu-top',
  '--surface-menu-face',
];

/**
 * How far the panes stand over the floor at Black: #0c0e12 over #050608,
 * 0.041 in OKLab lightness, which is right there (Ivan, 2026-09-27: "on 0
 * right now is perfect").
 */
const PANE_STEP =
  stopOf(BLACK_THEME['--surface-panel']).lab.l -
  stopOf(BLACK_THEME['--surface-base']).lab.l;

/**
 * The panes' step over the floor at `shade`: Black's all the way to the
 * middle of the slider, then opening a little toward the light end's.
 *
 * Walked between Black and Ocean as they shipped, it grew with the panes'
 * own lightness — 0.079 at 50%, 0.098 at Ocean — and the cards stood on the
 * floor as lit slabs (Ivan, 2026-09-27, at 50%: "make pane darker so the
 * difference is less by half, and fix so it adapts toward the 100% and the
 * 0%, still somehow visible the difference and not the border only"). One
 * step everywhere is half of it at 50% and keeps every card a face, not an
 * edge, at both ends.
 */
const paneStepAt = (shade: number) =>
  PANE_STEP +
  (LIGHT_PANE_STEP - PANE_STEP) *
    Math.min(1, Math.max(0, (shade - DARK_MAX / 2) / (DARK_MAX / 2)));

/** Taken to the card's own colour (`themeShadeTokens`). */
const CARD_COLOURED: readonly TThemeShadeToken[] = [
  '--surface-menu',
  '--surface-menu-top',
  '--surface-menu-face',
];

/** `lab` at lightness `l`, as colourful for its lightness as it was. */
const atLightness = (lab: ILab, l: number): ILab => {
  if (lab.l <= 0) {
    return { ...lab, l };
  }
  const scale = l / lab.l;
  return { l, a: lab.a * scale, b: lab.b * scale };
};

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
 * How much of the way from Ocean to the light end (`lightStop`) the slider's
 * last quarter walks: three fifths, so 100 is what 90 was and every step
 * past Ocean is scaled with it (Ivan, 2026-09-27: "lower the brightness,
 * instead of 100% what represents 90%, but make it 100%, so the max
 * brightness reduces a bit"). The light end itself is kept as it was built,
 * so its surfaces, their colour and the panes' step keep their proportions;
 * the slider just stops short of it.
 */
const LIGHT_REACH = 0.6;

/** Where `shade` stands on the scale the light end was built for. */
const onLightScale = (shade: number) =>
  shade <= DARK_OCEAN ? shade : DARK_OCEAN + (shade - DARK_OCEAN) * LIGHT_REACH;

/**
 * The light stretch's soft grey end: its panes this much OKLab lightness
 * under white at the first step past `DARK_END_SHADE`, white at 100.
 */
const LIGHT_WINDOW_DIM = 0.12;

/** The green the theme says "on" in (`$analogous-2`, `_shippedTheme.scss`). */
export const THEME_ACTIVE = '#54ff8a';

let lightWindows: Map<number, IWindow> | undefined;

/**
 * The light stretch at `shade`: white panes on a soft floor leaning to
 * Ocean's cyan, Ocean's accent and the theme's green moved only as far as
 * their labels need (`windowOn`). Each shade once, since the slider and every
 * tinted repaint ask for the same few again and again.
 */
export const lightWindowOf = (shade: number): IWindow | undefined => {
  const at = clampThemeShade(shade);
  if (at <= DARK_END_SHADE) {
    return undefined;
  }
  lightWindows ??= new Map();
  const known = lightWindows.get(at);
  if (known) {
    return known;
  }
  const accent = labOf(OCEAN_THEME['--accent']);
  const glow = labOf(THEME_ACTIVE);
  if (!accent || !glow) {
    return undefined;
  }
  const lean = hueOf(accent);
  const along =
    (at - DARK_END_SHADE - 1) / (THEME_SHADE_MAX - DARK_END_SHADE - 1);
  const surfaces = lightSurfaces(
    { l: 1, a: 0, b: 0 },
    lean,
    LIGHT_WINDOW_DIM * (1 - along),
  );
  const built = windowOn(surfaces, accent, glow, lean);
  lightWindows.set(at, built);
  return built;
};

/**
 * The colour the theme says "on" in at `shade`: its green, a light on a dark
 * window, and on the light stretch moved until its label reads on it, like
 * the accent.
 */
export const themeActiveOf = (shade: number): string =>
  lightWindowOf(shade)?.tokens['--active'] ?? THEME_ACTIVE;

/**
 * Every token the themes differ in, as the slider at `shade` paints it. The
 * edges keep the colour their stops walk through and take the opacity that
 * reaches their contrast on this shade's card (`themeInk.ts`).
 */
export const themeShadeTokens = (shade: number): TThemeTable => {
  const light = lightWindowOf(shade);
  if (light) {
    return Object.fromEntries(
      THEME_SHADE_TOKENS.map((token) => [token, light.tokens[token]]),
    ) as TThemeTable;
  }
  const at = onLightScale(darkStepOf(clampThemeShade(shade)));
  const table = Object.fromEntries(
    ENDS.map(({ token, black, ocean, light }) => [
      token,
      format(
        at <= DARK_OCEAN
          ? between(black, ocean, at / DARK_OCEAN)
          : between(ocean, light, (at - DARK_OCEAN) / (DARK_MAX - DARK_OCEAN)),
      ),
    ]),
  ) as TThemeTable;
  // The panes a step over the floor (`paneStepAt`), taking what stands at
  // their level with them.
  const floor = stopOf(table['--surface-base']).lab;
  const lift =
    floor.l + paneStepAt(at) - stopOf(table['--surface-panel']).lab.l;
  PANES.forEach((token) => {
    const { lab } = stopOf(table[token]);
    table[token] = labToHex(atLightness(lab, lab.l + lift));
  });
  // Three backgrounds and no fourth: the floor, the card and the graph (Ivan,
  // 2026-09-27: "we only have 3 bg color, app color, card bg and graph
  // colors"). What floats or sticks over a card — a menu, its head, a picker's
  // open face — is the card's own colour as it stands on the floor, where each
  // was a navy of its own a step off it.
  const card = cardHexOf(table['--surface-base'], table['--surface-panel']);
  CARD_COLOURED.forEach((token) => {
    table[token] = card;
  });
  const ground = groundOf(table['--surface-base'], table['--surface-panel']);
  (Object.keys(EDGE_CONTRAST) as (keyof typeof EDGE_CONTRAST)[]).forEach(
    (token) => {
      table[token] = edgeOn(token, table[token], ground);
    },
  );
  return table;
};

/** The inks at `shade` that are not surfaces or edges: text, disabled, fields. */
export const themeInkTokens = (shade: number): Record<TInkToken, string> => {
  const light = lightWindowOf(shade);
  if (light) {
    return Object.fromEntries(
      INK_TOKENS.map((token) => [token, light.tokens[token]]),
    ) as Record<TInkToken, string>;
  }
  const table = themeShadeTokens(shade);
  return inkTokens(
    groundOf(table['--surface-base'], table['--surface-panel']),
    table['--accent-light'],
  );
};

/**
 * The rule the window wears: every token on `:root`, at a weight the
 * stylesheet's own `:root` block cannot outrank whichever loads last. A
 * scene's tint still does — it writes the root's inline style — and reads
 * these back as the theme it tones.
 *
 * And `--theme-accent`, the theme's own accent under a name no tint writes,
 * so what stands for the theme can wear its colour while a scene's is lent
 * to the window: the Theme choice's glyph in the Window colours menu and the
 * Studio's tiles (Ivan, 2026-09-27: "theme in studio need to be current
 * selected theme in the app").
 */
export const themeShadeRule = (shade: number) => {
  const tokens = themeShadeTokens(shade);
  const inks = themeInkTokens(shade);
  const active = lightWindowOf(shade) && themeActiveOf(shade);
  const declarations = [
    ...THEME_SHADE_TOKENS.map((token) => `${token}: ${tokens[token]};`),
    ...Object.entries(inks).map(([token, value]) => `${token}: ${value};`),
    ...(active ? [`--active: ${active};`] : []),
    `--theme-accent: ${tokens['--accent']};`,
  ].join(' ');
  const accentShare = Math.round(
    (Math.min(clampThemeShade(shade), OCEAN_SHADE) / OCEAN_SHADE) * 100,
  );
  return `:root:root:root { ${declarations} --coverage-band: color-mix(in oklab, ${BLACK_COVERAGE}, var(--accent) ${accentShare}%); }`;
};
