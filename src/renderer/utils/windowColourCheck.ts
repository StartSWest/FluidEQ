/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISceneWindowColours } from 'common/sceneWindowColours';
import { hueDistance, parseCssColour, rgbToLab } from './oklab';
import { clearsWarningHues } from './sceneTint';

/**
 * WHETHER A SCENE'S WINDOW COLOURS WILL MAKE A GOOD WINDOW (Ivan, 2026-11-17:
 * "fix the code and agent prompt so it picks always the right color for the
 * windows"). Not one FluidEQ scene named its colours, and those measured for
 * them came out three times the same violet, with near-black accents and
 * mid-tone floors. These are the rules the hand-chosen colours of all forty
 * FluidEQ scenes were held to, as faults a member's AI is told by name
 * (`studioAgent/windowColourLines.ts`) and FluidEQ's own rule never commits
 * (`sceneOwnColours.ts`).
 *
 * Lightness and chroma are OKLab's: 0 black to 1 white, 0 grey to about 0.3.
 */

export type TWindowColourFault =
  /** The surface is a mid-tone: neither a night's floor nor a light ground. */
  | 'surface-mid'
  /** The accent is too dark to point with on a dark window. */
  | 'accent-dim'
  /** The accent is too grey to point with. */
  | 'accent-grey'
  /** The accent is the surface's own colour at nearly its own lightness. */
  | 'accent-like-surface'
  /** The glow is too dark to look lit. */
  | 'glow-dim'
  /** The glow is a red, an orange or an amber: off and wait. */
  | 'glow-warning'
  /** The glow is the accent's colour again. */
  | 'glow-like-accent';

/**
 * A dark floor no lighter than this keeps its words above the text tiers'
 * contrast; a light ground no darker than the other. Between them the window
 * moves the colour anyway (`pickedWindow.ts`), so it is not what was named.
 */
const DARK_SURFACE_MOST = 0.4;
const LIGHT_SURFACE_LEAST = 0.82;
/** The least lightness a filled accent or a lit glow reads at on a floor. */
const LIT_LEAST = 0.62;
/** The least chroma a colour points with; under it is a grey. */
const POINTING_CHROMA = 0.06;
/** Under this a colour has no hue worth comparing. */
const HUE_CHROMA = 0.03;
/** An accent this far round the wheel from the surface is its own colour. */
const ACCENT_APART = 35;
/** Or this much lighter: a scene of truly one colour, brighter. */
const ACCENT_LIGHTER = 0.35;
/** The glow is a third colour this far round from the accent. */
export const GLOW_HUE_APART = 50;
/** A glow paler than this is a light, not a colour: it may share a hue. */
const GLOW_COLOURED = 0.06;
/** Under this a glow is a grey, which FluidEQ never reads as a hue. */
const GLOW_GREY = 0.02;

export interface ILch {
  lightness: number;
  chroma: number;
  hue: number;
}

/** `hex` as OKLab lightness, chroma and hue in degrees; undefined if unreadable. */
export const lchOf = (hex: string): ILch | undefined => {
  const parsed = parseCssColour(hex);
  if (!parsed) {
    return undefined;
  }
  const lab = rgbToLab(parsed.rgb);
  return {
    lightness: lab.l,
    chroma: Math.hypot(lab.a, lab.b),
    hue: ((Math.atan2(lab.b, lab.a) * 180) / Math.PI + 360) % 360,
  };
};

/** What is wrong with `colours` as a window, in the order to fix it; [] when nothing. */
export const windowColourFaults = (
  colours: ISceneWindowColours,
): TWindowColourFault[] => {
  const surface = lchOf(colours.surface);
  const accent = lchOf(colours.accent);
  const glow = lchOf(colours.glow);
  if (!surface || !accent || !glow) {
    return [];
  }
  const faults: TWindowColourFault[] = [];
  if (
    surface.lightness > DARK_SURFACE_MOST &&
    surface.lightness < LIGHT_SURFACE_LEAST
  ) {
    faults.push('surface-mid');
  }
  if (accent.lightness < LIT_LEAST) {
    faults.push('accent-dim');
  }
  if (accent.chroma < POINTING_CHROMA) {
    faults.push('accent-grey');
  }
  // On a light ground the accent is worn deep, as far as its label needs
  // (`windowOn`), so a bright one of the ground's own hue still stands apart.
  if (
    surface.lightness < LIGHT_SURFACE_LEAST &&
    surface.chroma >= HUE_CHROMA &&
    accent.chroma >= HUE_CHROMA &&
    hueDistance(surface.hue, accent.hue) < ACCENT_APART &&
    Math.abs(accent.lightness - surface.lightness) < ACCENT_LIGHTER
  ) {
    faults.push('accent-like-surface');
  }
  if (glow.lightness < LIT_LEAST) {
    faults.push('glow-dim');
  }
  if (glow.chroma >= GLOW_GREY && !clearsWarningHues(glow.hue)) {
    faults.push('glow-warning');
  }
  if (
    glow.chroma >= GLOW_COLOURED &&
    accent.chroma >= HUE_CHROMA &&
    hueDistance(glow.hue, accent.hue) < GLOW_HUE_APART
  ) {
    faults.push('glow-like-accent');
  }
  return faults;
};
