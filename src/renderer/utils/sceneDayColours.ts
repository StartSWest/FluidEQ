/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// Relative, not through the `common/` alias: the Studio agent's door in main
// reads the blend too (`windowColourCheck.ts`), and main cannot load alias
// paths at run time.
import {
  SCENE_DAYLIGHT_MAX,
  SCENE_DAYLIGHT_MIN,
} from '../../common/sceneDaylight';
import {
  SCENE_WINDOW_COLOUR_ROLES,
  type ISceneWindowColours,
} from '../../common/sceneWindowColours';
import { labToHex, parseCssColour, rgbToLab } from './oklab';

/**
 * A SCENE'S WINDOW COLOURS BY ITS TIME OF DAY (Ivan, 2026-11-18: "allow users
 * to pick two colours too, and the app preselects colours automatically; if
 * users don't pick them, the app does the same while playing"). Each scene
 * has a set for its night (Daylight 0) and one for its day (Daylight 100),
 * each from wherever it comes - the listener's choice, the scene's pack, its
 * palette, or its picture measured at that hour - and the window wears the
 * blend of the two at the hour the scene is played at.
 */

export type TWindowTime = 'night' | 'day';
export const WINDOW_TIMES: readonly TWindowTime[] = ['night', 'day'];

/** Where a set of a scene's colours comes from, most deliberate first. */
export type TWindowColourSource = 'chosen' | 'named' | 'palette' | 'measured';

export interface ISceneColourSide {
  colours: ISceneWindowColours;
  source: TWindowColourSource;
}

export type TSceneDayColours = Partial<Record<TWindowTime, ISceneColourSide>>;

/**
 * Where something kept per scene keeps its day's copy: the remembered skies
 * (`sceneTintStore.ts`) and the listener's choices
 * (`sceneWindowColourStore.ts`) are keyed by look id, and the night's stays
 * under the id itself, which is what every reader before this already reads.
 */
export const dayKeyOf = (key: string) => `${key}@day`;

/** `time`'s key for something kept per scene under `key`. */
export const timeKeyOf = (key: string, time: TWindowTime) =>
  time === 'day' ? dayKeyOf(key) : key;

/** The Daylight each set is measured and named at. */
export const DAYLIGHT_OF: Record<TWindowTime, number> = {
  night: SCENE_DAYLIGHT_MIN,
  day: SCENE_DAYLIGHT_MAX,
};

/** Under this chroma a colour has no hue worth turning through. */
const GREY_CHROMA = 0.02;

interface ILch {
  l: number;
  c: number;
  h: number;
}

const lchOf = (hex: string): ILch | undefined => {
  const parsed = parseCssColour(hex);
  if (!parsed) {
    return undefined;
  }
  const lab = rgbToLab(parsed.rgb);
  return {
    l: lab.l,
    c: Math.hypot(lab.a, lab.b),
    h: ((Math.atan2(lab.b, lab.a) * 180) / Math.PI + 360) % 360,
  };
};

/**
 * `from` turned `share` of the way to `to` in OKLCH: lightness and chroma
 * straight, hue the short way round. A green night turning to a blue day
 * passes through teal; mixed in OKLab it would pass through grey, and a
 * grey accent at dusk points with nothing. A grey end has no hue of its own
 * and takes the other's, so it only gains or loses colour.
 */
export const blendColour = (
  from: string,
  to: string,
  share: number,
): string => {
  const a = lchOf(from);
  const b = lchOf(to);
  if (!a || !b) {
    return share < 0.5 ? from : to;
  }
  const greyEnd = a.c < GREY_CHROMA || b.c < GREY_CHROMA;
  const start = a.c < GREY_CHROMA ? b.h : a.h;
  const turn = greyEnd ? 0 : ((b.h - a.h + 540) % 360) - 180;
  const h = (((start + turn * share) % 360) + 360) % 360;
  const c = a.c + (b.c - a.c) * share;
  const radians = (h * Math.PI) / 180;
  return labToHex({
    l: a.l + (b.l - a.l) * share,
    a: c * Math.cos(radians),
    b: c * Math.sin(radians),
  });
};

