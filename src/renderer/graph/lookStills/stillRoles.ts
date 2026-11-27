/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { isOneColour } from '../../utils/levelRamp';
import { getRainbowStops } from '../../utils/rainbowPalette';
import {
  readAccent,
  readAccentLight,
  readEdge,
  readInk,
  readSurface,
  readTextInk,
} from '../../utils/theme';
import { windowFloor, windowLevelRamps } from '../../utils/windowInk';
import { isLightWindow } from '../../utils/windowSide';
import { getWindowTintSecondary } from '../../utils/windowTint';
import { mateColours } from '../analysis/channelInk';
import { cityTowerColours } from '../citySkyline';
import type { TStillColours, TStillSide } from './stillSize';

/**
 * THE WINDOW'S COLOURS A SHIPPED STILL IS PAINTED IN.
 *
 * A standard look's still in the look picker is made ahead of time
 * (`scripts/look-stills`) and shipped, so the picker shows every look on its
 * first frame (Ivan, 2026-11-26: "they should be just an svg of a single
 * frame ... just the single frame we load"). The look draws in the window's
 * colours, which change with the accent, the Tint's second colour, the
 * Brightness and a scene's tint, so a still cannot be a fixed picture: it is
 * one layer per colour the look paints in, each a mask of how much of that
 * colour lands on each pixel, plus a layer of what is drawn in fixed inks.
 * The window lays each colour into its layer (`ShippedLookStill`), and the
 * still wears whatever colours the window wears, the moment it wears them.
 *
 * A role is one colour the window hands the drawings, read here exactly as
 * the drawings read it, so the colour in a layer is the colour the look
 * would have painted. The generator renders every look under many sets of
 * these colours and solves, pixel by pixel, how much of each one lands
 * there; a role a look never paints in comes out empty and is left out.
 *
 * The drawing is a sum of these colours only where it treats them as
 * colours - fills, gradients and glows made of them. Where it derives a new
 * colour of its own (a hue turned, a ramp built in OKLab), that colour is a
 * role of its own here, worked out the same way, or the still would carry a
 * linear guess at it. Add a role here when a drawing starts reading a colour
 * that is not one; the generator's check says which looks it would serve.
 */

export {
  STILL_COLOURS,
  STILL_SIDES,
  type TStillColours,
  type TStillSide,
} from './stillSize';

export const stillSide = (): TStillSide => (isLightWindow() ? 'light' : 'dark');

/**
 * As `windowLevelRamps` decides it: one colour while the Tint has no second
 * colour and the stops are, to the eye, one.
 */
export const stillColours = (): TStillColours =>
  getWindowTintSecondary() === undefined && isOneColour(getRainbowStops())
    ? 'one'
    : 'many';

/** A level ramp's length (`levelRampOf`). */
const LEVEL_STOPS = 5;
/** The window's stops (`RAINBOW_STOP_COUNT`). */
const STOPS = 7;
/** The Skyline's concrete, street to roofline (`cityTowerColours`). */
const TOWER_STEPS = 3;

type TReadRole = () => string | undefined;

const at =
  (list: () => readonly string[] | undefined, index: number): TReadRole =>
  () =>
    list()?.[index];

const numbered = (
  prefix: string,
  count: number,
  list: () => readonly string[] | undefined,
): ReadonlyArray<readonly [string, TReadRole]> =>
  Array.from(
    { length: count },
    (_, index) => [`${prefix}-${index}`, at(list, index)] as const,
  );

/**
 * The surfaces the drawings paint with, each through the reader the
 * drawings call, at full strength: a drawing's alpha is its own, and is
 * part of what the generator measures, not of the colour.
 */
const SURFACE_ROLES: ReadonlyArray<readonly [string, TReadRole]> = [
  ['floor', () => `rgb(${windowFloor().join(', ')})`],
  // The Skyline's concrete: the floor lifted in OKLab (`cityTowerColours`).
  ...numbered('tower', TOWER_STEPS, cityTowerColours),
  ['ink', () => readInk(1)],
  ['edge', () => readEdge(1)],
  ['accent', () => readAccent(1, '#00e5cf')],
  ['accent-light', () => readAccentLight(1, '#a1fcff')],
  ['text-faint', readTextInk],
  ['text-primary', () => readSurface('--text-primary', '#e8f1f8')],
  ['text-muted', () => readSurface('--text-muted', '#8fa6b8')],
  ['panel', () => readSurface('--surface-panel', '#0f2133')],
  ['active', () => readSurface('--active', '#54ff8a')],
];

const levelRamps = () => windowLevelRamps([]);

/**
 * One colour: the stop, its turned copy for a second reading
 * (`mateColours`: the right channel, the side), and the ramps a level
 * raster climbs, built from the stop and from the secondary against the
 * ground (`windowLevelRamps`).
 */
const ONE_ROLES: ReadonlyArray<readonly [string, TReadRole]> = [
  ['stop', at(getRainbowStops, 0)],
  ['mate', () => mateColours(getRainbowStops().slice(0, 1))[0]],
  ...numbered('level', LEVEL_STOPS, () => levelRamps()?.colours),
  ...numbered('level-mate', LEVEL_STOPS, () => levelRamps()?.mate),
  ...SURFACE_ROLES,
];

/** Seven stops, and their turned copies. */
const MANY_ROLES: ReadonlyArray<readonly [string, TReadRole]> = [
  ...numbered('stop', STOPS, getRainbowStops),
  ...numbered('mate', STOPS, () => mateColours(getRainbowStops())),
  ...SURFACE_ROLES,
];

const ROLES: Record<
  TStillColours,
  ReadonlyArray<readonly [string, TReadRole]>
> = { one: ONE_ROLES, many: MANY_ROLES };

/**
 * Roles only one look paints in, offered to that look alone. The Skyline's
 * concrete is the floor lifted a step, so in every other look it stands in
 * for the floor nearly as well as the floor does - and on the white window
 * the generator took it for the Waterfall's and the Synthwave's floor, and
 * the lift that does not follow the floor's colour put both visibly off.
 */
const OWN_ROLES: Readonly<Record<string, string>> = {
  'tower-0': 'skyline',
  'tower-1': 'skyline',
  'tower-2': 'skyline',
};

/**
 * Every role a still of `style` in `colours` can be painted in, in a fixed
 * order.
 */
export const stillRoleNames = (
  colours: TStillColours,
  style: string,
): readonly string[] =>
  ROLES[colours]
    .map(([name]) => name)
    .filter((name) => (OWN_ROLES[name] ?? style) === style);

/**
 * The colour of each role as the window would hand it to a drawing now, as
 * a CSS colour; a role the window has no colour for (a ramp it would not
 * build) is left out.
 */
export const readStillRoles = (
  colours: TStillColours,
): Readonly<Record<string, string>> => {
  const read: Record<string, string> = {};
  ROLES[colours].forEach(([name, readRole]) => {
    const colour = readRole();
    if (colour) {
      read[name] = colour;
    }
  });
  return read;
};
