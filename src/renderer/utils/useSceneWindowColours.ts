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
import { sceneWindowColours, windowColoursOfSky } from './sceneOwnColours';
import { useListenerParams } from './sceneParamStore';
import { useUsableScenes } from './scenePacks';
import { useRememberedSceneSky } from './sceneTintStore';
import { useChosenWindowColours } from './sceneWindowColourStore';

export interface ISceneWindowColourState {
  /**
   * The scene's own: the colours it names, else those its palette gives as
   * the listener's choices leave it. Undefined for a scene that says neither.
   */
  declared?: ISceneWindowColours;
  /**
   * What the editor starts from and "Use the scene's colours" goes back to:
   * the declared colours, else the measured sky's. Undefined for a scene that
   * has not been measured yet either.
   */
  own?: ISceneWindowColours;
  /** What the listener chose instead, when they did. */
  chosen?: ISceneWindowColours;
  /** The scene's names, from its listing, for the editor's heading. */
  names?: TLocalizedName;
}

/** The window colours of the scene `lookId`, as the window should wear them. */
export default function useSceneWindowColours(
  lookId: string,
): ISceneWindowColourState {
  const isScene = isPremiumLookId(lookId) || isMemberLookId(lookId);
  const scenes = useUsableScenes();
  const memberScenes = useUsableMemberScenes();
  const controls = useSceneColourControls(isScene ? lookId : '');
  const params = useListenerParams(lookId);
  const measured = useRememberedSceneSky(isScene ? lookId : '');
  const chosen = useChosenWindowColours(isScene ? lookId : '');
  return useMemo(() => {
    if (!isScene) {
      return {};
    }
    const listed = isPremiumLookId(lookId)
      ? scenes.find((entry) => entry.lookId === lookId)
      : memberScenes.find((entry) => entry.lookId === lookId);
    const declared =
      listed?.windowColours ??
      (controls &&
        sceneWindowColours(controls, params ? { params } : undefined));
    const own = declared ?? (measured && windowColoursOfSky(measured));
    return {
      ...(listed ? { names: listed.names } : {}),
      ...(declared ? { declared } : {}),
      ...(own ? { own } : {}),
      ...(chosen ? { chosen } : {}),
    };
  }, [
    isScene,
    lookId,
    scenes,
    memberScenes,
    controls,
    params,
    measured,
    chosen,
  ]);
}
