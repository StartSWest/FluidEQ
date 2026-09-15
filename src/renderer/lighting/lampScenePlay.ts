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
import type { ICaptureGraph } from '../graph/useLiveOutputSpectrum';
import { parseAccent } from '../graph/sceneUniforms';
import { createLightingAtmosphere } from './lightingAtmosphere';
import {
  startLightingListener,
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
 * A scene the GPU will not draw is not the end of it: the frames then carry
 * the scene's own colours, spread by its spectrum, so a desk keeps moving
 * with the music while the picture is gone.
 */

export interface ILampScenePlay {
  pack: IScenePack;
  /** The look the frames are stamped with; the profile is kept under it. */
  sceneId: string;
  /** A scene nobody watched before it was shared: a member's. */
  guarded: boolean;
  capture: ICaptureGraph;
  isPaused: () => boolean;
  /** Read per frame: tuning changes while the scene plays. */
  profile: () => ILightingProfile;
  /** The scene's colours, for frames it cannot be drawn for. */
  swatch: readonly string[];
  onFrame: (frame: ILightingFrame, image?: ImageBitmap) => void;
  /** The output cannot be listened to: no frame will ever arrive. */
  onCannotHear: () => void;
}

export interface ILampScenePlayer {
  close(): void;
}

export const playLampScene = ({
  pack,
  sceneId,
  guarded,
  capture,
  isPaused,
  profile,
  swatch,
  onFrame,
  onCannotHear,
}: ILampScenePlay): ILampScenePlayer => {
  let closed = false;
  const abort = new AbortController();
  let listener: ILightingListener | undefined;
  let failed = false;
  const atmosphere = createLightingAtmosphere();
  const colours = swatchColours(swatch);
  const fallback = new Uint8Array(
    LIGHTING_GRID_WIDTH * LIGHTING_GRID_HEIGHT * 3,
  );

  const player = createLightingScene(
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
  player.load(pack, guarded);

  const accent = parseAccent(
    getComputedStyle(document.documentElement).getPropertyValue('--accent'),
  );
  startLightingListener(
    capture,
    accent,
    isPaused,
    (heard) => {
      if (closed) {
        return;
      }
      const frame = atmosphere(heard, profile());
      if (!failed) {
        player.draw(frame);
        return;
      }
      onFrame({
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
      onCannotHear();
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        console.error(
          'Dynamic lighting could not listen to the output:',
          error,
        );
      }
    });

  return {
    close: () => {
      closed = true;
      abort.abort();
      listener?.close();
      player.close();
    },
  };
};
