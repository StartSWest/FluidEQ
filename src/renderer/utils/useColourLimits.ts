/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useMemo } from 'react';
import type {
  ISceneWindowColours,
  TSceneWindowColourRole,
} from 'common/sceneWindowColours';
import type { TColourLimit } from './colourLimitField';
import { pickedFilled, pickedFillGround, pickedFloor } from './pickedWindow';
import { hourOfStop, type TWindowColourStop } from './sceneDayColours';

export type TColourLimits = Record<TSceneWindowColourRole, TColourLimit>;

const asIs: TColourLimit = (hex) => hex;

/**
 * What each colour at `stop` may be beside `colours`' surface and accent, as
 * the window's own rule for it there (Ivan, 2026-11-18: "whatever colours are
 * selected are the ones used, and the limit should be on the pickers, not
 * before applying them to the UI"; "whatever limit we have, we show on the
 * pickers for each brightness"). A point's hour is its Brightness, so 0 to 75
 * are the dark window and 100 the white one:
 *
 * - the surface, on a dark point: no lighter than the dark window's words
 *   allow (`pickedFloor`). On the white point it is white and not picked.
 * - the accent and the second colour: a colour a filled control's label
 *   reads on - the floor's colour on a dark point; on the white one the
 *   floor's colour or, on a light colour, the dark ink, and never one almost
 *   as white as the window (`pickedFilled`).
 *
 * Walked by the points: a colour inside its limit is worn exactly as picked.
 */
export const colourLimitsAt = (
  colours: ISceneWindowColours,
  stop: TWindowColourStop,
): TColourLimits => {
  const shade = hourOfStop(stop);
  const floor = pickedFloor(colours.surface, colours.accent, shade, 'points');
  const ground =
    floor === undefined ? undefined : pickedFillGround(floor, shade);
  const filled: TColourLimit = (hex) =>
    (ground && pickedFilled(hex, ground)) ?? hex;
  return {
    surface:
      stop === '100'
        ? asIs
        : (hex) => pickedFloor(hex, colours.accent, shade, 'points') ?? hex,
    accent: filled,
    glow: filled,
  };
};

/**
 * `colours` brought inside `stop`'s limits: the surface first, then the
 * accent and the second colour against the floor that surface makes. What
 * the app works out for a point it was not given - its palette, its picture
 * measured, the blend of the points either side - is shown and worn this
 * way, so an Automatic point never shows a colour the picker would refuse
 * (Ivan, 2026-11-18: "automatic is getting a bad colour despite the limit").
 * A set already inside comes back as it is.
 */
export const withinLimits = (
  colours: ISceneWindowColours,
  stop: TWindowColourStop,
): ISceneWindowColours => {
  const surface = colourLimitsAt(colours, stop).surface(colours.surface);
  const limits = colourLimitsAt({ ...colours, surface }, stop);
  return {
    surface,
    accent: limits.accent(colours.accent),
    glow: limits.glow(colours.glow),
  };
};

/** `colourLimitsAt`, kept by the colours it reads. */
export default function useColourLimits(
  colours: ISceneWindowColours,
  editing: TWindowColourStop,
): TColourLimits {
  const { surface, accent, glow } = colours;
  return useMemo(
    () => colourLimitsAt({ surface, accent, glow }, editing),
    [surface, accent, glow, editing],
  );
}
