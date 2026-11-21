/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useMemo } from 'react';
import type { IScenePack } from 'common/scenePacks';
import type { ISceneWindowColours } from 'common/sceneWindowColours';
import {
  resolveStopColours,
  stopKeyOf,
  type IResolvedStopColours,
  type TSceneStopColours,
} from '../utils/sceneDayColours';
import { windowColoursOfSky } from '../utils/sceneOwnColours';
import { studioSkyKey, useRememberedSceneSky } from '../utils/sceneTintStore';

/**
 * The Studio project's window colours at its five points
 * (`sceneDayColours.ts`): what its pack names at each, else - at the day's
 * two ends - `palette`'s, else its picture's as last measured at that hour
 * for the project (`measureStudioSky`). The same rule as a graph look's, so
 * the window, the Tune card and the graph never disagree about a scene.
 */
export default function useStudioDayColours(
  project: string | undefined,
  pack: IScenePack | undefined,
  palette: ISceneWindowColours | undefined,
): IResolvedStopColours & {
  /**
   * What the app works out for each end with nothing named: the palette's,
   * or the picture's as measured. What publishing writes into a scene for an
   * end the member left to the app, and how the card tells such colours
   * from chosen ones once they are written.
   */
  automatic: TSceneStopColours;
} {
  const key = project ? studioSkyKey(project) : '';
  const nightSky = useRememberedSceneSky(key);
  const daySky = useRememberedSceneSky(key && stopKeyOf(key, '100'));
  return useMemo(() => {
    const sources = {
      ...(palette ? { palette } : {}),
      measured: {
        ...(nightSky ? { '0': windowColoursOfSky(nightSky) } : {}),
        ...(daySky ? { '100': windowColoursOfSky(daySky) } : {}),
      },
      chosen: {},
    };
    return {
      ...resolveStopColours({
        ...sources,
        named: pack?.windowColourStops ?? {},
      }),
      automatic: resolveStopColours({ ...sources, named: {} }).own,
    };
  }, [pack, palette, nightSky, daySky]);
}
