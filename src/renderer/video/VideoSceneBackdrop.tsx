/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useMemo, useState } from 'react';
import { resolveSceneName, type IScenePack } from 'common/scenePacks';
import type { TSceneMaker } from '../graph/sceneFlashGuard';
import type { TDrawableScene } from '../graph/SceneCanvas';
import ScenePreview from '../plus/ScenePreview';
import { useSceneLook } from '../utils/graphStyle';
import { useTranslation } from '../utils/I18nContext';
import { loadMemberScene } from '../utils/memberScenes';
import { useListenerParams } from '../utils/sceneParamStore';
import { useListenerResponse } from '../utils/sceneResponseStore';
import { loadScenePack } from '../utils/scenePacks';
import { useGuestTintEnabled } from './guestTintPreference';

const isMember = (scene: TDrawableScene) =>
  'kind' in scene && scene.kind === 'member';

/**
 * Whether the Media page stands over the graph's Plus visualizer.
 *
 * In the video's own full screen only, and only while the page is being shown
 * in FluidEQ's colours: the page's surfaces are made see-through for it
 * (`buildGuestGlassCss`), which is the same kind of change as colouring them
 * and waits on the same choice by the user (`guestTintPreference.ts`).
 */
export const useSceneBehindVideo = (isFullScreen: boolean): boolean => {
  const scene = useSceneLook();
  const isTintOn = useGuestTintEnabled();
  return isFullScreen && isTintOn && scene !== null;
};

/**
 * The graph's Plus visualizer, playing behind the Media page in the video's
 * own full screen, so the page — its chat, comments and suggestions — stands
 * over the scene while the video itself stays solid on top (Ivan, 2026-09-21:
 * "I wanna see the viz behind the YouTube chat and all… not the video").
 *
 * The scene as the listener has it on the graph: the same pack, their own
 * controls and timing for it. Played by the same player every page outside
 * the graph uses, which listens to the music itself and measures its own box;
 * the graph's canvas is hidden in this full screen and stops drawing, so the
 * GPU is doing this one scene, not two.
 */
const VideoSceneBackdrop = () => {
  const { locale } = useTranslation();
  const scene = useSceneLook();
  const lookId = scene?.lookId ?? '';
  const loadKey = scene ? `${lookId}@${scene.revision ?? scene.version}` : '';
  // Plain values, so the loading below follows the scene and not every
  // rebuild of the store's object for it.
  const member = scene !== null && isMember(scene);
  const packId = scene !== null && 'id' in scene ? scene.id : undefined;
  const [loaded, setLoaded] = useState<{ key: string; pack: IScenePack }>();
  const [failedKey, setFailedKey] = useState<string>();

  useEffect(() => {
    if (!loadKey) {
      return undefined;
    }
    let load: Promise<IScenePack | undefined> | undefined;
    if (member) {
      load = loadMemberScene(lookId);
    } else if (packId !== undefined) {
      load = loadScenePack(packId);
    }
    if (!load) {
      return undefined;
    }
    let isCurrent = true;
    load
      .then((pack) => {
        if (isCurrent && pack) {
          setLoaded({ key: loadKey, pack });
        }
        return undefined;
      })
      .catch(() => undefined);
    return () => {
      isCurrent = false;
    };
  }, [loadKey, lookId, member, packId]);

  const chosen = useListenerResponse(lookId);
  const chosenParams = useListenerParams(lookId);
  const tuning = useMemo(
    () =>
      chosen || chosenParams
        ? {
            ...(chosen ? { response: chosen } : {}),
            ...(chosenParams ? { params: chosenParams } : {}),
          }
        : undefined,
    [chosen, chosenParams],
  );

  if (!scene || !loaded || loaded.key !== loadKey || failedKey === loadKey) {
    return null;
  }
  let madeBy: TSceneMaker = 'fluideq';
  if (isMember(scene)) {
    madeBy = 'own' in scene && scene.own ? 'listener' : 'member';
  }
  return (
    <div className="video-browser__scene" aria-hidden="true">
      <ScenePreview
        identity={loadKey}
        madeBy={madeBy}
        pack={loaded.pack}
        label={resolveSceneName(loaded.pack, locale)}
        // A scene that cannot play here leaves the page over the plain
        // window, as it is with no visualizer at all.
        onTrouble={() => setFailedKey(loadKey)}
        tuning={tuning}
      />
    </div>
  );
};

export default VideoSceneBackdrop;
