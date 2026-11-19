/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  sameWindowColourSet,
  type ISceneWindowColours,
} from 'common/sceneWindowColours';
import { hueDistance, labToHex, toward, type ILab } from './oklab';
import { hourOfStop, type TWindowColourStop } from './sceneDayColours';
import { filledAt, glowHueNear, windowColoursOfSky } from './sceneOwnColours';
import {
  ACCENT_CLEAR_CHROMA,
  clearsWarningHues,
  type ISceneColour,
  type ISceneSky,
} from './sceneTint';
import {
  isGreySky,
  MAX_SURFACE_CHROMA,
  PALE_ACTIVE_CHROMA,
  PALE_ACTIVE_LIGHTNESS,
  SURFACE_CHROMA_PER_LIGHTNESS,
} from './sceneTintPalette';
import {
  DARK_END_SHADE,
  OCEAN_THEME,
  THEME_ACTIVE,
  themeShadeTokens,
} from './themeShade';
import { withinLimits } from './useColourLimits';
import { chromaOf, labOf } from './windowFill';
import { GLOW_HUE_APART } from './windowColourCheck';

/**
 * THE COLOURS THE APP WORKS OUT FOR A POINT OF A SCENE'S DAY, AND THE ONES
 * "AUTOMATIC" FINDS (Ivan, 2026-11-19: "that button is for always finding
 * colour. Every time the user clicks it, it will scan the scene for that
 * brightness and try to find the true colour for that").
 *
 * Colours somebody chose - the listener, the member, the scene's AI - are
 * worn exactly as picked (`pickedWindow.ts`). Colours the app works out for
 * itself, from a palette or a picture, are not anybody's pick, so they keep
 * the theme's own floor for the point's Brightness: what every theme shade
 * has always stood on.
 */

/**
 * The floor's lightness at each point, from the theme at that point's
 * Brightness. Worked out once a point: `themeShadeTokens` builds the whole
 * table, and the editors ask on every render.
 */
const floorLightness = new Map<TWindowColourStop, number>();

const floorAt = (stop: TWindowColourStop): number => {
  const known = floorLightness.get(stop);
  if (known !== undefined) {
    return known;
  }
  // The white point's surface paints nothing - the white window's panes are
  // white whatever it says - and only stands in the blends of the points
  // before it. It stands at the top of the dark travel, so an automatic
  // point between walks the theme's own ladder up toward it.
  const shade = stop === '100' ? DARK_END_SHADE : hourOfStop(stop);
  const floor = labOf(themeShadeTokens(shade)['--surface-base']);
  const l = floor?.l ?? 0;
  floorLightness.set(stop, l);
  return l;
};

/**
 * `colours` - worked out by the app, never chosen - as a point wears them:
 * the surface's colour at the theme's floor for that point's Brightness,
 * held to the chroma a floor that dark carries, then everything inside the
 * point's limits (`withinLimits`).
 *
 * The cause of "the automatic colour for zero brightness is picking too
 * light a colour for the background" (Ivan, 2026-11-19): since colours are
 * worn as picked (2026-11-18), an app-worked set kept the lightness the
 * picture rule gave it - a night's floor of OKLab 0.24 (`groundOf`), the
 * same at every point - where the theme's floor at Brightness 0 is 0.12.
 * Only clamped to the dark window's ceiling, Alpine's night was #121E39, a
 * navy twice as light as the theme's black. Before, a measured set only
 * lent its hue at the theme's own lightness for the Brightness, and that is
 * what this puts back for app-worked sets alone.
 */
export const automaticAt = (
  colours: ISceneWindowColours,
  stop: TWindowColourStop,
): ISceneWindowColours => {
  // The day's point stands for the scene's one set, worn as it is at the
  // top of the dark travel and darker below.
  const shade = stop === '100' ? DARK_END_SHADE : hourOfStop(stop);
  const surface = labOf(colours.surface);
  if (!surface) {
    return withinLimits(colours, shade);
  }
  const l = floorAt(stop);
  const chroma = Math.min(
    chromaOf(surface),
    SURFACE_CHROMA_PER_LIGHTNESS * l,
    MAX_SURFACE_CHROMA,
  );
  const hue = (Math.atan2(surface.b, surface.a) * 180) / Math.PI;
  const floor: ILab = toward({ l, a: 0, b: 0 }, chroma, hue, 1);
  return withinLimits({ ...colours, surface: labToHex(floor) }, shade);
};

/**
 * A filled control's lightness, from the scene's own colour: never darker
 * than a fill the window's light ink reads on comfortably, never as pale as
 * a pastel, which reads as a colour turned off.
 */
const ACCENT_LIGHTNESS_MIN = 0.55;
const ACCENT_LIGHTNESS_MAX = 0.8;
/**
 * How much more colour a button takes than the picture measured. A measured
 * colour is the mean of a thirty-degree window of hue over every pixel that
 * falls in it, its dim drifts and soft edges included, so it reads quieter
 * than the colour anybody looking at the scene would name: Alpine's violet
 * measures 0.12, under half of the #9B00F7 chosen for it by eye.
 */
const VIVID_LIFT = 1.5;

