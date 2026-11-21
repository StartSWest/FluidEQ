/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The colours a scene lends the window around it (Ivan, 2026-11-14: "we want
 * the agent to give those colours"): `"windowColours": { "surface":
 * "#1d2b4f", "accent": "#5fd4ff", "glow": "#ff8fd0" }` in `pack.json`.
 *
 * - `surface` is the window's own colour, worn as named on the side of the
 *   line the listener's Brightness is on: a dark one is the floor of a dark
 *   window, a light one the panes of a light window with dark words, one in
 *   between is moved to the readable side, and on the other side of the line
 *   it lends only its hue (`renderer/utils/pickedWindow.ts`, 2026-11-17).
 * - `accent` is what the buttons, the switches and the kickers point with:
 *   the scene's second colour, the one in front of its sky.
 * - `glow` is the colour for "on" and the window's ambient glow: a third
 *   colour of the scene, clearly apart from the accent.
 *
 * FIVE POINTS THROUGH THE DAY (Ivan, 2026-11-18: "we need 4 breakpoints plus
 * 100% which is the white one ... so we have 5 break points for all
 * colors"). `windowColourStops` names a set for any of the scene's hours 0,
 * 25, 50, 75 and 100 - `{ "0": {...}, "75": {...} }`, only the points the
 * scene has an opinion about - and the window blends between the points
 * named by the hour the scene is played at. `windowColours` stays beside it
 * as one set (the 0 point, or the first one named), so a FluidEQ older than
 * the points reads one set and nothing else; `windowColoursDay`, the day's
 * set of the two-point model the points replace, is still written as the
 * 100 point and read as it (`sceneWindowColourStopsOf` says which wins).
 *
 * Until this existed the window measured a scene by drawing it, which is a
 * guess made differently on every computer, with a scene's settings left
 * at their defaults, and after the scene had already appeared in its swatch's
 * colour. A scene that says what it wants is shown in that from its first
 * frame, on every machine. One that says nothing is given colours from its
 * own palette by a fixed rule (`renderer/utils/sceneOwnColours.ts`).
 *
 * NO IMPORTS, on purpose: the signing function vendors this file into Deno as
 * it is, so what the server signs and what the app plays are the same bytes.
 * The server's deploy flattens every module into one file, so a helper here
 * takes a name no other vendored module uses.
 */

export const SCENE_WINDOW_COLOUR_ROLES = ['surface', 'accent', 'glow'] as const;
export type TSceneWindowColourRole = (typeof SCENE_WINDOW_COLOUR_ROLES)[number];

/** Each role as `#rrggbb`, in lower case. */
export type ISceneWindowColours = Readonly<
  Record<TSceneWindowColourRole, string>
>;

const WINDOW_COLOUR_HEX = /^#[0-9a-fA-F]{6}$/;

const isWindowColourRecord = (
  value: unknown,
): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * `value` as a scene's window colours, or undefined. All three or none: a
 * scene that names an accent and no surface is not saying what its window
 * looks like, and half its colours chosen by the scene and half by the app's
 * rule would be two scenes' colours at once. Anything else in the object is
 * left behind.
 */
export const readSceneWindowColours = (
  value: unknown,
): ISceneWindowColours | undefined => {
  if (!isWindowColourRecord(value)) {
    return undefined;
  }
  const hex = (role: TSceneWindowColourRole) => {
    const colour = value[role];
    return typeof colour === 'string' && WINDOW_COLOUR_HEX.test(colour)
      ? colour.toLowerCase()
      : undefined;
  };
  const surface = hex('surface');
  const accent = hex('accent');
  const glow = hex('glow');
  return surface && accent && glow ? { surface, accent, glow } : undefined;
};

/**
 * What is wrong with a project's `windowColours`, for its author: `missing`
 * when there are none, `bad` when they are there and are not three `#rrggbb`
 * colours, undefined when they are fine.
 */
export const windowColoursProblem = (
  value: unknown,
): 'missing' | 'bad' | undefined => {
  if (value === undefined) {
    return 'missing';
  }
  return readSceneWindowColours(value) ? undefined : 'bad';
};

/**
 * The scene's hours a set can be named at, as `windowColourStops`' keys: its
 * night (0), three steps through the day, and its day (100) - on a white
 * window, where the surface is always white and only the accent and the glow
 * colour it.
 */
export const SCENE_WINDOW_COLOUR_STOPS = [
  '0',
  '25',
  '50',
  '75',
  '100',
] as const;
export type TSceneWindowColourStop = (typeof SCENE_WINDOW_COLOUR_STOPS)[number];

/** The sets a scene names by hour; only the points it names are present. */
export type ISceneWindowColourStops = Readonly<
  Partial<Record<TSceneWindowColourStop, ISceneWindowColours>>
