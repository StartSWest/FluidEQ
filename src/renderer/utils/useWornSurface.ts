/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useMemo } from 'react';
import type { ISceneWindowColours } from 'common/sceneWindowColours';
import { usePageDaylight } from '../graph/sceneDaylight';
import { pickedFloor } from './pickedWindow';
import { blendColour, dayShareOf, type TWindowTime } from './sceneDayColours';
import { useThemeShade } from './theme';

/** `from` turned `share` toward `to`, exactly either end at 0 and 1. */
const between = (from: string, to: string, share: number) => {
  if (share <= 0) {
    return from;
  }
  return share >= 1 ? to : blendColour(from, to, share);
};

/**
 * What the window paints for a surface picked for `editing`'s colours, now:
 * that surface blended with the other time's at the scene's hour, as the
 * window blends them (`dayColoursAt`), and worn at the Brightness the window
 * is at (`pickedFloor`). The colour pickers show every colour as this (Ivan,
 * 2026-11-18: "we are not matching well the picked colour to the applied one
 * ... at 0 it should not show the full bright spectrum"): the Brightness
 * decides how light the window's floor is, so a bright blue picked at Night
 * is worn nearly black, and the swatch said bright blue.
 *
 * Kept by the strings it reads, not the sets: the editors build new sets on
 * every step of a drag, and the picker paints its whole field again whenever
 * this changes.
 */
export default function useWornSurface(
  night: ISceneWindowColours,
  day: ISceneWindowColours,
  editing: TWindowTime,
): (surface: string) => string {
  const shade = useThemeShade();
  const share = dayShareOf(Math.round(usePageDaylight()));
  const other = editing === 'night' ? day.surface : night.surface;
  const accent = useMemo(
    () => between(night.accent, day.accent, share),
    [night.accent, day.accent, share],
  );
  return useCallback(
    (surface: string) => {
      const worn =
        editing === 'night'
          ? between(surface, other, share)
          : between(other, surface, share);
      return pickedFloor(worn, accent, shade) ?? surface;
    },
    [editing, other, share, accent, shade],
  );
}
