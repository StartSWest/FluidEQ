/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { labToHex, parseCssColour, rgbToLab } from './oklab';
import { SCENE_TINT_SURFACES } from './sceneTintPalette';
import { shadeOfDarkStep, THEME_SHADE_MIN } from './themeShade';

/**
 * THE SURFACES UNDER A SCENE'S COLOURS, BELOW THE KNEE OF THE BRIGHTNESS
 * (Ivan, 2026-11-14: "make sure on 0 brightness always the lower colour
 * fulfil so is dark but the colour can be seen, because I have few scenes
 * like the Aurora Fjord that even on 0 brightness the green is too light on
 * the panels").
 *
 * THE CAUSE: in Colours and Ambient a scene's Brightness 0 is toned against
 * the theme's shade 30, not 0 (`HELD_SHADE_FLOOR` in `sceneTintStore.ts`),
 * so that its colour survives, and below the knee only the floor
 * (`--surface-base`) was walked down toward black. Every other surface - the
 * panes, blocks, fields, menus and slider wells - kept shade 30's lightness
 * (0.21 to 0.33) with the full surface chroma (0.06 to 0.07), and a green at
 * that chroma reads as a light green panel at the darkest setting. Every
 * surface now walks down as the floor always did: from the knee's colour at
 * the knee to a dark ceiling at 0, the whole ladder by one factor so floor,
 * pane and well keep their order, each keeping its hue, and keeping enough
 * colour to be seen - a coloured scene never turns grey at 0.
 */

/**
 * Where the walk begins: from here up every surface is the toning in
 * `tintThemePalette`, unchanged. The middle of the dark walk, which is no
 * longer the middle of the slider since the slider runs on into a light
 * window (`DARK_END_SHADE`).
 */
export const DARK_KNEE = shadeOfDarkStep(50);

/**
 * The floor's OKLab lightness at Brightness 0: near black, where the held
 * floor used to stop at 0.17 (Ivan, 2026-10-24: "we can go even darker … to
 * almost black but with that colored tint"). Every other surface stands above
 * it by the share it stands above the floor at the knee.
 */
export const DARK_FLOOR_LIGHTNESS = 0.13;

/**
 * The least chroma a coloured surface keeps on the walk down: what a dark
 * surface needs for its hue to read as the scene's rather than as a grey with
 * a cast. Never more than the surface had at the knee, so a scene that tints
 * the window faintly is not given more colour than it lends.
 */
export const DARK_MIN_CHROMA = 0.03;

const lch = (hex: string) => {
  const parsed = parseCssColour(hex);
  if (!parsed) {
    return undefined;
  }
  const lab = rgbToLab(parsed.rgb);
  return { l: lab.l, chroma: Math.hypot(lab.a, lab.b), lab };
};

/**
 * `palette`'s surfaces at `brightness` below the knee, each no lighter than
 * the walk from `knee` (the same scene toned at the knee) allows. Tokens
 * either lacks are left as they are; above the knee nothing changes. The
 * knee stands at `kneeShade`: the middle of the dark walk for a scene's
 * toning, its top for colours somebody named (`pickedWindow.ts`).
 */
export const darkenSurfaces = (
  palette: Readonly<Record<string, string>>,
  knee: Readonly<Record<string, string>>,
  brightness: number,
  kneeShade = DARK_KNEE,
): Record<string, string> => {
  if (brightness >= kneeShade) {
    return { ...palette };
  }
  const kneeFloor = lch(knee['--surface-base'] ?? '');
  if (!kneeFloor || kneeFloor.l <= 0) {
    return { ...palette };
  }
  const along = Math.max(
    0,
    (brightness - THEME_SHADE_MIN) / (kneeShade - THEME_SHADE_MIN),
  );
  // The whole ladder by one factor at 0, so a pane stays a step above the
  // floor and a well a step above the pane.
  const atZero = Math.min(1, DARK_FLOOR_LIGHTNESS / kneeFloor.l);
  const darkened: Record<string, string> = { ...palette };
  SCENE_TINT_SURFACES.forEach((token) => {
    const now = lch(palette[token] ?? '');
    const atKnee = lch(knee[token] ?? '');
    if (!now || !atKnee) {
      return;
    }
    const ceiling = atKnee.l * (atZero + (1 - atZero) * along);
    const lightness = Math.min(now.l, ceiling);
    // The knee's colour, darkened, never the theme's own re-mixed at each
    // step: a scene that tints the window faintly is mostly that theme
    // colour, and as the theme walked toward Black its grey took the hue
    // with it (hue 214 sliding to 157 under Fireflies, 2026-10-25). Colour is
    // scaled with light, the share it had, so it stays inside what the screen
    // shows - but never below what keeps the hue visible.
    const scaled = atKnee.l > 0 ? atKnee.chroma * (lightness / atKnee.l) : 0;
    const chroma =
      atKnee.chroma > 0
        ? Math.max(scaled, Math.min(DARK_MIN_CHROMA, atKnee.chroma))
        : 0;
    const factor = atKnee.chroma > 0 ? chroma / atKnee.chroma : 0;
    darkened[token] = labToHex({
      l: lightness,
      a: atKnee.lab.a * factor,
      b: atKnee.lab.b * factor,
    });
  });
  return darkened;
};