>;

const isSceneWindowColourStop = (key: string): key is TSceneWindowColourStop =>
  (SCENE_WINDOW_COLOUR_STOPS as readonly string[]).includes(key);

/**
 * `value` as `windowColourStops`, or undefined when it names no point. A
 * point whose set is not three colours, or a key that is not one of the five
 * hours, is left behind like anything else the reader does not know.
 */
export const readSceneWindowColourStops = (
  value: unknown,
): ISceneWindowColourStops | undefined => {
  if (!isWindowColourRecord(value)) {
    return undefined;
  }
  const stops: Partial<Record<TSceneWindowColourStop, ISceneWindowColours>> =
    {};
  SCENE_WINDOW_COLOUR_STOPS.forEach((stop) => {
    const colours = readSceneWindowColours(value[stop]);
    if (colours) {
      stops[stop] = colours;
    }
  });
  return Object.keys(stops).length > 0 ? stops : undefined;
};

/**
 * The one set a FluidEQ older than the points reads (`windowColours`): the
 * 0 point, else the first point named.
 */
export const firstSceneWindowColourStop = (
  stops: ISceneWindowColourStops,
): ISceneWindowColours | undefined =>
  SCENE_WINDOW_COLOUR_STOPS.map((stop) => stops[stop]).find(
    (colours) => colours !== undefined,
  );

/** Whether two sets are the same three colours. */
export const sameWindowColourSet = (
  left: ISceneWindowColours,
  right: ISceneWindowColours | undefined,
) =>
  right !== undefined &&
  left.surface === right.surface &&
  left.accent === right.accent &&
  left.glow === right.glow;

/**
 * Every point a pack's `raw` names. Without `windowColourStops`, the
 * two-point keys are the points: `windowColours` the 0 point and
 * `windowColoursDay` the 100 point. With it, the points are its; a two-point
 * key that disagrees with what the app writes beside them (the first point,
 * and the 100 point) was changed since by something that knows only that
 * key - an older FluidEQ, or the scene's AI using the old name - and is the
 * newer word for its point. A server that keeps only the two-point keys
 * hands back a pack read the first way, which is two of the points.
 */
export const sceneWindowColourStopsOf = (
  raw: Readonly<Record<string, unknown>>,
): ISceneWindowColourStops | undefined => {
  const night = readSceneWindowColours(raw.windowColours);
  const day = readSceneWindowColours(raw.windowColoursDay);
  const named = readSceneWindowColourStops(raw.windowColourStops);
  if (!named) {
    const legacy: Partial<Record<TSceneWindowColourStop, ISceneWindowColours>> =
      {
        ...(night ? { '0': night } : {}),
        ...(day ? { '100': day } : {}),
      };
    return Object.keys(legacy).length > 0 ? legacy : undefined;
  }
  return {
    ...named,
    ...(night && !sameWindowColourSet(night, firstSceneWindowColourStop(named))
      ? { '0': night }
      : {}),
    ...(day && !sameWindowColourSet(day, named['100']) ? { '100': day } : {}),
  };
};

/**
 * The keys a pack carries for `stops`, in the shape every reader above reads
 * back as `stops`: the points, the one set an older FluidEQ reads, and the
 * 100 point under its two-point name. No points, no keys.
 */
export const sceneWindowColourKeys = (
  stops: ISceneWindowColourStops | undefined,
): {
  windowColours?: ISceneWindowColours;
  windowColoursDay?: ISceneWindowColours;
  windowColourStops?: ISceneWindowColourStops;
} => {
  const first = stops && firstSceneWindowColourStop(stops);
  if (!stops || !first) {
    return {};
  }
  const ordered: Partial<Record<TSceneWindowColourStop, ISceneWindowColours>> =
    {};
  SCENE_WINDOW_COLOUR_STOPS.forEach((stop) => {
    const colours = stops[stop];
    if (colours) {
      ordered[stop] = { ...colours };
    }
  });
  const day = stops['100'];
  return {
    windowColours: { ...first },
    ...(day ? { windowColoursDay: { ...day } } : {}),
    windowColourStops: ordered,
  };
};

/**
 * What is wrong with a pack's `windowColourStops`, for its author: `bad`
 * when it is there and is not an object of the five hours, each three
 * `#rrggbb` colours; undefined when it is absent or fine.
 */
export const windowColourStopsProblem = (value: unknown): 'bad' | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (!isWindowColourRecord(value)) {
    return 'bad';
  }
  const keys = Object.keys(value);
  return keys.length > 0 &&
    keys.every(
      (key) =>
        isSceneWindowColourStop(key) &&
        readSceneWindowColours(value[key]) !== undefined,
    )
    ? undefined
    : 'bad';
};
