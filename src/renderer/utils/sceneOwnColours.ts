/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISceneWindowColours } from 'common/sceneWindowColours';
import {
  hueDistance,
  labToHex,
  parseCssColour,
  rgbToLab,
  toward,
} from './oklab';
import {
  sceneAppColourStops,
  type ISceneColourControls,
  type ISceneColourValues,
} from './sceneAppColours';
import {
  clearsWarningHues,
  findSceneSky,
  type ISceneColour,
  type ISceneSky,
} from './sceneTint';
import {
  isGreySky,
  PALE_ACTIVE_CHROMA,
  PALE_ACTIVE_LIGHTNESS,
  sceneAccentHue,
} from './sceneTintPalette';
import { OCEAN_THEME, THEME_ACTIVE } from './themeShade';
import { GLOW_HUE_APART } from './windowColourCheck';

/**
 * THE COLOURS A SCENE LENDS THE WINDOW, FROM WHAT THE SCENE SAYS (Ivan,
 * 2026-11-14: "we want the agent to give those colours, but in case they
 * don't exist we need a deterministic algorithm").
 *
 * 1. The colours it names (`windowColours`, `common/sceneWindowColours.ts`),
 *    chosen by its maker's AI from the scene's own palette. These are worn
 *    as named (`pickedWindow.ts`), like the listener's own.
 * 2. Failing those, colours worked out from the palette the scene is drawn
 *    in - the very stops Colourful mode wears (`sceneAppColours.ts`), so the
 *    panes and the rainbow never disagree, and a palette the listener changes
 *    changes both. The same stops always give the same three colours: the
 *    rule below reads them as a tiny picture through the measurement's own
 *    rules, with every stop weighed the same.
 * 3. Failing both - a scene older than palettes that names nothing - this
 *    answers nothing, and the scene is measured by drawing it
 *    (`graph/sceneSky.ts`), as every scene used to be.
 */

/** Below this chroma a colour's hue is noise: it is a grey. */
const GREY_CHROMA = 0.02;

/** How many pixels each stop stands for in the picture the rule reads. */
const PIXELS_PER_STOP = 4;

const colourOf = (hex: string): ISceneColour | undefined => {
  const parsed = parseCssColour(hex);
  if (!parsed) {
    return undefined;
  }
  const lab = rgbToLab(parsed.rgb);
  const chroma = Math.hypot(lab.a, lab.b);
  const hue = ((Math.atan2(lab.b, lab.a) * 180) / Math.PI + 360) % 360;
  return chroma < GREY_CHROMA
    ? { lightness: lab.l, chroma: 0, hue: 0, share: 1 }
    : { lightness: lab.l, chroma, hue, share: 1 };
};

const hexOf = (colour: ISceneColour) => {
  const radians = (colour.hue * Math.PI) / 180;
  return labToHex({
    l: colour.lightness,
    a: colour.chroma * Math.cos(radians),
    b: colour.chroma * Math.sin(radians),
  });
};

/**
 * `colours` as the sky the window is tinted from. A grey surface is a grey
 * sky, the way a picture of polished metal is measured; a grey accent says
 * no second colour, so the buttons take the surface's hue; a glow that sits
 * on the red or the amber that say off and wait is not used for "on", or an
 * attached profile's pill in a fire scene would read as an error.
 */
export const skyFromWindowColours = (
  colours: ISceneWindowColours,
): ISceneSky | undefined => {
  const surface = colourOf(colours.surface);
  if (!surface) {
    return undefined;
  }
  const coloured = (hex: string) => {
    const colour = colourOf(hex);
    return colour && colour.chroma > 0 ? colour : null;
  };
  const accent = coloured(colours.accent);
  const glow = coloured(colours.glow);
  const active = glow && clearsWarningHues(glow.hue) ? glow : null;
  const palette = [accent, glow, surface.chroma > 0 ? surface : null].filter(
    (colour): colour is ISceneColour => colour !== null,
  );
  return { ...surface, accent, active, palette };
};

/**
 * The three colours the rule gives `stops`, or undefined when they are all
 * greys, near-blacks or near-whites and say nothing about a colour.
 */
export const windowColoursFromStops = (
  stops: readonly string[],
): ISceneWindowColours | undefined => {
  const pixels: number[] = [];
  stops.forEach((stop) => {
    const parsed = parseCssColour(stop);
    if (!parsed) {
      return;
    }
    const [red, green, blue] = parsed.rgb.map((channel) =>
      Math.round(channel * 255),
    );
    for (let pixel = 0; pixel < PIXELS_PER_STOP; pixel += 1) {
      pixels.push(red, green, blue, 255);
    }
  });
  const sky = pixels.length > 0 ? findSceneSky(pixels) : undefined;
  return sky ? windowColoursOfSky(sky) : undefined;
};

/**
 * The darkest a window's floor is taken from a scene's busiest colour. The
 * window colours chosen by hand for the FluidEQ scenes sit at 0.20 to 0.25
 * (OKLab): dark enough to be a night's floor, light enough to still carry
 * the scene's hue.
 */
const FLOOR_LIGHTNESS = 0.24;
/**
 * From here up a busiest colour is a light ground - a snowfield, a white
 * marble - and is kept: a dark window takes its hue, and a light window
 * stays white whatever the surface (`pickedWindow.ts`).
 */
