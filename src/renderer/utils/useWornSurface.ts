/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback } from 'react';
import { usePageDaylight } from '../graph/sceneDaylight';
import { pickedFloor } from './pickedWindow';
import {
  blendColourBetween,
  coloursAtHour,
  hourOfStop,
  isWalkedByBrightness,
  setsOfSides,
  stopColoursAt,
  stopsAround,
  withChosenStop,
  type TSceneStopColours,
  type TWindowColourStop,
} from './sceneDayColours';
import { useThemeShade } from './theme';

/**
 * What the window paints for a surface picked at `editing`'s point, now: the
 * point's set with that surface in it, chosen, blended with the points
 * either side at the scene's hour as the window blends them
 * (`coloursAtHour`), and worn at the Brightness the window is at
 * (`pickedFloor`), walked as the window walks it - by the Brightness while
 * one set is chosen, by the points once two are (`isWalkedByBrightness`).
 * The colour pickers show every colour as this (Ivan, 2026-11-18: "we are
 * not matching well the picked colour to the applied one ... at 0 it should
 * not show the full bright spectrum").
 *
 * Kept by the strings it reads, not the sets: the editors build new sets on
 * every step of a drag, and the picker paints its whole field again whenever
 * this changes.
 */
export default function useWornSurface(
  sides: TSceneStopColours,
  editing: TWindowColourStop,
): (surface: string) => string {
  const shade = useThemeShade();
  const hour = Math.round(usePageDaylight());
  // The open point holds a set the moment anything is picked there: its own,
  // or the blend it showed while it was Automatic.
  const base =
    sides[editing]?.colours ?? stopColoursAt(sides, hourOfStop(editing));
  const drafted = base ? withChosenStop(sides, editing, base) : sides;
  const sets = setsOfSides(drafted);
  const around = stopsAround(sets, hour);
  const accent = coloursAtHour(sets, hour)?.accent;
  const walk = isWalkedByBrightness(drafted) ? 'brightness' : 'points';
  const from = around?.from;
  const to = around?.to;
  const share = around?.share ?? 0;
  const fromSurface = from === undefined ? undefined : sets[from]?.surface;
  const toSurface = to === undefined ? undefined : sets[to]?.surface;
  return useCallback(
    (surface: string) => {
      if (accent === undefined || fromSurface === undefined) {
        return surface;
      }
      const start = from === editing ? surface : fromSurface;
      const end = to === editing ? surface : (toSurface ?? start);
      const worn = from === to ? start : blendColourBetween(start, end, share);
      return pickedFloor(worn, accent, shade, walk) ?? surface;
    },
    [editing, from, to, share, fromSurface, toSurface, accent, walk, shade],
  );
}
