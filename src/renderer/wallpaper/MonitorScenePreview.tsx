/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useRef, useState } from 'react';
import type { IScenePack } from 'common/scenePacks';
import type { TSceneMaker } from '../../common/sceneMaker';
import type { IWallpaperWave } from '../../common/wallpaper';
import ScenePreview from '../plus/ScenePreview';
import type { IWallpaperLook } from './wallpaperLooks';

/** A visualizer loaded and able to play in a monitor's glass. */
export interface IMonitorScene {
  /** The look and its version: a new version is a new scene. */
  identity: string;
  pack: IScenePack;
  madeBy: TSceneMaker;
  name: string;
  /** It could not play on this machine: the tile keeps its still frame. */
  fail: () => void;
}

type TLoad = { identity: string; pack: IScenePack | undefined };

/**
 * The look being placed, once it can be played: its pack loaded, and no
 * trouble from playing it. Undefined until then and for a look with nothing
 * to play, so a tile is handed a scene only when one will be on its glass —
 * the glass drops the silhouette it draws for a plain monitor the moment it
 * is handed one (`MonitorFace`), and a scene that never came would have left
 * it blank.
 */
export const useMonitorScene = (
  look: IWallpaperLook,
): IMonitorScene | undefined => {
  const { picture, madeBy, name } = look;
  const identity = picture ? `${picture.lookId}@${picture.version}` : '';
  const [loaded, setLoaded] = useState<TLoad>();
  const [failed, setFailed] = useState<string>();
  // The loader is rebuilt with the dialog's look list; what to load changes
  // only with the identity.
  const loadRef = useRef(picture?.load);
  loadRef.current = picture?.load;

  useEffect(() => {
    const load = loadRef.current;
    if (!identity || !load) {
      return undefined;
    }
    let isCurrent = true;
    load()
      .then((pack) => {
        if (isCurrent) {
          setLoaded({ identity, pack });
        }
        return undefined;
      })
      .catch(() => {
        if (isCurrent) {
          setLoaded({ identity, pack: undefined });
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [identity]);

  const fail = useCallback(() => setFailed(identity), [identity]);
  const pack = loaded?.identity === identity ? loaded.pack : undefined;
  if (!pack || !madeBy || failed === identity) {
    return undefined;
  }
  return { identity, pack, madeBy, name, fail };
};

/**
 * The visualizer being placed, playing in the monitor it is going to: the
 * desktop dialog's answer to "what will this look like there" (Ivan,
 * 2026-09-28, of the Studio's "Put on desktop…": "shows the preview on the
 * desktop"). The app's one player (`ScenePreview`), on the member's music, in
 * the band the desktop will draw it in.
 *
 * Only what it shows: the monitor's tile is the button, so the preview takes
 * no press (`.wallpaper-monitor__scene`) and is hidden from assistive
 * technology, which the tile names.
 */
export default function MonitorScenePreview({
  scene,
  wave,
}: {
  scene: IMonitorScene;
  /** The wave it is being set with; absent, its maker's. */
  wave?: IWallpaperWave;
}) {
  return (
    <span className="wallpaper-monitor__scene" aria-hidden="true">
      <ScenePreview
        identity={scene.identity}
        madeBy={scene.madeBy}
        pack={scene.pack}
        label={scene.name}
        onTrouble={scene.fail}
        wave={wave}
      />
    </span>
  );
}
