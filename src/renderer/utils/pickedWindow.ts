/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISceneWindowColours } from 'common/sceneWindowColours';
import { labToHex, type ILab } from './oklab';
import { clearsWarningHues } from './sceneTint';
import { darkenSurfaces } from './sceneTintDark';
import {
  LIGHT_SURFACE_CHROMA,
  MAX_SURFACE_CHROMA,
  SURFACE_CHROMA_PER_LIGHTNESS,
} from './sceneTintPalette';
import {
  DARK_END_SHADE,
  THEME_SHADE_MAX,
  isLightShade,
  lightDimOf,
  themeShadeTokens,
} from './themeShade';
import {
  atL,
  chromaOf,
  GREY_CHROMA,
  greyRung,
  hueOf,
  inkForSurface,
  labOf,
  leanOf,
  lightSurfaces,
  windowOn,
  type IWindow,
} from './windowLight';
import { WINDOW_SURFACES, type TWindowSurface } from './windowTokens';

/**
 * THE WINDOW IN THE COLOURS SOMEBODY PICKED, AS THEY PICKED THEM (Ivan,
 * 2026-11-17: "I changed that scene's colour and the app did not turn light
 * like that ... all the colours of the texts and sliders should adapt too and
 * turn dark").
 *
 * A scene's measured sky only lends the window its hue
 * (`tintThemePalette`): a picture's busiest colour is a mid-tone nobody
 * chose, and the theme's own lightness is what keeps the words readable on
 * it. Colours a person named - the listener's own in the Window colours menu,
 * or the three a scene's pack names (`windowColours`) - are worn here as
 * named:
 *
 * - The accent and the glow are worn at their own colour, moved only as far
 *   as a filled control's label needs to read on them (`windowOn`).
 * - The surface is worn as named when it stands on the side of the line the
 *   Brightness is on: the panes of a light window (Brightness past
 *   `DARK_END_SHADE`), or the floor of a dark one, the panes a step up as
 *   every theme shade has them.
 *
 * THE BRIGHTNESS ALONE SAYS LIGHT OR DARK (Ivan, 2026-11-17, approving the one
 * colour model: option A). A surface on the other side of the line lends its
 * hue and nothing else, as a measured sky does. Named colours used to decide
 * the side by their own surface: Crystal's white made a light window at
 * Brightness 10, a pack's dark surface kept a dark one at 100, and a scene
 * with no named colours followed the slider - three answers at one
 * Brightness. The editor keeps "picking white turns it white" by moving the
 * Brightness across when a surface is picked on the other side
 * (`shadeForPickedSurface`).
 *
 * The Brightness walks each side as it walks the theme: a dark window down
 * toward black below the middle of its dark travel (`darkenSurfaces`), a
 * light one from white at 100 to the soft grey at the line (`lightDimOf`).
 */

/**
 * THE MID-GREYS ARE NOBODY'S WINDOW. Between a dark surface and a light one
 * lies a band where neither white nor black words reach the contrast the
 * text tiers keep (at the crossover neither gets past 4.6:1); the theme's
 * Brightness jumps it (`DARK_END_SHADE`), and a named colour standing in it
 * is moved out of it, keeping its hue and colour: a dark window's panes no
 * lighter than the theme's own lightest (OKLab 0.52, `themeShade.ts`), a
 * light window's panes no darker than this. Scenes published while only a
 * surface's hue was taken named skies of every lightness, and a violet at
 * 0.45 worn as it was would have set the whole window's words at 4:1.
 */
const DARK_PANE_CEILING = 0.52;
const LIGHT_PANE_FLOOR = 0.82;

/**
 * The dark window's surfaces: the floor exactly `surface`, every other one
 * standing where the theme's darkest-but-lightest shade (the top of its dark
 * travel) stands it over its floor, as colourful for its lightness.
 */
const darkSurfaces = (
  surface: ILab,
  lean: number | undefined,
): Record<TWindowSurface, string> => {
  const theme = themeShadeTokens(DARK_END_SHADE);
  const themeFloor = labOf(theme['--surface-base']);
  const themePane = labOf(theme['--surface-panel']);
  const paneStep = themePane && themeFloor ? themePane.l - themeFloor.l : 0;
  // Out of the mid-greys (`DARK_PANE_CEILING`), as colourful for its
  // lightness as it was.
  const floorL = Math.min(surface.l, DARK_PANE_CEILING - paneStep);
  const floorShare = surface.l > 0 ? floorL / surface.l : 1;
  const floor: ILab = {
    l: floorL,
    a: surface.a * floorShare,
    b: surface.b * floorShare,
  };
  const grey = chromaOf(surface) < GREY_CHROMA;
  const out = {} as Record<TWindowSurface, string>;
  WINDOW_SURFACES.forEach((token) => {
    const own = labOf(theme[token]);
    const step = own && themeFloor ? own.l - themeFloor.l : 0;
    const l = floor.l + step;
    if (step === 0) {
      out[token] = labToHex(floor);
      return;
    }
    const share = floor.l > 0 ? l / floor.l : 1;
    out[token] = labToHex(
      grey ? greyRung(l, lean) : { l, a: floor.a * share, b: floor.b * share },
    );
  });
  return out;
};

