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
  DARK_END_SHADE,
  isLightShade,
  lightDimOf,
  themeShadeTokens,
} from './themeShade';
import {
  chromaOf,
  filledFace,
  GREY_CHROMA,
  labOf,
  type IFillGround,
} from './windowFill';
import {
  darkInkSet,
  greyRung,
  hueOf,
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
 * - The accent and the glow are worn at their own colour wherever a filled
 *   control's label reads on them - on the white window, a light one with
 *   the window's dark ink for its words - and moved only where none does
 *   (`filledFace`).
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
 * colour model: option A). A light surface on a dark window is worn as dark
 * as that window's words need, its hue and its colour kept (2026-11-18; it
 * lent only its hue at the theme's level until then). Named colours used to decide
 * the side by their own surface: Crystal's white made a light window at
 * Brightness 10, a pack's dark surface kept a dark one at 100, and a scene
 * with no named colours followed the slider - three answers at one
 * Brightness. A surface picked in the editor never moves the Brightness
 * (Ivan, 2026-11-18, of a pick that jumped the window to 100).
 *
 * The Brightness walks each side as it walks the theme, all the way along: a
 * dark window from the named surface at the top of its dark travel down
 * toward black at 0 (`darkenSurfaces`), a light one from white at 100 to the
 * soft grey at the line (`lightDimOf`).
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
 * The theme at the top of its dark travel, which every named dark surface is
 * stood against: worked out once, because the colour picker asks for a
 * window's floor once for every cell of its field.
 */
let darkEndTheme: ReturnType<typeof themeShadeTokens> | undefined;
const darkEnd = () => {
  darkEndTheme ??= themeShadeTokens(DARK_END_SHADE);
  return darkEndTheme;
};

type TSurfaceSet = Partial<Record<TWindowSurface, string>>;

/**
 * The dark window's surfaces: the floor exactly `surface`, every other one
 * standing where the theme's darkest-but-lightest shade (the top of its dark
 * travel) stands it over its floor, as colourful for its lightness.
 */
