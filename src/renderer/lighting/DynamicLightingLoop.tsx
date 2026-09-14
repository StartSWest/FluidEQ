/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef, useState } from 'react';
import {
  LIGHTING_GRID_HEIGHT,
  LIGHTING_GRID_WIDTH,
  type ILightingFrame,
} from 'common/lighting/lightingModel';
import { isMemberLookId } from 'common/memberScenes';
import type { IScenePack } from 'common/scenePacks';
import { lightingProfile } from 'common/lighting/lightingProfiles';
import {
  useLiveAudioCapture,
  useLiveAudioControl,
} from '../audio/LiveAudioContext';
import type { TDrawableScene } from '../graph/SceneCanvas';
import { parseAccent } from '../graph/sceneUniforms';
import { usePlusEntitled } from '../plus/GalleryParts';
import { useSceneLook } from '../utils/graphStyle';
import {
  loadMemberScene,
  type IUsableMemberScene,
} from '../utils/memberScenes';
import { loadScenePack } from '../utils/scenePacks';
import {
  startLightingListener,
  type ILightingListener,
} from './lightingListener';
import { publishLightingPreview } from './lightingPreview';
import { createLightingScene } from './lightingSceneClient';
import { useLighting } from './lightingStore';
import { fillSwatchGrid, swatchColours } from './swatchGrid';
import { createLightingAtmosphere } from './lightingAtmosphere';

const isMemberScene = (scene: TDrawableScene): scene is IUsableMemberScene =>
  'kind' in scene && scene.kind === 'member';

const sceneKey = (scene: TDrawableScene) =>
  isMemberScene(scene) ? scene.lookId : scene.id;

const loadDrawable = (
  scene: TDrawableScene,
): Promise<IScenePack | undefined> =>
  isMemberScene(scene)
    ? loadMemberScene(scene.lookId)
    : loadScenePack(scene.id);

/**
 * The lamps' loop: while a Plus member has dynamic lighting on and a Plus
 * scene is on the graph, the scene is drawn small for the devices on every
 * tick of the audio clock and the picture sent to the main process.
 *
 * Mounted once, at the root, and renders nothing — it has to run whichever tab
 * is open and while the window is minimised, which is the whole point of a lit
 * desk. It holds the capture as work rather than display for the same reason:
 * hiding the window must not take the music away from the lamps.
 *
 * Every way out gives the devices back: the scene becoming a free look, the
 * membership lapsing, the switch going off, a failed producer, or the window
 * closing. Silence keeps the scene flowing at the member's idle settings.
 */