/** `lab`'s hue at lightness `l`, its chroma held under `ceiling`. */
const hueAt = (lab: ILab, l: number, ceiling: number): ILab => {
  const chroma = chromaOf(lab);
  const share = chroma > 0 ? Math.min(chroma, ceiling) / chroma : 0;
  return { l, a: lab.a * share, b: lab.b * share };
};

/**
 * A light surface on a dark window: the theme's own surfaces at `brightness`,
 * in the surface's hue as a scene's tint colours them
 * (`SURFACE_CHROMA_PER_LIGHTNESS`), grey for a surface with no colour.
 */
const lentDarkSurfaces = (
  surface: ILab,
  brightness: number,
  lean: number | undefined,
): Record<TWindowSurface, string> => {
  const theme = themeShadeTokens(brightness);
  const grey = chromaOf(surface) < GREY_CHROMA;
  const out = {} as Record<TWindowSurface, string>;
  WINDOW_SURFACES.forEach((token) => {
    const own = labOf(theme[token]);
    const l = own?.l ?? 0;
    out[token] = labToHex(
      grey
        ? greyRung(l, lean)
        : hueAt(
            surface,
            l,
            Math.min(MAX_SURFACE_CHROMA, SURFACE_CHROMA_PER_LIGHTNESS * l),
          ),
    );
  });
  return out;
};

/**
 * Every token the window wears for `colours` at `brightness` (the theme
 * shade, 0 to 100), or undefined when one of them cannot be read.
 */
const pickedWindow = (
  colours: ISceneWindowColours,
  brightness: number,
): IWindow | undefined => {
  const surface = labOf(colours.surface);
  const accent = labOf(colours.accent);
  const glow = labOf(colours.glow);
  if (!surface || !accent || !glow) {
    return undefined;
  }
  const lean = leanOf(surface, accent);
  const isLightSurface = inkForSurface(colours.surface) === 'dark';
  let surfaces: Record<TWindowSurface, string>;
  if (isLightShade(brightness)) {
    // White with the surface's colour in it when it is a dark one: as a
    // scene's tint whispers on a light window.
    const panes = isLightSurface
      ? atL(surface, Math.max(surface.l, LIGHT_PANE_FLOOR))
      : hueAt(surface, 1, LIGHT_SURFACE_CHROMA);
    surfaces = lightSurfaces(panes, lean, lightDimOf(brightness));
  } else if (isLightSurface) {
    surfaces = lentDarkSurfaces(surface, brightness, lean);
  } else {
    const asPicked = darkSurfaces(surface, lean);
    // Handed them as their own knee, so the walk starts from exactly them.
    surfaces = darkenSurfaces(asPicked, asPicked, brightness) as Record<
      TWindowSurface,
      string
    >;
  }
  // A glow on the red or the amber that say off and wait is not used for
  // "on", and a grey one says nothing: the accent stands in for it.
  const glowUsable =
    chromaOf(glow) >= GREY_CHROMA && clearsWarningHues(hueOf(glow));
  return windowOn(surfaces, accent, glowUsable ? glow : accent, lean);
};

/**
 * Where the Brightness goes when `surface` is picked at `shade`: unchanged
 * while the surface stands on the Brightness's side of the line; across it
 * otherwise, to where the surface is worn exactly as picked - white panes at
 * 100 for a light one, the top of the dark travel for a dark one, which is
 * past the knee the dark walk starts from. So picking white in the editor
 * still turns the window white, and only the Brightness ever does it.
 */
export const shadeForPickedSurface = (
  surface: string,
  shade: number,
): number => {
  const isLightSurface = inkForSurface(surface) === 'dark';
  if (isLightSurface === isLightShade(shade)) {
    return shade;
  }
  return isLightSurface ? THEME_SHADE_MAX : DARK_END_SHADE;
};

export default pickedWindow;
