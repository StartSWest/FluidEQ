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
 * HOW A FILLED CONTROL WEARS A COLOUR - the accent's buttons, the second
 * colour's switches and pills - and the label written on it, with the OKLab
 * arithmetic every window rule shares (`windowLight.ts`, `pickedWindow.ts`).
 * Imports nothing of the window's, so both can import it.
 */

/** Below this chroma a colour is a grey: its hue says nothing. */
export const GREY_CHROMA = 0.02;

export const labOf = (hex: string): ILab | undefined => {
  const parsed = parseCssColour(hex);
  return parsed ? rgbToLab(parsed.rgb) : undefined;
};

const lumOf = (hex: string) => {
  const parsed = parseCssColour(hex);
  return parsed ? luminance(parsed.rgb.map(toLinear)) : 0;
};

export const chromaOf = (lab: ILab) => Math.hypot(lab.a, lab.b);

export const clampL = (l: number) => Math.min(1, Math.max(0, l));

/** `lab` at lightness `l`, keeping its colour. */
export const atL = (lab: ILab, l: number): ILab => ({ ...lab, l: clampL(l) });

/**
 * `colour`'s lightness moved toward `end` (0 or 1) until `holds` says yes:
 * `colour` itself where it already does, and `end` where nothing on the way
 * does. `holds` has to be true from where it first is all the way to `end`.
 */
const movedUntil = (
  colour: ILab,
  end: number,
  holds: (l: number) => boolean,
): ILab => {
  if (holds(colour.l)) {
    return colour;
  }
  if (!holds(end)) {
    return atL(colour, end);
  }
  // `near` never holds, `far` always does.
  let near = colour.l;
  let far = end;
  for (let step = 0; step < 24; step += 1) {
    const middle = (near + far) / 2;
    if (holds(middle)) {
      far = middle;
    } else {
      near = middle;
    }
  }
  return atL(colour, far);
};

/** Whether `l`'s `colour` stands at `target` against a colour of `lum`. */
const reachesAt = (colour: ILab, lum: number, target: number) => (l: number) =>
  contrast(lumOf(labToHex(atL(colour, l))), lum) >= target;

/**
 * `colour` moved in lightness, away from `ground` (`darker` or not), until it
 * stands at `target` against it; `colour` itself where it already does, and
 * the end of the range where nothing on the way does.
 */
export const clearOf = (
  colour: ILab,
  ground: string,
  target: number,
  darker: boolean,
): string =>
  labToHex(
    movedUntil(
      colour,
      darker ? 0 : 1,
      reachesAt(colour, lumOf(ground), target),
    ),
  );

/**
 * The least a filled control's label keeps on its fill: the WCAG AA level for
 * words. A colour that already clears it is worn exactly; one that does not
 * is moved in lightness only until it does.
 */
const LABEL_CONTRAST = 4.5;

/**
 * Where a colour with no hue stands as a filled control (`filledOn`), in
 * OKLab lightness: the window's ink, a step off pure black and white so a
 * thumb or a switch still has an edge against the words beside it.
 */
const MONO_ON_LIGHT_LIGHTNESS = 0.24;
const MONO_ON_DARK_LIGHTNESS = 0.93;

/** The accent's pressed strength, in OKLab lightness below it. */
export const ACCENT_DARK_STEP = 0.08;

/**
 * `colour` as a filled control wears it with the floor's colour, `floor`, for
 * its label: moved in lightness only, away from the floor, as far as that
 * label needs (`LABEL_CONTRAST`) - darker on a light window, lighter on a
 * dark one. How the theme's own accent and "on" are worn on every shade.
 *
 * A colour with no hue (black, a grey, white) is worn as monochrome: the
 * window's own ink, near black on a light window and near white on a dark
 * one. Moved only as far as its label needs, black on a dark window stopped
 * at a dead mid grey, and every switch and thumb went the colour of nothing
 * (Ivan, 2026-11-18, black picked with the Brightness down: "what should we
 * do instead"). A colour with a hue keeps it and moves as before.
 */
export const filledOn = (
  colour: ILab,
  floor: string,
  isLight: boolean,
): string => {
  if (chromaOf(colour) < GREY_CHROMA) {
    const l = isLight
      ? Math.min(colour.l, MONO_ON_LIGHT_LIGHTNESS)
      : Math.max(colour.l, MONO_ON_DARK_LIGHTNESS);
    return clearOf({ l, a: 0, b: 0 }, floor, LABEL_CONTRAST, isLight);
  }
  return clearOf(colour, floor, LABEL_CONTRAST, isLight);
};

/**
 * How far, in OKLab (lightness and colour together), a light fill has to
 * stand from the white window's panes to read as a control on them and not
 * as the pane: "only colours almost as white as the window stay blocked"
 * (Ivan, 2026-11-18). Measured against white panes: the near-whites - lavender
 * #E6E6FA, misty rose #FFE4E1, lemon chiffon #FFFACD, beige #F5F5DC, alice
 * blue #F0F8FF - stand 0.03 to 0.074 off; the pastels - his #FFAAA4 0.21,
 * light pink #FFB6C1 0.175, light blue #ADD8E6 0.15, pale yellow #FFFF99
 * 0.126, Material's red and green 100 tints 0.12 and 0.116 - all past 0.1.
 *
 * Not a contrast ratio: a ratio reads luminance alone, and what sets a pastel
 * apart from white is its colour. #FFFF99, plainly a yellow button, is 1.05:1
 * against white, under lavender's 1.23:1, so any ratio that kept the yellow
 * would let the lavender through, and WCAG's 3:1 for controls would block
 * every pastel there is (#FFAAA4 is 1.82:1).
 */
