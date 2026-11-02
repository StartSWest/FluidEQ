/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { framedPanel, framedPoint } from '../../common/sceneFraming';
import {
  scenePaceMs,
  scenePinnedScale,
  type IScenePerformance,
} from '../../common/scenePerformance';
import { NEUTRAL_RESPONSE } from '../../common/sceneResponse';
import { assembleFragmentSource } from '../../common/sceneUniformContract';
import { FULL_VIEW, SCENE_VIEW_VERTEX_SOURCE } from '../../common/sceneView';
import { sceneSpectrumRect } from '../../common/sceneWave';
import type { IWallpaperTuning, IWallpaperWave } from '../../common/wallpaper';
import type { ISceneHostScene } from '../lighting/sceneHostWire';
import type { IMonitorDrawChoice } from './desktopHostWire';
import type { IWallpaperScene } from './surface';

/**
 * A desktop background's scene as the C++ host draws it on one monitor: what
 * the background's page gave the scene runner (`WallpaperSceneLayer.tsx`),
 * worked out here.
 *
 * - Framed for the monitor's own shape, the band moved with the picture
 *   (`sceneFramingView.ts`).
 * - The band is the wave's (`sceneSpectrumRect`), as the page drew it: a
 *   background set with a short or lifted wave draws exactly that.
 * - The listener's own sliders and timing for this look, inside each
 *   slider's range.
 * - Through the flash limiter only when another member made it: the
 *   listener's own scene is theirs, and FluidEQ's were watched before release
 *   (`sceneMaker.ts`).
 */
export const desktopHostSceneOf = (
  { pack, madeBy }: IWallpaperScene,
  monitor: { width: number; height: number },
  wave: IWallpaperWave,
  tuning: IWallpaperTuning | undefined,
): ISceneHostScene => {
  const picture = pack.framing
    ? framedPanel(FULL_VIEW, monitor.width, monitor.height, pack.framing)
    : FULL_VIEW;
  const [left, right, floor, ceiling] = sceneSpectrumRect(pack, wave);
  const [bandLeft, bandFloor] = framedPoint(FULL_VIEW, picture, left, floor);
  const [bandRight, bandCeiling] = framedPoint(
    FULL_VIEW,
    picture,
    right,
    ceiling,
  );
  const response = pack.response ?? NEUTRAL_RESPONSE;
  return {
    guarded: madeBy === 'member',
    response: {
      ...response,
      attack: tuning?.response?.attack ?? response.attack,
      release: tuning?.response?.release ?? response.release,
    },
    params: pack.params.map(({ id, value, min, max }) => ({
      id,
      value: Math.min(max, Math.max(min, tuning?.params?.[id] ?? value)),
      min,
      max,
    })),
    vertexSource: SCENE_VIEW_VERTEX_SOURCE,
    fragmentSource: assembleFragmentSource(pack).source,
    view: [picture[0], picture[1], picture[2], picture[3]],
    spectrumRect: [bandLeft, bandRight, bandFloor, bandCeiling],
    ...(pack.artwork
      ? {
          artwork: {
            width: pack.artwork.width,
            height: pack.artwork.height,
            webp: Uint8Array.from(Buffer.from(pack.artwork.data, 'base64')),
          },
        }
      : {}),
  };
};

/**
 * Whether the C++ host can draw this background as its page would: not a
 * world (three.js runs in the page alone), and moving with the music (the
 * calm motion is the page's, `calmMotion.ts`). Anything else keeps the page.
 */
export const drawnByDesktopHost = (
  { pack }: IWallpaperScene,
  motion: 'music' | 'calm',
): boolean => pack.world === undefined && motion === 'music';

/**
 * The listener's performance choice as the host draws a monitor by it: the
 * page's own rules (`useSceneRunner.ts`), the battery included — on battery,
 * every frame the display offers is held to sixty, as the page held it.
 */
export const monitorDrawChoiceOf = (
  { resolution, autoFloor, upscaler, smoothing, frameRate }: IScenePerformance,
  onBattery: boolean,
): IMonitorDrawChoice => {
  const pinned = scenePinnedScale(resolution);
  return {
    ...(pinned !== undefined ? { pinned } : {}),
    autoFloor,
    fsr: upscaler === 'fsr',
    smoothing,
    paceMs: scenePaceMs(frameRate, onBattery),
  };
};

/**
 * Whether FluidEQ made the scene and watched it before release: drawn from
 * full size and stepped down if it must. Anybody else's, the listener's own
 * included, climbs to it from the listener's floor (`sceneRules.ts`).
 */
export const measuredByFluidEq = ({ madeBy }: IWallpaperScene): boolean =>
  madeBy === 'fluideq';
