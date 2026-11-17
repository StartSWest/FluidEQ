/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISceneWindowColours } from 'common/sceneWindowColours';
import { labToHex, type ILab } from './oklab';
import { clearsWarningHues } from './sceneTint';
import { DARK_KNEE, darkenSurfaces } from './sceneTintDark';
import { DARK_END_SHADE, themeShadeTokens } from './themeShade';
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
 * or the three a scene's pack names (`windowColours`) - went through that
 * same rule, so a white surface came out as the theme's dark grey and a deep
 * violet accent as the lilac the scene already gave: the editor said one
 * thing and the window did another. Named colours are worn here as named:
 *
 * - The surface is the panes of a light window (dark ink) or the floor of a
 *   dark one (light ink, the panes a step up as every theme shade has them),
 *   whichever it is by its own luminance (`inkForSurface`).
 * - The accent and the glow are worn at their own colour, moved only as far
 *   as a filled control's label needs to read on them (`windowOn`).
 *
 * The Brightness moves it below the middle of its dark travel
 * (`DARK_KNEE`): a dark window walks down toward black as a scene's colours
 * do (`darkenSurfaces`), a light one toward a soft grey and never back to
 * dark. From the knee up the colours are exactly as picked.
 */

/**
 * How far a light window walks down at Brightness 0, in OKLab lightness: a
 * soft grey, still plainly light with dark words.
 */
const LIGHT_DIM = 0.12;

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
  const below = Math.max(0, 1 - Math.max(0, brightness) / DARK_KNEE);
  let surfaces: Record<TWindowSurface, string>;
  if (inkForSurface(colours.surface) === 'dark') {
    const panes = atL(surface, Math.max(surface.l, LIGHT_PANE_FLOOR));
    surfaces = lightSurfaces(panes, lean, LIGHT_DIM * below);
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

export default pickedWindow;
