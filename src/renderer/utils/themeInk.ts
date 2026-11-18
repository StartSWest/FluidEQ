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
  type ILab,
} from './oklab';

/**
 * THE INKS, WORKED OUT FROM THE GROUND THEY ARE READ ON.
 *
 * The surfaces of each shade are subtle on purpose — the panes a step off the
 * floor — and everything read on them has to stand clear of them whatever the
 * shade (Ivan, 2026-09-27: "pane bg vs app bg can be very similar, that's the
 * idea, panes are subtle, but borders, text, disabled text, info text need to
 * look with good contrast"; "we need to fix 100% brightness so the dark side
 * gets better also automatically; I hate all division lines color vs the
 * bg"). They were fixed colours at fixed opacities, tuned once on Ocean: the
 * hairlines measured 1.1:1 on Black and 1.3:1 at 100%, the fields' edge
 * 1.3:1, the faint text 4.3:1 at 100% against 12:1 on Black.
 *
 * So each one is given the contrast it must reach, in WCAG terms, against the
 * lightest of the grounds most things stand on (`groundOf`), so the others
 * only ever do better — and is solved for it at every shade: an edge by its
 * opacity, a text by its lightness (never darker than it shipped), the
 * disabled state by its opacity. `themeShade.ts` writes the answers with the
 * surfaces.
 */

/** A section card is the pane at 85% over the floor (`$surface-section`). */
export const CARD_PANE_SHARE = 0.85;

/**
 * The hairlines. The subtle one parts rows inside a pane, the panel one draws
 * a pane's or a card's edge, the menu one a floating surface's. First solved
 * at 1.4, 1.65 and 2.1, which measured 1.33 to 1.74 on the EQ page's own
 * grounds in the window at Black and at 100 — the switches' track, the
 * driver's plot, the pane's foot, the page's card — and still read as
 * missing (Ivan, 2026-09-27, the EQ page first: "focus on how this page looks
 * now"). 1.8:1 is the least any of them may measure on the ground it stands
 * on, and `groundOf` is the lightest of those.
 */
export const EDGE_CONTRAST = {
  '--border-subtle': 1.8,
  '--border-panel': 2,
  '--border-menu': 2.5,
} as const;

/** The three tiers of text: what is read, what explains, what hints. */
export const TEXT_CONTRAST = {
  '--text-primary': 7,
  '--text-muted': 5.8,
  '--text-faint': 4.8,
} as const;

/**
 * The tiers as they shipped, kept wherever they already reach their contrast
 * (every shade up to Ocean): only a lighter ground moves them, toward white.
 */
export const SHIPPED_TEXT = {
  '--text-primary': '#ecf5fb',
  '--text-muted': '#d6e9f7',
  '--text-faint': '#bfd3e3',
} as const;

/**
 * A disabled control's words are still words: the muted tier at the disabled
 * opacity reaches 3:1, which reads as "not now" without vanishing. Never below
 * the 0.45 it shipped at, never so high it stops looking disabled.
 */
const DISABLED_CONTRAST = 3;
const DISABLED_OPACITY_MIN = 0.45;
const DISABLED_OPACITY_MAX = 0.8;

/**
 * Every control's edge at rest — a field, a button, a select, a switch's
 * track, any outline the hand acts on: the accent's light at a share of full
 * (`$edge-rest`). 24% on Ocean, 2.0:1 against the card, softer than the 42%
 * every control used to wear (Ivan, 2026-11-17, choosing the one control
 * theme): at 42% a row of quiet controls was as loud as the lit one beside
 * it, whose edge is the accent at 62%. More only where a light shade needs
 * it to reach 2.0:1.
 */
const FIELD_EDGE_CONTRAST = 2;
const FIELD_EDGE_SHARE_MIN = 0.24;

/**
 * The same edge under the pointer (`$edge-hover`): half the accent's light,
 * 4.5:1 on Ocean, or the share that reaches 3.2:1 where a light shade needs
 * more — a clear step over the edge at rest at every shade.
 */
const FIELD_EDGE_HOVER_CONTRAST = 3.2;
const FIELD_EDGE_HOVER_SHARE_MIN = 0.5;

/**
 * The dim tier, for what is decorative or a unit beside a value (`$text-dim`):
 * the edge tint at a share of full, 3:1 like a disabled word, never under the
 * 38% it shipped at. At 100% it measured 2.1:1 — the knobs' "dB/oct".
 */
const DIM_CONTRAST = 3;
const DIM_SHARE_MIN = 0.38;
/** `$edge-tint`, the cool white the hairlines and the dim tier are made of. */
export const EDGE_TINT = '#d6e9f7';

