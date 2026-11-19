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
  SCENE_WINDOW_COLOUR_STOPS,
  type ISceneWindowColours,
  type ISceneWindowColourStops,
  type TSceneWindowColourStop,
} from '../../common/sceneWindowColours';
import { labToHex, parseCssColour, rgbToLab } from './oklab';

/**
 * A SCENE'S WINDOW COLOURS THROUGH ITS DAY, AT FIVE POINTS (Ivan, 2026-11-18:
 * "we need 4 breakpoints plus 100% which is the white one ... we need to
 * actually choose primary and sec also for 100%"). Each of the scene's hours
 * 0, 25, 50, 75 and 100 can hold a set - the listener's choice, or what the
 * scene's pack names - and the window wears the blend of the points either
 * side of the hour the scene is played at. A point with no set of its own is
 * "Automatic": the blend of its neighbours. The two ends also fall back to
 * the scene's palette, then to its picture measured at that hour, which is
 * what the two-point model this replaces did at its night and its day; one
 * set anywhere holds all day.
 */

export type TWindowColourStop = TSceneWindowColourStop;
export const WINDOW_COLOUR_STOPS = SCENE_WINDOW_COLOUR_STOPS;

/** The two points the app works colours out for by itself: the day's ends. */
export const MEASURED_STOPS = ['0', '100'] as const;
export type TMeasuredStop = (typeof MEASURED_STOPS)[number];

const isMeasuredStop = (stop: TWindowColourStop): stop is TMeasuredStop =>
  (MEASURED_STOPS as readonly string[]).includes(stop);

/** Where a set of a scene's colours comes from, most deliberate first. */
export type TWindowColourSource = 'chosen' | 'named' | 'palette' | 'measured';

export interface ISceneColourSide {
  colours: ISceneWindowColours;
  source: TWindowColourSource;
}

export type TSceneStopColours = Partial<
  Record<TWindowColourStop, ISceneColourSide>
>;

/** The scene's hour (its Daylight, 0 to 100) a point stands at. */
export const hourOfStop = (stop: TWindowColourStop): number => Number(stop);

/** The point nearest `daylight`; halfway between two, the later one. */
export const nearestStop = (daylight: number): TWindowColourStop => {
  let best: TWindowColourStop = WINDOW_COLOUR_STOPS[0];
  WINDOW_COLOUR_STOPS.forEach((stop) => {
    if (
      Math.abs(hourOfStop(stop) - daylight) <=
      Math.abs(hourOfStop(best) - daylight)
    ) {
      best = stop;
    }
  });
  return best;
};

/**
 * Where something kept per scene keeps a point's copy: the remembered skies
 * (`sceneTintStore.ts`) and the listener's choices
 * (`sceneWindowColourStore.ts`) are keyed by look id, and the 0 point's stays
 * under the id itself, which is what every reader before the points already
 * reads.
 */
export const stopKeyOf = (key: string, stop: TWindowColourStop) =>
  stop === '0' ? key : `${key}@${stop}`;

/**
 * A key written by the two-point model, as the point it stands for: its
 * day's copy (`<key>@day`) is the 100 point's.
 */
export const migrateStopKey = (key: string) =>
  key.endsWith('@day') ? stopKeyOf(key.slice(0, -'@day'.length), '100') : key;

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

/** `from` turned `share` toward `to`, exactly either end at 0 and 1. */
export const blendColourBetween = (
  from: string,
  to: string,
  share: number,
): string => {
  if (share <= 0) {
    return from;
  }
  return share >= 1 ? to : blendColour(from, to, share);
};

/** Two sets mixed `share` of the way from `from` to `to`, exact at the ends. */
export const mixWindowColours = (
  from: ISceneWindowColours,
  to: ISceneWindowColours,
  share: number,
): ISceneWindowColours => {
  if (share <= 0) {
    return from;
  }
  if (share >= 1) {
    return to;
  }
  const out = {} as Record<(typeof SCENE_WINDOW_COLOUR_ROLES)[number], string>;
  SCENE_WINDOW_COLOUR_ROLES.forEach((role) => {
    out[role] = blendColour(from[role], to[role], share);
  });
  return out;
};

/** `daylight` held to the scene's day. */
const clampDaylight = (daylight: number) =>
  Math.min(SCENE_DAYLIGHT_MAX, Math.max(SCENE_DAYLIGHT_MIN, daylight));

/**
 * The points either side of `daylight` among those `sets` names, and how far
 * from the first to the second the hour stands. Before the first point named
 * the first holds, after the last the last: one set is all day. Undefined
 * when `sets` names none.
 */
export const stopsAround = (
  sets: ISceneWindowColourStops,
  daylight: number,
):
  | { from: TWindowColourStop; to: TWindowColourStop; share: number }
  | undefined => {
  const named = WINDOW_COLOUR_STOPS.filter((stop) => sets[stop] !== undefined);
  if (named.length === 0) {
    return undefined;
  }
  const hour = clampDaylight(daylight);
  const first = named[0];
  const last = named[named.length - 1];
  if (hour <= hourOfStop(first)) {
    return { from: first, to: first, share: 0 };
  }
  if (hour >= hourOfStop(last)) {
    return { from: last, to: last, share: 0 };
  }
  const nextIndex = named.findIndex((stop) => hourOfStop(stop) > hour);
  const from = named[nextIndex - 1];
  const to = named[nextIndex];
  const share = (hour - hourOfStop(from)) / (hourOfStop(to) - hourOfStop(from));
  return { from, to, share };
};

