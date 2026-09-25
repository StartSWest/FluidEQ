/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  LIGHTING_GRID_HEIGHT,
  LIGHTING_GRID_WIDTH,
  type ILightingFrame,
} from 'common/lighting/lightingModel';
import type { ILightingProfile } from 'common/lighting/lightingProfiles';
import type { IScenePack } from 'common/scenePacks';
import { parseAccent } from '../graph/sceneUniforms';
import { createLightingAtmosphere } from './lightingAtmosphere';
import {
  startLightingListener,
  type IHeardFrame,
  type ILampSound,
  type ILightingListener,
} from './lightingListener';
import { createLightingScene } from './lightingSceneClient';
import { fillSwatchGrid, swatchColours } from './swatchGrid';

/**
 * A scene drawn small on the audio clock, frame by frame, for whoever wants
 * the lamps' picture: the member's own devices while dynamic lighting is on,
 * and the demo desk on the page of an account without Plus.
 *
 * Both want the same thing — the scene drawn in the lamps' worker, the music
 * measured the way the graph measures it, and a frame handed over thirty
 * times a second — and differ only in what they do with the frame. So the
 * drawing lives here and each caller says where its frames go.
 *
 * ONE PLAYER FOR AS LONG AS THE LAMPS ARE LIT. The scene and the sound each
 * change underneath it, and neither starts it again: a capture Windows
 * restarts, or the lamps' own silence standing in while there is none, is
 * listened to afresh while the worker keeps its scene, and a new
 * scene, or a new version of the one playing, is linked while the old one
 * keeps the desk (`lightingScene.worker.ts`). Both used to end the player and
 * make another, and the desk went dark for a new worker and a whole link.
 *
 * A scene the GPU will not draw is not the end of it: the frames then carry
 * the scene's own colours, spread by its spectrum, so a desk keeps moving
 * with the music while the picture is gone.
 */

export interface ILampSceneShown {
  /** The look the frames are stamped with; its profile is kept under it. */
  sceneId: string;
  /** Nothing when the scene could not be had: its colours light the desk. */
  pack?: IScenePack;
  /** A scene nobody watched before it was shared: a member's. */
  guarded: boolean;
  /** Its colours, for frames it cannot be drawn for. */
  swatch: readonly string[];
}

export interface ILampPlayerOptions {
  isPaused: () => boolean;
  /** Read per frame: tuning changes while the scene plays. */
  profile: () => ILightingProfile;
  onFrame: (frame: ILightingFrame, image?: ImageBitmap) => void;
  /** This sound cannot be listened to: no frame will come from it. */
  onCannotHear: () => void;
}

export interface ILampPlayer {
  /** The scene to light the desk with; the one on it stays until this one is ready. */
  show(scene: ILampSceneShown): void;
  /** The sound to follow, or none: the desk holds its last frame meanwhile. */
  hear(sound: ILampSound | undefined): void;
  close(): void;
}

export const createLampPlayer = ({
  isPaused,
  profile,
  onFrame,
  onCannotHear,
}: ILampPlayerOptions): ILampPlayer => {
  let closed = false;
  /** The scene asked for, and its colours for the frames it is not drawn in. */
  let wanted:
    { sceneId: string; colours: ReturnType<typeof swatchColours> } | undefined;
  /** The look each pack sent to the worker stands for, and the one it draws. */
  const looks = new Map<string, string>();
  let drawn: string | undefined;
  /**
   * The scene asked for cannot be drawn: its colours instead. Not before the
   * first scene has linked, when the desk simply waits for the picture — a
   * flash of colour bars ahead of every scene read as the scene failing.
   */
  let failed = false;
  let heardSound: ILampSound | undefined;
  let listener: ILightingListener | undefined;
  let listening: AbortController | undefined;
  const atmosphere = createLightingAtmosphere();
  const fallback = new Uint8Array(
    LIGHTING_GRID_WIDTH * LIGHTING_GRID_HEIGHT * 3,
  );

  const scene = createLightingScene(
    (grid) => {
      if (closed) {
        grid.preview.close();
        return;
      }
      onFrame(
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
          // The scene in the picture, which is the one asked for once it
          // has linked: its profile is the one that applies.
          sceneId: drawn ?? wanted?.sceneId,
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
    (packId) => {
      failed = false;
      drawn = looks.get(packId);
    },
  );

  const heard = (frameHeard: IHeardFrame) => {
    if (closed || !wanted) {
      return;
    }
    const frame = atmosphere(frameHeard, profile());
    if (!failed) {
      scene.draw(frame);
      return;
    }
    onFrame({
      width: LIGHTING_GRID_WIDTH,
      height: LIGHTING_GRID_HEIGHT,
      rgb: fillSwatchGrid(
        wanted.colours,
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
      sceneId: wanted.sceneId,
      timeSeconds: frame.timeSeconds,
      activity: frame.activity,
      ambient: (frame.activity ?? 1) < 0.05,
    });
  };

  return {
    show: ({ sceneId, pack, guarded, swatch }) => {
      if (closed) {
        return;
      }
      wanted = { sceneId, colours: swatchColours(swatch) };
      if (!pack) {
        drawn = undefined;
        failed = true;
        scene.unload();
        return;
      }
      looks.set(pack.id, sceneId);
      scene.load(pack, guarded);
    },
    hear: (sound) => {
      if (closed || sound === heardSound) {
        return;
      }
      heardSound = sound;
      listening?.abort();
      listener?.close();
      listener = undefined;
      if (!sound) {
        return;
      }
      const abort = new AbortController();
      listening = abort;
      const accent = parseAccent(
        getComputedStyle(document.documentElement).getPropertyValue('--accent'),
      );
      startLightingListener(sound, accent, isPaused, heard, abort.signal)
        .then((started) => {
          if (closed || abort.signal.aborted) {
            started.close();
            return undefined;
          }
          listener = started;
          return undefined;
        })
        .catch((error: unknown) => {
          if (closed || abort.signal.aborted) {
            return;
          }
          onCannotHear();
          if (!(error instanceof DOMException && error.name === 'AbortError')) {
            console.error(
              'Dynamic lighting could not listen to the output:',
              error,
            );
          }
        });
    },
    close: () => {
      closed = true;
      listening?.abort();
      listener?.close();
      scene.close();
    },
  };
};
