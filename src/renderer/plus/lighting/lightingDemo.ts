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
import { DEFAULT_LIGHTING_PROFILE } from 'common/lighting/lightingProfiles';
import type { IScenePack } from 'common/scenePacks';
import {
  useLiveAudioCapture,
  useLiveAudioControl,
} from '../../audio/LiveAudioContext';
import { playLampScene } from '../../lighting/lampScenePlay';
import { publishLightingPreview } from '../../lighting/lightingPreview';
import { fillSwatchGrid, swatchColours } from '../../lighting/swatchGrid';

/**
 * The scene that lights the desk on the Dynamic lighting page of an account
 * without Plus: the same page the member gets, drawn with one scene so what
 * Plus does is on screen rather than described.
 *
 * The scene is the Studio's starter, shipped in the app and handed over by
 * the main process, so the desk is lit on a machine that is offline or
 * signed out. It plays with the music for as long as the page is open; its
 * colours hold the desk until it plays and whenever it cannot — no output to
 * listen to, a machine that cannot draw it.
 *
 * Every frame also goes to the main process, which lights the real devices
 * with it for as long as the page is open — Ivan's call: a keyboard lit
 * under their hands is the argument — and gives them back when it closes.
 * With Plus, main ignores these and the member's switch decides.
 */

export type TLightingDemo =
  /** No scene to show: the main process could not hand one over. */
  | { state: 'dark' }
  /** The scene itself, drawn on the audio clock. */
  | { state: 'playing'; pack: IScenePack }
  /** Its colours, before it plays and when it cannot. */
  | { state: 'still'; pack: IScenePack };

/**
 * The scene's own colours washed across the grid, for a desk with nothing
 * drawn on it yet: the palette at full height, never the spectrum bars —
 * bars on a page nobody is playing music to read as a broken scene.
 */
const washFrame = (pack: IScenePack): ILightingFrame => ({
  width: LIGHTING_GRID_WIDTH,
  height: LIGHTING_GRID_HEIGHT,
  rgb: fillSwatchGrid(
    swatchColours(pack.swatch),
    new Uint8Array(LIGHTING_GRID_WIDTH).fill(255),
    LIGHTING_GRID_WIDTH,
    LIGHTING_GRID_HEIGHT,
    new Uint8Array(LIGHTING_GRID_WIDTH * LIGHTING_GRID_HEIGHT * 3),
  ),
  level: 0.7,
  beat: 0.3,
  bass: 0.7,
  mid: 0.6,
  treble: 0.5,
  deltaMs: 1000 / 30,
  sceneId: pack.id,
  timeSeconds: 0,
  activity: 1,
  ambient: false,
});

export const useLightingDemo = (): TLightingDemo => {
  const { capture, isPaused } = useLiveAudioControl();
  const pausedRef = useRef(isPaused);
  pausedRef.current = isPaused;
  /** Null: asked and refused, or a window whose bridge predates the demo. */
  const [pack, setPack] = useState<IScenePack | null>();
  /** The output could not be listened to: the scene has nothing to follow. */
  const [unheard, setUnheard] = useState(false);
  // Nothing to hear is nothing to draw with: the colours hold the desk
  // rather than the page claiming a scene is playing on an empty stage.
  const playing = Boolean(pack) && !unheard && Boolean(capture);
  useLiveAudioCapture(Boolean(pack) && !unheard, 'display');

  useEffect(() => {
    let cancelled = false;
    const asked = window.electron?.ipcRenderer?.lightingDemoScene?.();
    if (!asked) {
      setPack(null);
      return undefined;
    }
    asked
      .then((scene) => {
        if (!cancelled) {
          setPack(scene);
        }
        return undefined;
      })
      .catch(() => {
        if (!cancelled) {
          setPack(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // The colours hold the desk whenever the scene is not being drawn on it.
  // Emptied first, in the same turn: the lamps ease from frame to frame, and
  // a single frame after the scene's last one would leave them one step from
  // where they were. An empty frame drops that history, and the one after it
  // lands exactly on its colours. Two publishes in one turn paint once.
  //
  // Nothing is cleared when the scene starts: its first frame is a while
  // away while the program links, and the desk keeps the colours until it
  // comes rather than going black for the wait.
  useEffect(() => {
    if (playing || !pack) {
      return;
    }
    publishLightingPreview(undefined);
    publishLightingPreview(washFrame(pack));
  }, [playing, pack]);

  // The page closing gives the desk, and the devices, back.
  useEffect(
    () => () => {
      publishLightingPreview(undefined);
      window.electron?.ipcRenderer?.releaseLighting?.();
    },
    [],
  );

  useEffect(() => {
    if (!pack || unheard || !capture) {
      return undefined;
    }
    const api = window.electron?.ipcRenderer;
    const player = playLampScene({
      pack,
      sceneId: pack.id,
      guarded: false,
      capture,
      isPaused: () => pausedRef.current,
      profile: () => DEFAULT_LIGHTING_PROFILE,
      swatch: pack.swatch,
      onFrame: (frame, image) => {
        publishLightingPreview(frame, image);
        api?.sendLightingDemoFrame?.(frame);
      },
      onCannotHear: () => setUnheard(true),
    });
    return () => {
      player.close();
      // The scene stopped: the devices are not left holding its last frame.
      api?.releaseLighting?.();
    };
  }, [pack, unheard, capture]);

  if (!pack) {
    return { state: 'dark' };
  }
  return playing ? { state: 'playing', pack } : { state: 'still', pack };
};