/**
 * The window's colours at `daylight` (0 night to 100 day) from the sets named
 * at the points: the blend of the two either side, or the one there is all
 * day. Undefined when no point holds a set.
 */
export const coloursAtHour = (
  sets: ISceneWindowColourStops,
  daylight: number,
): ISceneWindowColours | undefined => {
  const around = stopsAround(sets, daylight);
  if (!around) {
    return undefined;
  }
  const from = sets[around.from];
  const to = sets[around.to];
  // One point, or the hour on one, is that set exactly: blended with
  // itself, a colour can come back a step off through the round trip into
  // OKLCH.
  if (!from || !to || around.from === around.to) {
    return from ?? to;
  }
  return mixWindowColours(from, to, around.share);
};

/** The colours each point of `sides` holds, without where they come from. */
export const setsOfSides = (
  sides: TSceneStopColours,
): Partial<Record<TWindowColourStop, ISceneWindowColours>> => {
  const sets: Partial<Record<TWindowColourStop, ISceneWindowColours>> = {};
  WINDOW_COLOUR_STOPS.forEach((stop) => {
    const side = sides[stop];
    if (side) {
      sets[stop] = side.colours;
    }
  });
  return sets;
};

/** What `sides` paint at `daylight`; undefined with no point holding a set. */
export const stopColoursAt = (
  sides: TSceneStopColours,
  daylight: number,
): ISceneWindowColours | undefined =>
  coloursAtHour(setsOfSides(sides), daylight);

/**
 * Whether a point's set is somebody's choice - the listener's, the member's
 * or the AI's in the Studio, or the pack's - rather than one the app worked
 * out: a keyframe.
 */
export const isKeyframe = (side: ISceneColourSide | undefined) =>
  side?.source === 'chosen' || side?.source === 'named';

/** How many of `sides`' points are keyframes. */
export const keyframeCount = (sides: TSceneStopColours) =>
  WINDOW_COLOUR_STOPS.filter((stop) => isKeyframe(sides[stop])).length;

/**
 * Whether the window wears `sides` as named (`pickedWindow.ts`): as soon as
 * any point is somebody's choice the blend is worn as it is. Sets the app
 * worked out on its own only lend their hue, as a measured sky always has.
 */
export const isWornAsNamed = (sides: TSceneStopColours) =>
  keyframeCount(sides) > 0;

export interface IStopSources {
  /** What the scene's pack names at each point. */
  named: ISceneWindowColourStops;
  /** Its palette's colours, for the day's two ends; absent with no palette. */
  palette?: ISceneWindowColours;
  /** Its picture's colours as measured at each end, where measured. */
  measured: Partial<Record<TMeasuredStop, ISceneWindowColours>>;
  /** What the person editing chose instead, per point. */
  chosen: ISceneWindowColourStops;
  /**
   * What a set the app works out for a point - its palette's, its picture's -
   * is brought to there: the theme's floor for that point and inside its
   * limits (`automaticAt`). Kept out of this file, which main reads too and
   * the window's rules are not.
   */
  within?: (
    colours: ISceneWindowColours,
    stop: TWindowColourStop,
  ) => ISceneWindowColours;
}

export interface IResolvedStopColours {
  /** Each point's colours as worn: the choice, else the scene's own. */
  sides: TSceneStopColours;
  /** Each point's colours without the choice. */
  own: TSceneStopColours;
  /** The ends only a drawing of the scene can give colours for. */
  measured: TMeasuredStop[];
}

/**
 * Where each point's colours come from, most deliberate first: the choice,
 * the pack's, and at the two ends the palette's, then the picture's. One
 * rule for the graph's looks, the Studio's project and both editors.
 */
export const resolveStopColours = (
  sources: IStopSources,
): IResolvedStopColours => {
  const own: TSceneStopColours = {};
  const sides: TSceneStopColours = {};
  const measured: TMeasuredStop[] = [];
  WINDOW_COLOUR_STOPS.forEach((stop) => {
    let side: ISceneColourSide | undefined;
    const named = sources.named[stop];
    if (named) {
      side = { colours: named, source: 'named' };
    } else if (isMeasuredStop(stop)) {
      const worked = (colours: ISceneWindowColours) =>
        sources.within ? sources.within(colours, stop) : colours;
      if (sources.palette) {
        side = { colours: worked(sources.palette), source: 'palette' };
      } else {
        measured.push(stop);
        const picture = sources.measured[stop];
        if (picture) {
          side = { colours: worked(picture), source: 'measured' };
        }
      }
    }
    if (side) {
      own[stop] = side;
    }
    const choice = sources.chosen[stop];
    const worn: ISceneColourSide | undefined = choice
      ? { colours: choice, source: 'chosen' }
      : side;
    if (worn) {
      sides[stop] = worn;
    }
  });
  return { sides, own, measured };
};

/** The points as one text, compared by value by the effects that paint them. */
export const stopColoursKey = (sides: TSceneStopColours) =>
  WINDOW_COLOUR_STOPS.map((stop) => {
    const side = sides[stop];
    return side
      ? `${stop}:${side.source}:${side.colours.surface}${side.colours.accent}${side.colours.glow}`
      : `${stop}:-`;
  }).join(' ');

/** `sides` with `colours` chosen at `stop`, as a picker shows it moving. */
export const withChosenStop = (
  sides: TSceneStopColours,
  stop: TWindowColourStop,
  colours: ISceneWindowColours,
): TSceneStopColours => ({
  ...sides,
  [stop]: { colours, source: 'chosen' },
});
