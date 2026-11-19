/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useMemo } from 'react';
import { isMemberLookId } from 'common/memberScenes';
import { isPremiumLookId, type TLocalizedName } from 'common/scenePacks';
import type { ISceneWindowColourStops } from 'common/sceneWindowColours';
import { useUsableMemberScenes } from './memberScenes';
import { useSceneColourControls } from './sceneAppColours';
import {
  resolveStopColours,
  stopKeyOf,
  type IResolvedStopColours,
} from './sceneDayColours';
import { sceneWindowColours, windowColoursOfSky } from './sceneOwnColours';
import { useListenerParams } from './sceneParamStore';
import { useUsableScenes } from './scenePacks';
import { useRememberedSceneSky } from './sceneTintStore';
import { useChosenWindowColourStops } from './sceneWindowColourStore';

export interface ISceneWindowColourState extends IResolvedStopColours {
  /** What the listener chose instead, per point, where they did. */
  chosen: ISceneWindowColourStops;
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
 * The window colours of the scene `lookId` at its five points
 * (`sceneDayColours.ts`): the listener's own at any point, else what its
 * pack names there, else - at the day's two ends - its palette's, else its
 * picture's as measured at that hour (`graph/sceneSky.ts`, which `SceneTint`
 * asks for the ends listed in `measured`).
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
  const daySky = useRememberedSceneSky(key && stopKeyOf(key, '100'));
  const chosen = useChosenWindowColourStops(key);
  return useMemo(() => {
    if (!isScene) {
      return EMPTY;
    }
    const listed = isPremiumLookId(lookId)
      ? scenes.find((entry) => entry.lookId === lookId)
      : memberScenes.find((entry) => entry.lookId === lookId);
    // The palette's colours as the listener's choices leave it; never the
    // pack's named ones, which stand for one point of the day each.
    const palette =
      controls &&
      sceneWindowColours(
        { ...controls, windowColours: undefined },
        params ? { params } : undefined,
      );
    return {
      ...resolveStopColours({
        // A listing from before the points carries the one set alone.
        named:
          listed?.windowColourStops ??
          (listed?.windowColours ? { '0': listed.windowColours } : {}),
        ...(palette ? { palette } : {}),
        measured: {
          ...(nightSky ? { '0': windowColoursOfSky(nightSky) } : {}),
          ...(daySky ? { '100': windowColoursOfSky(daySky) } : {}),
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
    chosen,
  ]);
}
