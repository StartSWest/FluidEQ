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
import { pickedFilled, pickedFloor } from './pickedWindow';
import { hourOfStop, type TWindowColourStop } from './sceneDayColours';

export type TColourLimits = Record<TSceneWindowColourRole, TColourLimit>;

const asIs: TColourLimit = (hex) => hex;

/**
 * What each colour at `editing`'s point may be, as the window's own rule for
 * it there (Ivan, 2026-11-18: "whatever colours are selected are the ones
 * used, and the limit should be on the pickers, not before applying them to
 * the UI"; "whatever limit we have, we show on the pickers for each
 * brightness"). A point's hour is its Brightness, so 0 to 75 are the dark
 * window and 100 the white one:
 *
 * - the surface, on a dark point: no lighter than the dark window's words
 *   allow (`pickedFloor`). On the white point it is white and not picked.
 * - the accent and the second colour: far enough from that point's floor for
 *   a filled control's label to read - lighter on a dark point, darker on the
 *   white one (`pickedFilled`).
 *
 * A colour inside its limit is worn exactly as picked; the pickers keep the
 * pick inside (`ColourPickerPopover`'s `limit`).
 */
export default function useColourLimits(
  colours: ISceneWindowColours,
  editing: TWindowColourStop,
): TColourLimits {
  const shade = hourOfStop(editing);
  const { surface, accent } = colours;
  return useMemo(() => {
    // Walked by the points: what is picked at a point is worn there exactly.
    const floor = pickedFloor(surface, accent, shade, 'points');
    const filled: TColourLimit = (hex) =>
      (floor && pickedFilled(hex, floor, shade)) ?? hex;
    return {
      surface:
        editing === '100'
          ? asIs
          : (hex) => pickedFloor(hex, accent, shade, 'points') ?? hex,
      accent: filled,
      glow: filled,
    };
  }, [surface, accent, shade, editing]);
}
