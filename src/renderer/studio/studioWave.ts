/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import type { IScenePack } from 'common/scenePacks';
import {
  DEFAULT_SCENE_WAVE,
  MIN_SCENE_WAVE_HEIGHT,
  type ISceneWave,
} from 'common/sceneWave';
import { getWaveTransform } from '../graph/liveTracePaint';

/**
 * The graph's wave height and position, as the Studio tries them on a scene.
 *
 * On the graph those two settings reach a Plus scene as the band its spectrum
 * is drawn in: the height is how tall the band is, the position lifts its
 * floor from the bottom edge toward the middle. A scene that reserves its own
 * band (`spectrumRange` in its pack) has the two settings act inside that
 * band instead of the whole frame. The Studio's stage used to be handed the whole
 * frame always, so a scene that fell apart under a low or lifted wave looked
 * fine right up until somebody used it.
 */
/**
 * The scene's own (`common/sceneWave.ts`), under the name the Studio has
 * always used for it: it stopped being a thing only tried here the moment it
 * began to be saved into the scene and published with it.
 */
export type IStudioWave = ISceneWave;

/** What the graph starts with: the full height, standing on the bottom. */
export const DEFAULT_STUDIO_WAVE = DEFAULT_SCENE_WAVE;

export const STUDIO_WAVE_MIN_HEIGHT = MIN_SCENE_WAVE_HEIGHT;

/**
 * The band `pack` is handed on a stage with no gutters — `[left, right,
 * bottom, top]`, from the bottom — under `wave`, worked out by the same
 * transform the graph applies to its own wave so the two cannot drift.
 */
export const studioSpectrumRect = (
  pack: Pick<IScenePack, 'spectrumRange'>,
  wave: IStudioWave,
): readonly [number, number, number, number] => {
  // The plot, or the scene's own band, measured from the top as the graph
  // measures it: the loudest reading at its top, the quietest at its bottom.
  // In thousandths: the transform works in pixels and treats a plot less
  // than one deep as one deep, which would shrink a band 0.39 tall to 0.15.
  const [bottom, top] = pack.spectrumRange ?? [0, 1];
  const plotTop = (1 - top) * 1000;
  const plotBottom = (1 - bottom) * 1000;
  const { translateY, scaleY } = getWaveTransform(
    {
      isFlipped: false,
      isHalfHeight: false,
      isFromCentre: false,
      heightScale: wave.height,
      verticalPosition: wave.position,
    },
    plotBottom,
    plotTop,
  );
  const quietest = (translateY + scaleY * plotBottom) / 1000;
  const loudest = (translateY + scaleY * plotTop) / 1000;
  return [0, 1, 1 - quietest, 1 - loudest];
};
