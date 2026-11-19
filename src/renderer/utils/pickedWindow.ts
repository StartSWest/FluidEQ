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
  MAX_SURFACE_CHROMA,
  SURFACE_CHROMA_PER_LIGHTNESS,
} from './sceneTintPalette';
import {
  DARK_END_SHADE,
  isLightShade,
  lightDimOf,
  themeShadeTokens,
} from './themeShade';
import {
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
 * - A dark surface is worn as named as a dark window's floor, the panes a
 *   step up as every theme shade has them.
 *
 * THE LIGHT WINDOW STAYS WHITE (Ivan, 2026-11-17: "en el brillo white no se
 * pinta la ventana con el tema, se deja white siempre para que el acento se
 * pueda ver"). Past `DARK_END_SHADE` no surface tints the panes, named or
 * measured, and the greys, edges and words lean to no hue: the accent and
 * the glow are the only colour there, which is what lets them be seen. A
 * light named surface (a marble, a snowfield) used to be worn as the panes
 * and a dark one whispered its hue into them.
 *
 * THE BRIGHTNESS ALONE SAYS LIGHT OR DARK (Ivan, 2026-11-17, approving the one
 * colour model: option A). A light surface on a dark window lends its hue
 * and nothing else, as a measured sky does. Named colours used to decide
 * the side by their own surface: Crystal's white made a light window at
 * Brightness 10, a pack's dark surface kept a dark one at 100, and a scene
 * with no named colours followed the slider - three answers at one
 * Brightness. A surface picked in the editor never moves the Brightness
 * (Ivan, 2026-11-18, of a pick that jumped the window to 100).
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
 * lighter than the theme's own lightest (OKLab 0.52, `themeShade.ts`).
 * Scenes published while only a surface's hue was taken named skies of every
 * lightness, and a violet at 0.45 worn as it was would have set the whole
 * window's words at 4:1.
 */
const DARK_PANE_CEILING = 0.52;

/** The light window's panes, whatever the colours (see above). */
const WHITE: ILab = { l: 1, a: 0, b: 0 };

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
 * Whether a scene's glow can say "on": not on the red or the amber that say
 * off and wait, and not a grey, which says nothing. Where it cannot, the
 * accent stands in for it.
 */
export const isUsableGlow = (glow: ILab): boolean =>
  chromaOf(glow) >= GREY_CHROMA && clearsWarningHues(hueOf(glow));

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
  const isLight = isLightShade(brightness);
  // The light window leans to no hue at all: white panes, neutral greys,
  // edges and words, and the colour only where the accent and glow are.
  const lean = isLight ? undefined : leanOf(surface, accent);
  const isLightSurface = inkForSurface(colours.surface) === 'dark';
  let surfaces: Record<TWindowSurface, string>;
  if (isLight) {
    surfaces = lightSurfaces(WHITE, undefined, lightDimOf(brightness));
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
  return windowOn(surfaces, accent, isUsableGlow(glow) ? glow : accent, lean);
};

export default pickedWindow;