/** How far through the day `daylight` is: 0 its night, 1 its day. */
export const dayShareOf = (daylight: number): number =>
  Math.min(
    1,
    Math.max(
      0,
      (daylight - SCENE_DAYLIGHT_MIN) /
        (SCENE_DAYLIGHT_MAX - SCENE_DAYLIGHT_MIN),
    ),
  );

/** The window's colours at `daylight` (0 night to 100 day) between two sets. */
export const blendWindowColours = (
  night: ISceneWindowColours,
  day: ISceneWindowColours,
  daylight: number,
): ISceneWindowColours => {
  const share = dayShareOf(daylight);
  if (share === 0) {
    return night;
  }
  if (share === 1) {
    return day;
  }
  const out = {} as Record<(typeof SCENE_WINDOW_COLOUR_ROLES)[number], string>;
  SCENE_WINDOW_COLOUR_ROLES.forEach((role) => {
    out[role] = blendColour(night[role], day[role], share);
  });
  return out;
};

/**
 * What `sides` paint at `daylight`: their blend, or the one set there is
 * all day. Undefined when the scene has neither yet.
 */
export const dayColoursAt = (
  sides: TSceneDayColours,
  daylight: number,
): ISceneWindowColours | undefined => {
  const night = sides.night?.colours;
  const day = sides.day?.colours;
  // One set is all day, exactly: blended with itself, a colour can come
  // back a step off through the round trip into OKLCH.
  if (!night || !day) {
    return night ?? day;
  }
  return blendWindowColours(night, day, daylight);
};

/**
 * Whether the window wears `sides` as named (`pickedWindow.ts`): as soon as
 * either set is somebody's choice - the listener's, or the pack's - the
 * blend is worn as it is. Sets the app worked out on its own only lend their
 * hue, as a measured sky always has.
 */
export const isWornAsNamed = (sides: TSceneDayColours) =>
  WINDOW_TIMES.some((time) => {
    const source = sides[time]?.source;
    return source === 'chosen' || source === 'named';
  });

export interface IDaySources {
  /** What the scene's pack names for each time. */
  named: Partial<Record<TWindowTime, ISceneWindowColours>>;
  /** Its palette's colours, which hold all day; absent with no palette. */
  palette?: ISceneWindowColours;
  /** Its picture's colours as measured at each time, where measured. */
  measured: Partial<Record<TWindowTime, ISceneWindowColours>>;
  /** What the person editing chose instead, per time. */
  chosen: Partial<Record<TWindowTime, ISceneWindowColours>>;
}

export interface IResolvedDayColours {
  /** Each time's colours as worn: the choice, else the scene's own. */
  sides: TSceneDayColours;
  /** Each time's colours without the choice. */
  own: TSceneDayColours;
  /** The times only a drawing of the scene can give colours for. */
  measured: TWindowTime[];
}

/**
 * Where each time's colours come from, most deliberate first: the choice,
 * the pack's, the palette's, the picture's. One rule for the graph's looks,
 * the Studio's project and both editors.
 */
export const resolveDayColours = (
  sources: IDaySources,
): IResolvedDayColours => {
  const own: TSceneDayColours = {};
  const sides: TSceneDayColours = {};
  const measured: TWindowTime[] = [];
  WINDOW_TIMES.forEach((time) => {
    let side: ISceneColourSide | undefined;
    const named = sources.named[time];
    if (named) {
      side = { colours: named, source: 'named' };
    } else if (sources.palette) {
      side = { colours: sources.palette, source: 'palette' };
    } else {
      measured.push(time);
      const picture = sources.measured[time];
      if (picture) {
        side = { colours: picture, source: 'measured' };
      }
    }
    if (side) {
      own[time] = side;
    }
    const choice = sources.chosen[time];
    const worn: ISceneColourSide | undefined = choice
      ? { colours: choice, source: 'chosen' }
      : side;
    if (worn) {
      sides[time] = worn;
    }
  });
  return { sides, own, measured };
};

/** Two sets as one text, compared by value by the effects that paint them. */
export const dayColoursKey = (sides: TSceneDayColours) =>
  WINDOW_TIMES.map((time) => {
    const side = sides[time];
    return side
      ? `${time}:${side.source}:${side.colours.surface}${side.colours.accent}${side.colours.glow}`
      : `${time}:-`;
  }).join(' ');
