/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISceneWindowColours } from 'common/sceneWindowColours';
import { labToHex, parseCssColour, rgbToLab } from './oklab';
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
  if (!sky) {
    return undefined;
  }
  const accent = sky.accent ?? sky;
  return {
    surface: hexOf(sky),
    accent: hexOf(accent),
    glow: hexOf(sky.active ?? accent),
  };
};

/**
 * A measured sky as the three colours, for a scene that names none and has
 * no palette: what the editors show as "the scene's own" and start from.
 */
export const windowColoursOfSky = (sky: ISceneSky): ISceneWindowColours => {
  const accent = sky.accent ?? sky;
  return {
    surface: hexOf(sky),
    accent: hexOf(accent),
    glow: hexOf(sky.active ?? accent),
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
