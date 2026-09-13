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
import type { IScenePack } from 'common/scenePacks';
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

/**
 * About two seconds of silence, counted in audio, before the devices are
 * given back. Shorter, and the gap between two tracks hands the desk to
 * Synapse's own effect and takes it again a moment later.
 */
const SILENCE_RELEASE_MS = 2000;

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
 * membership lapsing, the switch going off, two seconds of silence, the window
 * closing. Each one is `release`, and the main process ends Razer's session
 * and the Windows helper on it.
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
  const [pack, setPack] = useState<IScenePack | undefined>();
  const swatch = scene?.swatch;
  const swatchRef = useRef(swatch);
  swatchRef.current = swatch;

  useEffect(() => {
    if (!wanted || !scene) {
      setPack(undefined);
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
        setPack(loadedPack);
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
    if (!wanted || !capture || !pack || !api?.sendLightingFrame) {
      return undefined;
    }
    let closed = false;
    let listener: ILightingListener | undefined;
    let failed = false;
    let silentMs = 0;
    let lit = false;
    const colours = swatchColours(swatchRef.current ?? []);
    const fallback = new Uint8Array(
      LIGHTING_GRID_WIDTH * LIGHTING_GRID_HEIGHT * 3,
    );

    const send = (frame: ILightingFrame) => {
      lit = true;
      api.sendLightingFrame(frame);
      publishLightingPreview(frame);
    };
    const giveBack = () => {
      if (lit) {
        lit = false;
        api.releaseLighting();
        publishLightingPreview(undefined);
      }
    };

    const player = createLightingScene(
      (grid) => {
        if (closed) {
          return;
        }
        send({
          width: LIGHTING_GRID_WIDTH,
          height: LIGHTING_GRID_HEIGHT,
          rgb: grid.rgb,
          level: grid.level,
          beat: grid.beat,
          bass: grid.bass,
          mid: grid.mid,
          treble: grid.treble,
          deltaMs: grid.deltaMs,
        });
      },
      () => {
        failed = true;
      },
    );
    player.load(pack);

    const accent = parseAccent(
      getComputedStyle(document.documentElement).getPropertyValue('--accent'),
    );
    startLightingListener(
      capture,
      accent,
      () => pausedRef.current,
      ({ frame, silent }) => {
        if (closed) {
          return;
        }
        if (silent) {
          silentMs += frame.deltaMs;
          if (silentMs >= SILENCE_RELEASE_MS) {
            giveBack();
          }
          return;
        }
        silentMs = 0;
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
        });
      },
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
        console.error(
          'Dynamic lighting could not listen to the output:',
          error,
        );
      });

    return () => {
      closed = true;
      listener?.close();
      player.close();
      giveBack();
    };
  }, [wanted, capture, pack]);

  return null;
}