const darkSurfaces = (
  surface: ILab,
  lean: number | undefined,
  tokens: readonly TWindowSurface[],
): TSurfaceSet => {
  const theme = darkEnd();
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
  const out: TSurfaceSet = {};
  tokens.forEach((token) => {
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
 * Whether a scene's glow can say "on": not on the red or the amber that say
 * off and wait, and not a grey, which says nothing. Where it cannot, the
 * accent stands in for it.
 */
export const isUsableGlow = (glow: ILab): boolean =>
  chromaOf(glow) >= GREY_CHROMA && clearsWarningHues(hueOf(glow));

/**
 * WHO WALKS A NAMED DARK SURFACE THROUGH THE DAY.
 *
 * - `brightness`: one set somebody chose is worn all day, and the Brightness
 *   walks it as it walks the theme - as picked at the top of the dark travel,
 *   down toward black at 0 (`darkenSurfaces`).
 * - `points`: the scene names sets at two or more of its five hours
 *   (`sceneDayColours.ts`, Ivan, 2026-11-18: "we need 4 breakpoints plus
 *   100%"), and the blend of those at the hour is the walk. Darkened again by
 *   the Brightness, a navy picked for the 25 point was worn near black there,
 *   which is not what the person saw when they picked it. Still on the side
 *   of the line the Brightness says, and still out of the mid-greys.
 */
export type TSurfaceWalk = 'brightness' | 'points';

/**
 * The surfaces in `tokens` the window paints for a named `surface` at
 * `brightness`, its greys leaning to `lean`, walked by `walk`.
 */
const surfacesOf = (
  surface: ILab,
  brightness: number,
  lean: number | undefined,
  tokens: readonly TWindowSurface[],
  walk: TSurfaceWalk,
): TSurfaceSet => {
  if (isLightShade(brightness)) {
    return lightSurfaces(WHITE, undefined, lightDimOf(brightness));
  }
  // A light surface is its own colour too, brought down only as far as the
  // dark window's words need (`darkSurfaces`). It used to lend just its hue
  // at the theme's own level: a lavender picked at 50 was worn nearly black,
  // and the picker's field turned darker exactly where its colours turned
  // lighter (Ivan, 2026-11-18: "for 50% brightness those colours are too
  // dark").
  const asPicked = darkSurfaces(surface, lean, tokens);
  if (walk === 'points') {
    return asPicked;
  }
  // Handed them as their own knee, so the walk starts from exactly them, at
  // the top of the dark travel: worn as picked from the middle up, the
  // window stood still from Brightness 38 to 76 under any surface as light
  // as the dark window allows (Ivan, 2026-11-18: "from 50% to 75% it is not
  // changing").
  return darkenSurfaces(asPicked, asPicked, brightness, DARK_END_SHADE);
};

/**
 * Every token the window wears for `colours` at `brightness` (the theme
 * shade, 0 to 100), its surface walked by `walk`, or undefined when one of
 * them cannot be read.
 */
const pickedWindow = (
  colours: ISceneWindowColours,
  brightness: number,
  walk: TSurfaceWalk = 'brightness',
): IWindow | undefined => {
  const surface = labOf(colours.surface);
  const accent = labOf(colours.accent);
  const glow = labOf(colours.glow);
  if (!surface || !accent || !glow) {
    return undefined;
  }
  // The light window leans to no hue at all: white panes, neutral greys,
  // edges and words, and the colour only where the accent and glow are.
  const lean = isLightShade(brightness) ? undefined : leanOf(surface, accent);
  const set = surfacesOf(surface, brightness, lean, WINDOW_SURFACES, walk);
  const surfaces = {} as Record<TWindowSurface, string>;
  WINDOW_SURFACES.forEach((token) => {
    const hex = set[token];
    if (hex !== undefined) {
      surfaces[token] = hex;
    }
  });
  if (WINDOW_SURFACES.some((token) => surfaces[token] === undefined)) {
    return undefined;
  }
  return windowOn(surfaces, accent, isUsableGlow(glow) ? glow : accent, lean);
};

const FLOOR_ONLY: readonly TWindowSurface[] = ['--surface-base'];

/**
 * The floor the window paints for the named `surface` beside `accent` at
 * `brightness`: what a surface is shown as wherever it is picked, so the
 * colour chosen is the colour the window turns (Ivan, 2026-11-18: "we are
 * not matching well the picked colour to the applied one ... at 0 it should
 * not show the full bright spectrum"). The same rule as `pickedWindow`'s,
 * for the floor alone: the picker asks once for every cell of its field.
 */
export const pickedFloor = (
  surface: string,
  accent: string,
  brightness: number,
  walk: TSurfaceWalk = 'brightness',
): string | undefined => {
  const surfaceLab = labOf(surface);
  const accentLab = labOf(accent);
  if (!surfaceLab || !accentLab) {
    return undefined;
  }
  const lean = isLightShade(brightness)
    ? undefined
    : leanOf(surfaceLab, accentLab);
  return surfacesOf(surfaceLab, brightness, lean, FLOOR_ONLY, walk)[
    '--surface-base'
  ];
};

/**
 * What the window paints for a filled control's `colour` - the accent, or
 * the second colour - over the window's `floor` at `brightness`: as picked
 * wherever a label reads on it, else moved only as far as one needs - on the
 * white window darker for the floor's colour or lighter for the dark ink,
 * whichever is nearer, and never as near white as the panes; on a dark one
 * lighter for the floor's colour (`windowOn`'s `filledFace`). What the
 * pickers show an accent and a second colour as, on `pickedFillGround`'s
 * ground.
 */
export const pickedFilled = (
  colour: string,
  ground: IFillGround,
): string | undefined => {
  const lab = labOf(colour);
  return lab ? filledFace(lab, ground).fill : undefined;
};

/**
 * What a filled control stands on at `brightness` over the window's `floor`,
 * worked out once for a picker's whole field. The white window is white
 * whatever was picked (`surfacesOf`), so its panes and ink come from the
 * Brightness alone, as `windowOn` builds them; a dark window's labels are
 * its floor and it has no light fill to hold apart.
 */
export const pickedFillGround = (
  floor: string,
  brightness: number,
): IFillGround => {
  const isLight = isLightShade(brightness);
  if (!isLight) {
    return { floor, pane: floor, ink: floor, isLight };
  }
  const pane = lightSurfaces(WHITE, undefined, lightDimOf(brightness))[
    '--surface-panel'
  ];
  return { floor, pane, ink: darkInkSet(undefined).ink, isLight };
};

export default pickedWindow;