const accentFrom = (colour: ISceneColour): string => {
  const l = Math.min(
    ACCENT_LIGHTNESS_MAX,
    Math.max(ACCENT_LIGHTNESS_MIN, colour.lightness),
  );
  const ocean = labOf(OCEAN_THEME['--accent']);
  const chroma = Math.max(
    colour.chroma * VIVID_LIFT,
    ocean ? chromaOf(ocean) : 0,
  );
  // Out of the screen's reach, `labToHex` gives up chroma, never lightness.
  return labToHex(toward({ l, a: 0, b: 0 }, chroma, colour.hue, 1));
};

/**
 * The scene's colours a button could wear, best first. A colour somebody
 * would name - as vivid as the measurement's own test for a second colour
 * (`ACCENT_CLEAR_CHROMA`) - comes before a quieter one however much of the
 * frame the quieter covers, and among each, the busier first.
 *
 * The cause of "it's not picking anymore the nice purple on the Alpine"
 * (Ivan, 2026-11-19): Alpine's night is an indigo sky (hue 265, chroma
 * 0.055) with a violet in it (hue 301, chroma 0.12, 1.9% of the frame).
 * The violet stands only 36 degrees from the sky, inside the 50 a second
 * colour must clear (`MIN_ACCENT_SEPARATION`), so the measurement reports no
 * accent and the old rule turned Ocean's cyan to the sky's own hue: the
 * periwinkle #A8C4FF. Ranked here, the violet is the scene's first colour
 * to name, and the sky's hue the next press.
 */
const accentCandidates = (sky: ISceneSky): ISceneColour[] => {
  const pool = sky.palette ?? [sky.accent, sky.active, sky];
  const coloured = pool.filter(
    (colour): colour is ISceneColour => colour !== null && colour.chroma > 0,
  );
  const tier = (colour: ISceneColour) =>
    colour.chroma >= ACCENT_CLEAR_CHROMA ? 0 : 1;
  return [...coloured].sort(
    (left, right) => tier(left) - tier(right) || right.share - left.share,
  );
};

/**
 * "On" beside an accent of `accentHue`: the next of the scene's colours that
 * stands apart from it and says neither off nor wait, as the theme's green
 * turned to it, else a pale light of the sky - the rule `windowColoursOfSky`
 * holds a scene's glow to.
 */
const glowBeside = (
  sky: ISceneSky,
  accentHue: number,
  ranked: readonly ISceneColour[],
): string => {
  const apart = ranked.find(
    (colour) =>
      hueDistance(colour.hue, accentHue) >= GLOW_HUE_APART &&
      clearsWarningHues(colour.hue),
  );
  if (apart) {
    return filledAt(THEME_ACTIVE, glowHueNear(apart.hue, accentHue));
  }
  return labToHex(
    toward(
      { l: PALE_ACTIVE_LIGHTNESS, a: 0, b: 0 },
      isGreySky(sky) ? 0 : PALE_ACTIVE_CHROMA,
      glowHueNear(sky.hue),
      1,
    ),
  );
};

/** The sky's own colour, as a surface `automaticAt` takes down to a floor. */
const surfaceOf = (sky: ISceneSky): string => {
  const radians = (sky.hue * Math.PI) / 180;
  return labToHex({
    l: sky.lightness,
    a: sky.chroma * Math.cos(radians),
    b: sky.chroma * Math.sin(radians),
  });
};

/**
 * Every set the scene's picture `sky` gives the point `stop`, best first,
 * each as the point wears it and no two alike: one per colour of the scene a
 * button could wear (`accentCandidates`), on the sky's own colour as the
 * floor, then the accent and glow of the rule a scene's colours fall back to
 * (`windowColoursOfSky`: the theme's accent turned to the scene's hue) on
 * that same floor, which is the only set a scene of no colour at all has.
 * What Automatic steps through, one a press.
 */
export const sceneColourCandidates = (
  sky: ISceneSky,
  stop: TWindowColourStop,
): ISceneWindowColours[] => {
  const ranked = accentCandidates(sky);
  const surface = surfaceOf(sky);
  const sets = [
    ...ranked.map((colour) => ({
      surface,
      accent: accentFrom(colour),
      glow: glowBeside(
        sky,
        colour.hue,
        ranked.filter((other) => other !== colour),
      ),
    })),
    { ...windowColoursOfSky(sky), surface },
  ].map((colours) => automaticAt(colours, stop));
  return sets.filter(
    (colours, index) =>
      sets.findIndex((other) => sameWindowColourSet(other, colours)) === index,
  );
};

/** What the app works out for `stop` from the picture `sky`: the best set. */
export const automaticOfSky = (
  sky: ISceneSky,
  stop: TWindowColourStop,
): ISceneWindowColours =>
  sceneColourCandidates(sky, stop)[0] ??
  automaticAt(windowColoursOfSky(sky), stop);

/**
 * The set after `current` among `candidates`, and where it stands: the
 * first when `current` is none of them, round to the first again after the
 * last. So every press of Automatic lands on another of the scene's own
 * colours (Ivan, 2026-11-19: "always try to find a new colour"), and a point
 * still wearing the app's best gets the next one rather than itself again.
 */
export const nextCandidate = (
  candidates: readonly ISceneWindowColours[],
  current: ISceneWindowColours | undefined,
): { colours: ISceneWindowColours; index: number } | undefined => {
  if (candidates.length === 0) {
    return undefined;
  }
  const at = current
    ? candidates.findIndex((colours) => sameWindowColourSet(colours, current))
    : -1;
  const index = (at + 1) % candidates.length;
  return { colours: candidates[index], index };
};
