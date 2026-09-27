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
 * So each one is given the contrast it must reach, in WCAG terms, against a
 * card — the lighter of the two grounds most things stand on, so the floor
 * only ever does better — and is solved for it at every shade: an edge by its
 * opacity, a text by its lightness (never darker than it shipped), the
 * disabled state by its opacity. `themeShade.ts` writes the answers with the
 * surfaces.
 */

/** A section card is the pane at 85% over the floor (`$surface-section`). */
export const CARD_PANE_SHARE = 0.85;

/**
 * The hairlines. The subtle one parts rows inside a pane, the panel one draws
 * a pane's or a card's edge, the menu one a floating surface's.
 */
export const EDGE_CONTRAST = {
  '--border-subtle': 1.4,
  '--border-panel': 1.65,
  '--border-menu': 2.1,
} as const;

/** The three tiers of text: what is read, what explains, what hints. */
const TEXT_CONTRAST = {
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
 * A field's and a quiet button's edge: the accent's light at a share of full
 * (`$border-field`), 1.7:1, and never under the 13% it shipped at.
 */
const FIELD_EDGE_CONTRAST = 1.7;
const FIELD_EDGE_SHARE_MIN = 0.13;

/**
 * The dim tier, for what is decorative or a unit beside a value (`$text-dim`):
 * the edge tint at a share of full, 3:1 like a disabled word, never under the
 * 38% it shipped at. At 100% it measured 2.1:1 — the knobs' "dB/oct".
 */
const DIM_CONTRAST = 3;
const DIM_SHARE_MIN = 0.38;
/** `$edge-tint`, the cool white the hairlines and the dim tier are made of. */
const EDGE_TINT = '#d6e9f7';

export type TInkToken =
  | keyof typeof TEXT_CONTRAST
  | '--disabled-opacity'
  | '--field-edge-share'
  | '--text-dim-share';

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

/**
 * `edge` (an `rgb`/`rgba` whose colour is kept) at the opacity that reaches
 * its contrast on `card`, written the way the tables write an edge.
 */
export const edgeOn = (
  token: keyof typeof EDGE_CONTRAST,
  edge: string,
  card: TRgb,
): string => {
  const colour = rgbOf(edge);
  const alpha = opacityFor(colour, card, EDGE_CONTRAST[token]);
  const [red, green, blue] = colour.map((channel) => Math.round(channel * 255));
  return `rgba(${red}, ${green}, ${blue}, ${Number(alpha.toFixed(3))})`;
};

/**
 * `shipped`, lifted toward white along its own hue only as far as it has to
 * go to reach `target` on `card`; unchanged where it already does.
 */
const textOn = (shipped: string, card: TRgb, target: number): string => {
  const cardLum = lumOf(card);
  const reach = (lab: ILab) =>
    contrast(lumOf(rgbOf(labToHex(lab))), cardLum) >= target;
  const start = rgbToLab(rgbOf(shipped));
  if (reach(start)) {
    return shipped;
  }
  // Toward white: the colour thins as the lightness rises, so the top of the
  // range is white itself rather than a tinted near-white out of gamut.
  const at = (l: number): ILab => {
    const keep = (1 - l) / Math.max(1 - start.l, 1e-6);
    return { l, a: start.a * keep, b: start.b * keep };
  };
  if (!reach(at(1))) {
    return '#ffffff';
  }
  let low = start.l;
  let high = 1;
  for (let step = 0; step < 24; step += 1) {
    const middle = (low + high) / 2;
    if (reach(at(middle))) {
      high = middle;
    } else {
      low = middle;
    }
  }
  return labToHex(at(high));
};

/** Every ink that is not an edge, for a shade whose card is `card`. */
export const inkTokens = (
  card: TRgb,
  accentLight: string,
): Record<TInkToken, string> => {
  const text = {
    '--text-primary': textOn(
      SHIPPED_TEXT['--text-primary'],
      card,
      TEXT_CONTRAST['--text-primary'],
    ),
    '--text-muted': textOn(
      SHIPPED_TEXT['--text-muted'],
      card,
      TEXT_CONTRAST['--text-muted'],
    ),
    '--text-faint': textOn(
      SHIPPED_TEXT['--text-faint'],
      card,
      TEXT_CONTRAST['--text-faint'],
    ),
  };
  const disabled = Math.min(
    DISABLED_OPACITY_MAX,
    Math.max(
      DISABLED_OPACITY_MIN,
      opacityFor(rgbOf(text['--text-muted']), card, DISABLED_CONTRAST),
    ),
  );
  const fieldEdge = Math.max(
    FIELD_EDGE_SHARE_MIN,
    opacityFor(rgbOf(accentLight), card, FIELD_EDGE_CONTRAST),
  );
  const dim = Math.max(
    DIM_SHARE_MIN,
    opacityFor(rgbOf(EDGE_TINT), card, DIM_CONTRAST),
  );
  const percent = (share: number) => `${Number((share * 100).toFixed(1))}%`;
  return {
    ...text,
    '--disabled-opacity': String(Number(disabled.toFixed(3))),
    '--field-edge-share': percent(fieldEdge),
    '--text-dim-share': percent(dim),
  };
};
