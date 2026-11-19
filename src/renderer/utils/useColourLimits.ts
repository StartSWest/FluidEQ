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
import { pickedFilled, pickedFillGround, pickedFloor } from './pickedWindow';
import { isLightShade } from './themeShade';

/** The window's own rule for a colour: what it would wear for it. */
export type TColourLimit = (hex: string) => string;

export type TColourLimits = Record<TSceneWindowColourRole, TColourLimit>;

const asIs: TColourLimit = (hex) => hex;

/**
 * What each colour may be at the Brightness `shade`, beside `colours`'
 * surface and accent, as the window's own rule for it there (Ivan,
 * 2026-11-18: "whatever colours are selected are the ones used, and the
 * limit should be on the pickers, not before applying them to the UI"):
 *
 * - the surface, on a dark window: no lighter than the dark window's words
 *   allow (`pickedFloor`), which is how it is worn at the top of the dark
 *   travel; on the white window it is white and not picked.
 * - the accent and the second colour: a colour a filled control's label
 *   reads on at that Brightness (`pickedFilled`).
 */
export const colourLimitsAt = (
  colours: ISceneWindowColours,
  shade: number,
): TColourLimits => {
  const ground = pickedFillGround(colours.surface, colours.accent, shade);
  const filled: TColourLimit = (hex) =>
    (ground && pickedFilled(hex, ground)) ?? hex;
  return {
    surface: isLightShade(shade)
      ? asIs
      : (hex) => pickedFloor(hex, colours.accent, shade, 'points') ?? hex,
    accent: filled,
    glow: filled,
  };
};

/**
 * `colours` brought inside the limits at `shade`: the surface first, then the
 * accent and the second colour against the floor that surface makes. What
 * the app works out for a point it was not given - its palette, its picture
 * measured, the blend of the points either side - is shown and worn this
 * way, so an Automatic point never shows a colour the picker would refuse
 * (Ivan, 2026-11-18: "automatic is getting a bad colour despite the limit").
 * A set already inside comes back as it is.
 */
export const withinLimits = (
  colours: ISceneWindowColours,
  shade: number,
): ISceneWindowColours => {
  const surface = colourLimitsAt(colours, shade).surface(colours.surface);
  const limits = colourLimitsAt({ ...colours, surface }, shade);
  return {
    surface,
    accent: limits.accent(colours.accent),
    glow: limits.glow(colours.glow),
  };
};

/** `colourLimitsAt`, kept by the colours it reads. */
export default function useColourLimits(
  colours: ISceneWindowColours,
  shade: number,
): TColourLimits {
  const { surface, accent, glow } = colours;
  return useMemo(
    () => colourLimitsAt({ surface, accent, glow }, shade),
    [surface, accent, glow, shade],
  );
}
