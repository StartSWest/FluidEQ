/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useMemo, useRef, useState } from 'react';
import type { IResolvedLook } from 'common/customLooks';
import { useRainbowStops } from '../utils/rainbowPalette';
import { useLiveSurface, useThemeShade } from '../utils/theme';
import {
  useLookStill,
  useLookStillsUnavailable,
  type ILookStill,
} from './lookStillStore';
import {
  shippedStillOf,
  useStillWindow,
  type IShippedStillFile,
  type IStillWindow,
} from './lookStills/shippedStill';

/**
 * A look's still on a plate, wherever one is shown: the look picker's tiles
 * (`LookTileArt`) and the pictures in the graph's gallery along the plot's
 * foot (`GalleryLookStill`). Both find a still and name a painted one here,
 * so a still painted for either is the other's too, and the two can never
 * disagree about which picture a look has.
 */

/**
 * The colours a still is drawn in: the window's rainbow, its accent, its
 * ink and its shade. A still kept from other colours is another picture.
 */
export const useStillPaintKey = (): string => {
  const stops = useRainbowStops();
  const accent = useLiveSurface('--accent', '');
  const ink = useLiveSurface('--text-primary', '');
  const shade = useThemeShade();
  return `${stops.join(',')}|${accent}|${ink}|${shade}`;
};

/**
 * What a painted still of `look` is kept under (`lookStillStore.ts`): the
 * whole look, so an edit in the look editor names a new picture, and the
 * colours it was painted in (`useStillPaintKey`).
 */
export const lookStillKey = (look: IResolvedLook, paintKey: string): string =>
  `${JSON.stringify(look)}|${paintKey}`;

export interface IPlateStill {
  /** What a still painted for this plate is kept under. */
  stillKey: string;
  /** The window as the shipped stills see it, and each colour role's ink. */
  stillWindow: IStillWindow;
  /** The still shipped with the app for this look and window, if one is. */
  shipped: IShippedStillFile | undefined;
  /** The still painted in these colours, once it is kept. */
  still: ILookStill | undefined;
  /** What the plate shows: `still`, or until it is in, the one before it. */
  picture: ILookStill | undefined;
  /** No still can be painted this session (`markLookStillsUnavailable`). */
  unavailable: boolean;
  /** The plate went up with no picture, so the one that comes fades in. */
  arriving: boolean;
}

/**
 * Which still a plate shows for `look` in the colours `paintKey` names: the
 * one shipped with the app for the window as it is, or one painted at
 * runtime for a look nobody ships - one the member made or coloured, or a
 * palette that is not shipped. New window colours name a new painted still,
 * and the one shown before it stays on the plate until that is painted, so
 * the plate never goes blank. A still that arrives after the plate is up
 * fades in; one kept, or shipped, is simply there.
 */
export const usePlateStill = (
  look: IResolvedLook,
  paintKey: string,
): IPlateStill => {
  const stillKey = useMemo(
    () => lookStillKey(look, paintKey),
    [look, paintKey],
  );
  const stillWindow = useStillWindow();
  const shipped = shippedStillOf(look, stillWindow);
  const still = useLookStill(stillKey);
  const shownRef = useRef(still);
  shownRef.current = still ?? shownRef.current;
  const picture = shownRef.current;
  const unavailable = useLookStillsUnavailable();
  const [arriving] = useState(picture === undefined && shipped === undefined);
  return {
    stillKey,
    stillWindow,
    shipped,
    still,
    picture,
    unavailable,
    arriving,
  };
};