const LIGHT_FILL_APART = 0.1;

/** What a filled control stands on and may be labelled in. */
export interface IFillGround {
  /**
   * The window's floor: the label on every dark window, and what a deep fill
   * on the white window is solved against (its label there is the panes'
   * white, lighter still).
   */
  floor: string;
  /**
   * The panes the controls stand on, which a light fill must stand apart
   * from, and the white a deep fill is labelled in on the white window.
   */
  pane: string;
  /** The window's strongest ink (`--ink`): the label on a light fill. */
  ink: string;
  /** Whether the window is the white one (Brightness 77 to 100). */
  isLight: boolean;
}

/** A filled control's colour and the colour of the words on it. */
export interface IFilledFace {
  fill: string;
  label: string;
}

const distance = (left: ILab, right: ILab) =>
  Math.hypot(left.l - right.l, left.a - right.a, left.b - right.b);

/**
 * A COLOUR SOMEBODY PICKED, AS A FILLED CONTROL WEARS IT, AND ITS LABEL
 * (Ivan, 2026-11-18, of a pastel pink on the white window: "Dark text on
 * light accents: you can pick light pinks and pastels; filled buttons switch
 * to dark text when the accent is light. Only colours almost as white as the
 * window stay blocked").
 *
 * And the same on a dark window, mirrored (Ivan, 2026-11-19, of a dark
 * point that allowed only pale pastels: "it's limiting the colours too much,
 * there is still a lot of room there to make a more vivid colour"): a vivid
 * or deep colour carries the window's light ink for its words, a light one
 * the floor's colour. A colour with no hue anywhere keeps the floor's colour
 * for a label and `filledOn`'s monochrome rule exactly. Otherwise a colour
 * is worn as picked wherever one of two labels reads on it:
 *
 * - first it is held apart from the panes (`LIGHT_FILL_APART`), moved
 *   away from them just that far when it is nearly their colour - darker on
 *   the white window, lighter on a dark one;
 * - the floor's colour where that reaches `LABEL_CONTRAST`: a deep accent
 *   on the white window, a light one on a dark window, as every accent
 *   always had - written on the white window in the panes' white, which
 *   only reads better than the floor it was measured against;
 * - else the window's ink where that reaches it - its dark ink on the white
 *   window, on the colour AND on the colour a pressed step darker
 *   (`ACCENT_DARK_STEP`), because the fill's own darker end carries the
 *   same label; its light ink on a dark window, where a darker step only
 *   reads better;
 * - else, a mid-tone neither reaches, it is moved the shorter way: toward
 *   the floor's label, as before, or toward the ink's, while still apart
 *   from the panes.
 *
 * The colour pickers draw their limit from this same rule (`pickedFilled`).
 */
export const filledFace = (
  colour: ILab,
  { floor, pane, ink, isLight }: IFillGround,
): IFilledFace => {
  // THE LIGHT LABEL ON THE WHITE WINDOW IS THE PANES' WHITE, not the floor's
  // grey (Ivan, 2026-11-24: "also the gray text / icon on green button"):
  // the floor there is #ececec, and on the deep teal it read as a grey glyph
  // on every loud button, the amp's play key worst. The fill is still solved
  // against the floor, so the panes' lighter white only reads better; on a
  // dark window the floor is the dark label and stays it.
  const lightLabel = isLight && lumOf(pane) > lumOf(floor) ? pane : floor;
  if (chromaOf(colour) < GREY_CHROMA) {
    return { fill: filledOn(colour, floor, isLight), label: lightLabel };
  }
  // Away from the panes, and the way the floor's label wants the colour:
  // darker on the white window, lighter on a dark one; the ink's the other.
  const awayFromPanes = isLight ? 0 : 1;
  const towardInk = isLight ? 1 : 0;
  const paneLab = labOf(pane) ?? { l: 1, a: 0, b: 0 };
  // Measured as painted: a light colour past sRGB loses chroma on the way.
  const apartAt = (l: number) => {
    const painted = labOf(labToHex(atL(colour, l)));
    return (
      painted !== undefined && distance(painted, paneLab) >= LIGHT_FILL_APART
    );
  };
  // Moving a colour toward `awayFromPanes` from the panes' side walks it
  // through them, so apart is false until past their lightness and true from
  // there to the end.
  const apart = movedUntil(colour, awayFromPanes, apartAt);
  const floorReads = reachesAt(apart, lumOf(floor), LABEL_CONTRAST);
  if (floorReads(apart.l)) {
    return { fill: labToHex(apart), label: lightLabel };
  }
  const inkReachesAt = reachesAt(apart, lumOf(ink), LABEL_CONTRAST);
  const inkReads = (l: number) =>
    inkReachesAt(l) && (!isLight || inkReachesAt(l - ACCENT_DARK_STEP));
  if (inkReads(apart.l)) {
    return { fill: labToHex(apart), label: ink };
  }
  const forFloor = movedUntil(apart, awayFromPanes, floorReads);
  const forInk = movedUntil(apart, towardInk, inkReads);
  const inkFits =
    inkReads(forInk.l) &&
    apartAt(forInk.l) &&
    Math.abs(forInk.l - apart.l) < Math.abs(apart.l - forFloor.l);
  return inkFits
    ? { fill: labToHex(forInk), label: ink }
    : { fill: labToHex(forFloor), label: lightLabel };
};
