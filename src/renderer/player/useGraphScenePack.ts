/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useMemo, useState } from 'react';
import { sceneMakerOf, type TSceneMaker } from 'common/sceneMaker';
import { resolveSceneName, type IScenePack } from 'common/scenePacks';
import type { ISceneWave } from 'common/sceneWave';
import type { TDrawableScene } from '../graph/SceneCanvas';
import type { ISceneTuning } from '../graph/sceneTuner';
import { useSceneLook } from '../utils/graphStyle';
import { useTranslation } from '../utils/I18nContext';
import { loadMemberScene } from '../utils/memberScenes';
import { useListenerParams } from '../utils/sceneParamStore';
import { useListenerResponse } from '../utils/sceneResponseStore';
import { useWatchedSceneWave } from '../utils/sceneWaveStore';
import { loadScenePack } from '../utils/scenePacks';

const isMember = (scene: TDrawableScene) =>
  'kind' in scene && scene.kind === 'member';

/** The graph's Plus visualizer, loaded to play somewhere else. */
export interface IGraphScenePack {
  /** The scene and its version: a new one starts the player from the top. */
  identity: string;
  /** The graph's look id for it: what the desktop background is asked for. */
  lookId: string;
  pack: IScenePack;
  madeBy: TSceneMaker;
  label: string;
  tuning: ISceneTuning | undefined;
  /** The wave the listener watches it with, as the desktop draws it. */
  wave: ISceneWave;
}

/**
 * Where the graph's visualizer stands for a player outside the graph: one of
 * the free looks (`none`), a Plus scene on its way or ready, or one that
 * could not be read — whose place is then the free look's drawing, not an
 * empty box.
 */
export type TGraphScene =
  | { state: 'none' }
  | { state: 'loading' }
  | { state: 'failed' }
  | ({ state: 'ready' } & IGraphScenePack);

type TLoad =
  { key: string; pack: IScenePack } | { key: string; pack: undefined };

/**
 * The Plus visualizer the graph is set to, as the listener has it there —
 * the same pack, their own response, settings and wave for it — loaded for a
 * player outside the graph.
 */
const useGraphScenePack = (): TGraphScene => {
  const { locale } = useTranslation();
  const scene = useSceneLook();
  const lookId = scene?.lookId ?? '';
  const loadKey = scene ? `${lookId}@${scene.revision ?? scene.version}` : '';
  // Plain values, so the loading follows the scene and not every rebuild of
  // the store's object for it.
  const member = scene !== null && isMember(scene);
  const packId = scene !== null && 'id' in scene ? scene.id : undefined;
  const [loaded, setLoaded] = useState<TLoad>();

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
      setLoaded({ key: loadKey, pack: undefined });
      return undefined;
    }
    let isCurrent = true;
    load
      .then((pack) => {
        if (isCurrent) {
          setLoaded({ key: loadKey, pack });
        }
        return undefined;
      })
      // A pack that cannot be read leaves the free look's drawing where the
      // scene would have been; the graph reports the failure where it is
      // looked for.
      .catch(() => {
        if (isCurrent) {
          setLoaded({ key: loadKey, pack: undefined });
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [loadKey, lookId, member, packId]);

  const response = useListenerResponse(lookId);
  const params = useListenerParams(lookId);
  const tuning = useMemo(
    (): ISceneTuning | undefined =>
      response || params
        ? {
            ...(response ? { response } : {}),
            ...(params ? { params } : {}),
          }
        : undefined,
    [params, response],
  );
  const current = loaded?.key === loadKey ? loaded.pack : undefined;
  const wave = useWatchedSceneWave(lookId, current?.wave);

  if (!scene) {
    return { state: 'none' };
  }
  if (!loaded || loaded.key !== loadKey) {
    return { state: 'loading' };
  }
  if (!loaded.pack) {
    return { state: 'failed' };
  }
  return {
    state: 'ready',
    identity: loadKey,
    lookId,
    pack: loaded.pack,
    madeBy: sceneMakerOf({
      member: isMember(scene),
      own: 'own' in scene && scene.own,
    }),
    label: resolveSceneName(loaded.pack, locale),
    tuning,
    wave,
  };
};

export default useGraphScenePack;