/**
 * WHICH WAY THE WINDOW'S INK RUNS. Every theme shade is a dark window with
 * light ink. A light surface the listener or a scene picks (Ivan,
 * 2026-11-17: "depending on the setting, the app needs to color white or
 * dark") turns it round: the same inks, solved to the same contrasts, toward
 * black instead of white (`pickedWindow.ts`). One set of names for both, on
 * `:root`, so every stylesheet follows the switch without knowing about it.
 *
 * - `edge` is `$edge-tint`: what the hairlines, the mists, the dim tier and
 *   the graph's rules are made of.
 * - `ink` is `$ink`: the strongest ink, white on a dark window - a value, a
 *   title, a glyph on a pane.
 * - `text` are where each tier starts before it is moved, only as far as it
 *   has to, to reach its contrast.
 */
export interface IInkSet {
  readonly edge: string;
  readonly ink: string;
  readonly text: Readonly<Record<keyof typeof SHIPPED_TEXT, string>>;
  readonly toward: 'white' | 'black';
}

/** The ink every theme shade wears: light, as it shipped. */
export const LIGHT_INK: IInkSet = {
  edge: EDGE_TINT,
  ink: '#ffffff',
  text: SHIPPED_TEXT,
  toward: 'white',
};

/** What a light window wears on `:root`, beside the theme's own inks. */
export const WINDOW_INK_ATTRIBUTE = 'data-window-ink';

/**
 * The graph's ruled paper (`GridLine`, `graphPaper.ts`): the decades and the
 * ±10/±20 dB lines, and the lines between the decades at a lower step. They
 * were the edge tint at a fixed 12% and 6%, about 1.25:1 and 1.1:1 at every
 * shade — "faint at 100", and gone on Black. A grid is a reference, so it
 * stays under the hairlines (1.8:1): there to place a curve by, never
 * competing with one.
 */
const RULE_CONTRAST = {
  '--rule-major': 1.5,
  '--rule-minor': 1.22,
} as const;

/** Every ink `inkTokens` solves, in the order it writes them. */
export const INK_TOKENS = [
  '--text-primary',
  '--text-muted',
  '--text-faint',
  '--disabled-opacity',
  '--field-edge-share',
  '--field-edge-hover-share',
  '--text-dim-share',
  '--rule-major',
  '--rule-minor',
  '--edge-tint',
  '--ink',
] as const;

export type TInkToken = (typeof INK_TOKENS)[number];

type TRgb = readonly [number, number, number];

const rgbOf = (text: string): TRgb => {
  const parsed = parseCssColour(text);
  if (!parsed) {
    throw new Error(`Not a colour the ink can be solved on: ${text}`);
  }
  return parsed.rgb;
};

const lumOf = (rgb: TRgb) => luminance(rgb.map(toLinear));

/** `ink` at `alpha` over `ground`, blended as the browser blends: in sRGB. */
const over = (ink: TRgb, alpha: number, ground: TRgb): TRgb => [
  ink[0] * alpha + ground[0] * (1 - alpha),
  ink[1] * alpha + ground[1] * (1 - alpha),
  ink[2] * alpha + ground[2] * (1 - alpha),
];

const contrastOver = (ink: TRgb, alpha: number, ground: TRgb) =>
  contrast(lumOf(over(ink, alpha, ground)), lumOf(ground));

/** The least opacity of `ink` on `ground` that reaches `target`, or 1. */
const opacityFor = (ink: TRgb, ground: TRgb, target: number) => {
  if (contrastOver(ink, 1, ground) <= target) {
    return 1;
  }
  let low = 0;
  let high = 1;
  for (let step = 0; step < 24; step += 1) {
    const middle = (low + high) / 2;
    if (contrastOver(ink, middle, ground) >= target) {
      high = middle;
    } else {
      low = middle;
    }
  }
  return high;
};

/** The card at a shade, from its floor and its pane. */
export const cardOf = (floor: string, pane: string): TRgb =>
  over(rgbOf(pane), CARD_PANE_SHARE, rgbOf(floor));

/** The same card as a hex, for what can only be handed a plain colour. */
export const cardHexOf = (floor: string, pane: string): string =>
  labToHex(rgbToLab(cardOf(floor, pane)));

/**
 * What the inks are solved on: the lighter of a card and the pane itself.
 * Solved on the card alone, the edges of whatever is painted in the pane's
 * own colour — the sound pane, the player's bar, the Studio's cards — came
 * out under their target there: 1.73:1 on Black for a 1.8 edge.
 */
