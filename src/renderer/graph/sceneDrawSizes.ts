/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  SCENE_SUPERSAMPLE,
  scenePinnedScale,
  type IScenePerformance,
  type TSceneResolution,
  type TSceneSmoothing,
} from 'common/scenePerformance';
import type { ISceneDrawSize, ISceneFinish } from './sceneWorkerMessages';

/**
 * The sizes a scene is drawn through, from the panel's pixels to the picture
 * the shader fills, and the passes that finish it. Pure, and shared with the
 * scenes drawn by C++ on the desktop (`draw_plan.h`), which the fixture
 * (`sceneSizingFixture.ts`) holds to these.
 */

/** A 4K panel's pixels: the most any picture is drawn at. */
const PIXEL_BUDGET = 3840 * 2160;

/**
 * The panel's own pixels, up to the 4K budget: a larger panel is drawn at
 * what fits and stretched the rest of the way.
 */
export const sceneOutputSize = (
  panelWidth: number,
  panelHeight: number,
): ISceneDrawSize => {
  const cap = Math.min(
    1,
    Math.sqrt(PIXEL_BUDGET / Math.max(1, panelWidth * panelHeight)),
  );
  return {
    width: Math.max(1, Math.round(panelWidth * cap)),
    height: Math.max(1, Math.round(panelHeight * cap)),
  };
};

/**
 * The largest size the ladder climbs to. `best` smoothing draws larger than
 * the panel and averages down, within the same pixel budget: twice each way
 * at 1080p, what fits at 1440p, nothing at 4K, where FXAA alone is left to
 * do the smoothing.
 */
export const sceneLadderTop = (
  smoothing: TSceneSmoothing,
  output: ISceneDrawSize,
): number => {
  const supersample =
    smoothing === 'best'
      ? Math.min(
          SCENE_SUPERSAMPLE,
          Math.sqrt(PIXEL_BUDGET / (output.width * output.height)),
        )
      : 1;
  return supersample > 1.05 ? supersample : 1;
};

/**
 * The scale drawn at: the ladder's, unless the listener pinned full size or
 * a preset — never drawn by the ladder, which still watches, so a scene too
 * slow even there is handed over.
 */
export const sceneChosenScale = (
  resolution: TSceneResolution,
  top: number,
  ladderScale: number,
): number => {
  const pinned = scenePinnedScale(resolution);
  if (pinned === undefined) {
    return ladderScale;
  }
  return resolution === 'native' ? top : pinned;
};

export const sceneDrawnSize = (
  output: ISceneDrawSize,
  scale: number,
): ISceneDrawSize => ({
  width: Math.max(1, Math.round(output.width * scale)),
  height: Math.max(1, Math.round(output.height * scale)),
});

/**
 * The passes the listener's choice asks for at `scale`. A picture drawn at
 * the full supersample is four samples a pixel, averaged: its edges are
 * already resolved, and FXAA over it only softens what is there — measured on
 * Crystal at 1460x567, a third of a millisecond for a picture no cleaner.
 * FXAA stays wherever the supersample is partial or absent, which is most
 * panels at 4K. The plain scaler for good once the FSR passes have proved
 * too dear for this GPU at this size (`cheap`, `SCENE_FINISH_SHARE`).
 */
export const sceneFinishFor = (
  { upscaler, smoothing }: Pick<IScenePerformance, 'upscaler' | 'smoothing'>,
  scale: number,
  cheap: boolean,
): ISceneFinish => ({
  fsr: upscaler === 'fsr' && !cheap,
  fxaa: smoothing !== 'off' && scale < SCENE_SUPERSAMPLE - 0.05,
});
