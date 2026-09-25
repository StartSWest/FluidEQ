/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef, useState } from 'react';
import { lightingProfile } from 'common/lighting/lightingProfiles';
import {
  useLiveAudioCapture,
  useLiveAudioControl,
} from '../audio/LiveAudioContext';
import { usePlusEntitled } from '../plus/GalleryParts';
import useLampIdleClock from './lampIdleClock';
import { createLampPlayer, type ILampPlayer } from './lampScenePlay';
import { loadLampScene, useLampScene } from './lampScene';
import { publishLightingPreview } from './lightingPreview';
import { useLighting } from './lightingStore';

/**
 * The lamps' loop: while a Plus member has dynamic lighting on and a Plus
 * look chosen, the scene is drawn small for the devices on the audio clock
 * and the picture sent to the main process.
 *
 * Mounted once, at the root, and renders nothing — it has to run whichever tab
 * is open and while the window is minimised, which is the whole point of a lit
 * desk. It holds the capture as work rather than display for the same reason:
 * hiding the window must not take the music away from the lamps.
 *
 * The lamps go out for exactly four things: the look chosen is not a Plus one,
 * the membership lapses, the switch goes off, or the window closes. Nothing
 * else starts them again either: the scene the graph can or cannot draw this
 * moment, the capture Windows restarts and a new version of the scene are all
 * taken in by the one player (`lampScenePlay.ts`). Silence keeps the scene
 * flowing at the member's idle settings, and so does having no capture at
 * all: the lamps then follow a silence of their own (`lampIdleClock.ts`), so
 * the desk lights up as FluidEQ opens, music or not, window shown or not.
 */
export default function DynamicLightingLoop() {
  const { state, loaded } = useLighting();
  const entitled = usePlusEntitled();
  const scene = useLampScene();
  const { capture, isPaused } = useLiveAudioControl();
  const wanted =
    loaded &&
    state.supported &&
    state.settings.enabled &&
    entitled &&
    scene !== null;
  useLiveAudioCapture(wanted, 'work');
  const idleClock = useLampIdleClock(wanted && !capture);

  const pausedRef = useRef(isPaused);
  pausedRef.current = isPaused;
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const profileRef = useRef(
    lightingProfile(state.settings.profiles, scene?.lookId),
  );
  profileRef.current = lightingProfile(state.settings.profiles, scene?.lookId);

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

  const [player, setPlayer] = useState<ILampPlayer>();
  useEffect(() => {
    const api = window.electron?.ipcRenderer;
    if (!wanted || !api?.sendLightingFrame) {
      return undefined;
    }
    const created = createLampPlayer({
      isPaused: () => pausedRef.current,
      profile: () => profileRef.current,
      onFrame: (frame, image) => {
        api.sendLightingFrame(frame);
        publishLightingPreview(frame, image);
      },
      onCannotHear: () => {
        api.releaseLighting?.();
        publishLightingPreview(undefined);
      },
    });
    setPlayer(created);
    return () => {
      created.close();
      setPlayer(undefined);
    };
  }, [wanted]);

  // Keyed on the scene's identity — the look and the content it is at — so
  // a store refresh that rebuilds the same summary loads nothing.
  const identity = scene?.identity;
  useEffect(() => {
    const shown = sceneRef.current;
    if (!player || !shown) {
      return undefined;
    }
    let cancelled = false;
    const show = (pack?: Parameters<ILampPlayer['show']>[0]['pack']) =>
      player.show({
        sceneId: shown.lookId,
        pack,
        guarded: shown.guarded,
        swatch: shown.swatch,
      });
    loadLampScene(shown)
      .then((pack) => {
        if (!cancelled) {
          show(pack);
        }
        return undefined;
      })
      .catch(() => {
        // The bridge failed, not the scene: its colours light the desk.
        if (!cancelled) {
          show(undefined);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [player, identity]);

  // The music while it can be heard, the lamps' own silence while it cannot.
  // A capture that failed used to give the devices back until it came, and
  // one refused attempt after attempt while the window was hidden left the
  // desk dark until the window was shown.
  useEffect(() => {
    player?.hear(capture ?? idleClock);
  }, [player, capture, idleClock]);

  return null;
}