const LIGHT_GROUND_LIGHTNESS = 0.82;

/** `colour` as the floor or the panes the window can wear it as. */
const groundOf = (colour: ISceneColour): string =>
  colour.lightness >= LIGHT_GROUND_LIGHTNESS
    ? hexOf(colour)
    : hexOf({
        ...colour,
        lightness: Math.min(colour.lightness, FLOOR_LIGHTNESS),
      });

/**
 * The hue nearest `hue` that a glow can take: one that says neither off nor
 * wait (`clearsWarningHues`) and, beside an accent of `accentHue`, stands
 * apart from it. The measurement already keeps its colour for "on" clear of
 * both, but judged on ten-degree bins, so the colour itself could still land
 * a few degrees inside either (Nebula Heart's pink beside the red, Ocean's
 * cyan beside its blue).
 */
export const glowHueNear = (hue: number, accentHue?: number): number => {
  const fits = (candidate: number) =>
    clearsWarningHues(candidate) &&
    (accentHue === undefined ||
      hueDistance(candidate, accentHue) >= GLOW_HUE_APART);
  for (let step = 0; step <= 180; step += 1) {
    const found = [hue + step, hue - step]
      .map((candidate) => (candidate + 360) % 360)
      .find(fits);
    if (found !== undefined) {
      return found;
    }
  }
  return hue;
};

/** `base` - one of the theme's filled colours - turned to `hue`. */
export const filledAt = (base: string, hue: number): string => {
  const parsed = parseCssColour(base);
  if (!parsed) {
    return base;
  }
  const lab = rgbToLab(parsed.rgb);
  return labToHex(
    toward({ l: lab.l, a: 0, b: 0 }, Math.hypot(lab.a, lab.b), hue, 1),
  );
};

/**
 * THE DETERMINISTIC RULE: a scene's colours - measured from its picture, or
 * read off its palette's stops - as three colours a window can wear, for a
 * scene that names none. What the editors show as "the scene's own" and
 * start from, what "Choose them from the palette" writes into a scene, and
 * what a palette scene's window is tinted from. They pass the checks the
 * Studio holds a scene's named colours to (`windowColourCheck.ts`).
 *
 * A scene's busiest colour is a mid-tone nobody chose, and its second colour
 * as measured is too: a measurement gives hues, not colours. So:
 *
 * - the surface is the busiest colour's hue taken down to a night's floor,
 *   or kept as it is when it is a light ground (`groundOf`);
 * - the accent is the theme's own filled accent turned to the scene's
 *   second colour, or to its sky's for a scene strong in one colour - the
 *   very colour the window points with under a measured scene
 *   (`tintThemePalette`) - and the theme's own where the sky is too grey or
 *   faint to lend a hue (`sceneAccentHue`);
 * - the glow is the theme's green turned to the scene's colour for "on", or
 *   a pale light of its sky, moved off red and amber, which say off and wait.
 *
 * They used to be the measured colours as they were, the accent and glow
 * falling back to the sky itself: a scene of one colour showed its busiest
 * mid-tone three times - Crystal's #342942 as surface, accent and glow - and
 * a listener starting from them had near-black buttons worn as named.
 */
export const windowColoursOfSky = (sky: ISceneSky): ISceneWindowColours => {
  const surface = groundOf(sky);
  const accentHue = sceneAccentHue(sky);
  if (accentHue === undefined) {
    return { surface, accent: OCEAN_THEME['--accent'], glow: THEME_ACTIVE };
  }
  // A pale light may share the accent's hue: it reads as a light, not a
  // second colour (`windowColourCheck.ts`).
  const glow = sky.active
    ? filledAt(THEME_ACTIVE, glowHueNear(sky.active.hue, accentHue))
    : labToHex(
        toward(
          { l: PALE_ACTIVE_LIGHTNESS, a: 0, b: 0 },
          isGreySky(sky) ? 0 : PALE_ACTIVE_CHROMA,
          glowHueNear(sky.hue),
          1,
        ),
      );
  return {
    surface,
    accent: filledAt(OCEAN_THEME['--accent'], accentHue),
    glow,
  };
};

/** What of a scene says which colours it lends the window. */
export interface ISceneOwnColourSource extends ISceneColourControls {
  windowColours?: ISceneWindowColours;
}

/**
 * The colours `scene` lends the window: the ones it names, or the ones its
 * palette gives as `values` leave it. Undefined when it says nothing to go
 * by and has to be drawn to be known.
 */
export const sceneWindowColours = (
  scene: ISceneOwnColourSource,
  values?: ISceneColourValues,
): ISceneWindowColours | undefined => {
  if (scene.windowColours) {
    return scene.windowColours;
  }
  const stops = sceneAppColourStops(scene, values);
  return stops ? windowColoursFromStops(stops) : undefined;
};

/** `sceneWindowColours` as the sky the window is tinted from. */
export const sceneOwnSky = (
  scene: ISceneOwnColourSource,
  values?: ISceneColourValues,
): ISceneSky | undefined => {
  const colours = sceneWindowColours(scene, values);
  return colours ? skyFromWindowColours(colours) : undefined;
};
