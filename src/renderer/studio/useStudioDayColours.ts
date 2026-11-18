/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useMemo } from 'react';
import type { IScenePack } from 'common/scenePacks';
import type { ISceneWindowColours } from 'common/sceneWindowColours';
import {
  dayKeyOf,
  resolveDayColours,
  type IResolvedDayColours,
} from '../utils/sceneDayColours';
import { windowColoursOfSky } from '../utils/sceneOwnColours';
import { studioSkyKey, useRememberedSceneSky } from '../utils/sceneTintStore';

/**
 * The Studio project's window colours, night and day (`sceneDayColours.ts`):
 * what its pack names for each time, else `palette`'s all day, else its
 * picture's as last measured at that hour for the project
 * (`measureStudioSky`). The same rule as a graph look's, so the window, the
 * Tune card and the graph never disagree about a scene.
 */
export default function useStudioDayColours(
  project: string | undefined,
  pack: IScenePack | undefined,
  palette: ISceneWindowColours | undefined,
): IResolvedDayColours {
  const key = project ? studioSkyKey(project) : '';
  const nightSky = useRememberedSceneSky(key);
  const daySky = useRememberedSceneSky(key && dayKeyOf(key));
  return useMemo(
    () =>
      resolveDayColours({
        named: {
          ...(pack?.windowColours ? { night: pack.windowColours } : {}),
          ...(pack?.windowColoursDay ? { day: pack.windowColoursDay } : {}),
        },
        ...(palette ? { palette } : {}),
        measured: {
          ...(nightSky ? { night: windowColoursOfSky(nightSky) } : {}),
          ...(daySky ? { day: windowColoursOfSky(daySky) } : {}),
        },
        chosen: {},
      }),
    [pack, palette, nightSky, daySky],
  );
}