export default function DynamicLightingLoop() {
  const { state, loaded } = useLighting();
  const entitled = usePlusEntitled();
  const scene = useSceneLook();
  const { capture, isPaused } = useLiveAudioControl();
  const wanted =
    loaded &&
    state.supported &&
    state.settings.enabled &&
    entitled &&
    scene !== null;
  useLiveAudioCapture(wanted, 'work');

  const pausedRef = useRef(isPaused);
  pausedRef.current = isPaused;

  const identity = scene
    ? `${sceneKey(scene)}@${scene.revision ?? scene.version}`
    : '';
  const [loadedScene, setLoadedScene] = useState<{
    pack: IScenePack;
    sceneId: string;
  }>();
  const swatch = scene?.swatch;
  const swatchRef = useRef(swatch);
  swatchRef.current = swatch;
  const profileRef = useRef(
    lightingProfile(state.settings.profiles, loadedScene?.sceneId),
  );
  profileRef.current = lightingProfile(
    state.settings.profiles,
    loadedScene?.sceneId,
  );

  useEffect(() => {
    const release = () => {
      // Optional like every other bridge call here: a window whose preload
      // predates the lighting bridge, or a test's partial one, has no such
      // method, and calling it anyway threw out of this effect and took the
      // whole app's first render with it.
      window.electron?.ipcRenderer?.releaseLighting?.();
      publishLightingPreview(undefined);
    };
    if (!wanted) {
      release();
    }
    return release;
  }, [wanted]);

  useEffect(() => {
    if (!wanted || !scene) {
      setLoadedScene(undefined);
      return undefined;
    }
    let cancelled = false;
    const load = async () => {
      let loadedPack: IScenePack | undefined;
      try {
        loadedPack = await loadDrawable(scene);
      } catch {
        // The bridge failed, not the scene: nothing to light with.
        loadedPack = undefined;
      }
      if (!cancelled) {
        setLoadedScene(
          loadedPack ? { pack: loadedPack, sceneId: scene.lookId } : undefined,
        );
      }
    };
    load().catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // `identity` is the scene and its version; the object itself is rebuilt
    // on unrelated store changes and must not reload the pack.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the scene's identity, see above
  }, [wanted, identity]);

  useEffect(() => {
    const api = window.electron?.ipcRenderer;
    if (!wanted || !capture || !loadedScene || !api?.sendLightingFrame) {
      api?.releaseLighting?.();
      publishLightingPreview(undefined);
      return undefined;
    }
    let closed = false;
    const abort = new AbortController();
    let listener: ILightingListener | undefined;
    let failed = false;
    const atmosphere = createLightingAtmosphere();
    const { sceneId, pack } = loadedScene;
    const colours = swatchColours(swatchRef.current ?? []);
    const fallback = new Uint8Array(
      LIGHTING_GRID_WIDTH * LIGHTING_GRID_HEIGHT * 3,
    );

    const send = (frame: ILightingFrame, image?: ImageBitmap) => {
      api.sendLightingFrame(frame);
      publishLightingPreview(frame, image);
    };
    const player = createLightingScene(
      (grid) => {
        if (closed) {
          grid.preview.close();
          return;
        }
        send(
          {
            width: LIGHTING_GRID_WIDTH,
            height: LIGHTING_GRID_HEIGHT,
            rgb: grid.rgb,
            level: grid.level,
            beat: grid.beat,
            bass: grid.bass,
            mid: grid.mid,
            treble: grid.treble,
            deltaMs: grid.deltaMs,
            sceneId,
            timeSeconds: grid.timeSeconds,
            activity: grid.activity,
            ambient: grid.activity < 0.05,
          },
          grid.preview,
        );
      },
      () => {
        failed = true;
      },
      () => {
        failed = false;
      },
    );
    player.load(pack, isMemberLookId(sceneId));

    const accent = parseAccent(
      getComputedStyle(document.documentElement).getPropertyValue('--accent'),
    );
    startLightingListener(
      capture,
      accent,
      () => pausedRef.current,
      (heard) => {
        if (closed) {
          return;
        }
        const frame = atmosphere(heard, profileRef.current);
        if (!failed) {
          player.draw(frame);
          return;
        }
        send({
          width: LIGHTING_GRID_WIDTH,
          height: LIGHTING_GRID_HEIGHT,
          rgb: fillSwatchGrid(
            colours,
            frame.spectrum,
            LIGHTING_GRID_WIDTH,
            LIGHTING_GRID_HEIGHT,
            fallback,
          ),
          level: frame.level,
          beat: frame.beat,
          bass: frame.bands[0],
          mid: frame.bands[1],
          treble: frame.bands[2],
          deltaMs: frame.deltaMs,
          sceneId,
          timeSeconds: frame.timeSeconds,
          activity: frame.activity,
          ambient: (frame.activity ?? 1) < 0.05,
        });
      },
      abort.signal,
    )
      .then((started) => {
        if (closed) {
          started.close();
          return undefined;
        }
        listener = started;
        return undefined;
      })
      .catch((error: unknown) => {
        if (closed) {
          return;
        }
        api.releaseLighting?.();
        publishLightingPreview(undefined);
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          console.error(
            'Dynamic lighting could not listen to the output:',
            error,
          );
        }
      });

    return () => {
      closed = true;
      abort.abort();
      listener?.close();
      player.close();
    };
  }, [wanted, capture, loadedScene]);

  return null;
}
