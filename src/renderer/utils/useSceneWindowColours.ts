/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useMemo } from 'react';
import { isMemberLookId } from 'common/memberScenes';
import { isPremiumLookId, type TLocalizedName } from 'common/scenePacks';
import type { ISceneWindowColours } from 'common/sceneWindowColours';
import { useUsableMemberScenes } from './memberScenes';
import { useSceneColourControls } from './sceneAppColours';
import {
  dayKeyOf,
  resolveDayColours,
  type IResolvedDayColours,
  type TWindowTime,
} from './sceneDayColours';
import { sceneWindowColours, windowColoursOfSky } from './sceneOwnColours';
import { useListenerParams } from './sceneParamStore';
import { useUsableScenes } from './scenePacks';
import { useRememberedSceneSky } from './sceneTintStore';
import { useChosenWindowColours } from './sceneWindowColourStore';

export interface ISceneWindowColourState extends IResolvedDayColours {
  /** What the listener chose instead, per time, when they did. */
  chosen: Partial<Record<TWindowTime, ISceneWindowColours>>;
  /** The scene's names, from its listing, for the editor's heading. */
  names?: TLocalizedName;
}

const EMPTY: ISceneWindowColourState = {
  sides: {},
  own: {},
  chosen: {},
  measured: [],
};

/**
 * The window colours of the scene `lookId`, night and day
 * (`sceneDayColours.ts`): the listener's own for either time, else what its
 * pack names, else its palette's, else its picture's as measured at that
 * hour (`graph/sceneSky.ts`, which `SceneTint` asks for the times listed in
 * `measured`).
 */
export default function useSceneWindowColours(
  lookId: string,
): ISceneWindowColourState {
  const isScene = isPremiumLookId(lookId) || isMemberLookId(lookId);
  const key = isScene ? lookId : '';
  const scenes = useUsableScenes();
  const memberScenes = useUsableMemberScenes();
  const controls = useSceneColourControls(key);
  const params = useListenerParams(lookId);
  const nightSky = useRememberedSceneSky(key);
  const daySky = useRememberedSceneSky(key && dayKeyOf(key));
  const chosenNight = useChosenWindowColours(key);
  const chosenDay = useChosenWindowColours(key && dayKeyOf(key));
  return useMemo(() => {
    if (!isScene) {
      return EMPTY;
    }
    const listed = isPremiumLookId(lookId)
      ? scenes.find((entry) => entry.lookId === lookId)
      : memberScenes.find((entry) => entry.lookId === lookId);
    // The palette's colours as the listener's choices leave it; never the
    // pack's named ones, which stand for one time of day each.
    const palette =
      controls &&
      sceneWindowColours(
        { ...controls, windowColours: undefined },
        params ? { params } : undefined,
      );
    const chosen = {
      ...(chosenNight ? { night: chosenNight } : {}),
      ...(chosenDay ? { day: chosenDay } : {}),
    };
    return {
      ...resolveDayColours({
        named: {
          ...(listed?.windowColours ? { night: listed.windowColours } : {}),
          ...(listed?.windowColoursDay ? { day: listed.windowColoursDay } : {}),
        },
        ...(palette ? { palette } : {}),
        measured: {
          ...(nightSky ? { night: windowColoursOfSky(nightSky) } : {}),
          ...(daySky ? { day: windowColoursOfSky(daySky) } : {}),
        },
        chosen,
      }),
      chosen,
      ...(listed ? { names: listed.names } : {}),
    };
  }, [
    isScene,
    lookId,
    scenes,
    memberScenes,
    controls,
    params,
    nightSky,
    daySky,
    chosenNight,
    chosenDay,
  ]);
}
