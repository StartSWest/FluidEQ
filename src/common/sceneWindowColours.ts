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
 * `windowColoursDay` beside it, in the same shape and read by the same
 * reader, names the colours by day (Daylight 100), and `windowColours` is
 * then the night's: the window blends the two by the scene's time of day
 * (Ivan, 2026-11-18: "allow users to pick two colours too"). Either can be
 * named without the other; the one not named is worked out by the app. A
 * key of its own rather than a field inside `windowColours`, so a FluidEQ
 * older than it reads the night's colours and nothing else.
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