export const groundOf = (
  floor: string,
  pane: string,
  ink: IInkSet['toward'] = 'white',
): TRgb => {
  const card = cardOf(floor, pane);
  const own = rgbOf(pane);
  // Light ink is hardest to read on the lighter of the two, dark ink on the
  // darker: whichever is the worst for this ink is the one solved on.
  const ownIsLighter = lumOf(own) > lumOf(card);
  return ownIsLighter === (ink === 'white') ? own : card;
};

/**
 * `colour` at the opacity that reaches `target` on `ground`, written the way
 * the tables write an edge.
 */
const rgbaFor = (colour: TRgb, ground: TRgb, target: number): string => {
  const alpha = opacityFor(colour, ground, target);
  const [red, green, blue] = colour.map((channel) => Math.round(channel * 255));
  return `rgba(${red}, ${green}, ${blue}, ${Number(alpha.toFixed(3))})`;
};

/**
 * `edge` (an `rgb`/`rgba` whose colour is kept) at the opacity that reaches
 * its contrast on `ground`.
 */
export const edgeOn = (
  token: keyof typeof EDGE_CONTRAST,
  edge: string,
  ground: TRgb,
): string => rgbaFor(rgbOf(edge), ground, EDGE_CONTRAST[token]);

/**
 * `shipped`, moved along its own hue toward `toward` only as far as it has
 * to go to reach `target` on `ground`; unchanged where it already does.
 */
const textOn = (
  shipped: string,
  ground: TRgb,
  target: number,
  toward: IInkSet['toward'] = 'white',
): string => {
  const groundLum = lumOf(ground);
  const reach = (lab: ILab) =>
    contrast(lumOf(rgbOf(labToHex(lab))), groundLum) >= target;
  const start = rgbToLab(rgbOf(shipped));
  if (reach(start)) {
    return shipped;
  }
  // The colour thins as the lightness nears the end it moves to, so the end
  // of the range is white or black itself rather than a tinted near-white or
  // near-black out of gamut.
  const end = toward === 'white' ? 1 : 0;
  const at = (l: number): ILab => {
    const keep = Math.abs(end - l) / Math.max(Math.abs(end - start.l), 1e-6);
    return { l, a: start.a * keep, b: start.b * keep };
  };
  if (!reach(at(end))) {
    return toward === 'white' ? '#ffffff' : '#000000';
  }
  // `near` never reaches, `far` always does; the answer is the reaching
  // lightness closest to where the colour started.
  let near = start.l;
  let far = end;
  for (let step = 0; step < 24; step += 1) {
    const middle = (near + far) / 2;
    if (reach(at(middle))) {
      far = middle;
    } else {
      near = middle;
    }
  }
  return labToHex(at(far));
};

/**
 * Every ink that is not an edge, solved on `ground` (`groundOf`), in the
 * window's ink `set`: light for every theme shade, dark on a light window.
 */
export const inkTokens = (
  ground: TRgb,
  accentLight: string,
  set: IInkSet = LIGHT_INK,
): Record<TInkToken, string> => {
  const tier = (token: keyof typeof TEXT_CONTRAST) =>
    textOn(set.text[token], ground, TEXT_CONTRAST[token], set.toward);
  const text = {
    '--text-primary': tier('--text-primary'),
    '--text-muted': tier('--text-muted'),
    '--text-faint': tier('--text-faint'),
  };
  const disabled = Math.min(
    DISABLED_OPACITY_MAX,
    Math.max(
      DISABLED_OPACITY_MIN,
      opacityFor(rgbOf(text['--text-muted']), ground, DISABLED_CONTRAST),
    ),
  );
  const fieldEdge = Math.max(
    FIELD_EDGE_SHARE_MIN,
    opacityFor(rgbOf(accentLight), ground, FIELD_EDGE_CONTRAST),
  );
  const fieldEdgeHover = Math.max(
    FIELD_EDGE_HOVER_SHARE_MIN,
    opacityFor(rgbOf(accentLight), ground, FIELD_EDGE_HOVER_CONTRAST),
  );
  const edge = rgbOf(set.edge);
  const dim = Math.max(DIM_SHARE_MIN, opacityFor(edge, ground, DIM_CONTRAST));
  const percent = (share: number) => `${Number((share * 100).toFixed(1))}%`;
  const rule = (token: keyof typeof RULE_CONTRAST) =>
    rgbaFor(edge, ground, RULE_CONTRAST[token]);
  return {
    ...text,
    '--disabled-opacity': String(Number(disabled.toFixed(3))),
    '--field-edge-share': percent(fieldEdge),
    '--field-edge-hover-share': percent(fieldEdgeHover),
    '--text-dim-share': percent(dim),
    '--rule-major': rule('--rule-major'),
    '--rule-minor': rule('--rule-minor'),
    '--edge-tint': set.edge,
    '--ink': set.ink,
  };
};
