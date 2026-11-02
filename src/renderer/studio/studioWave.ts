/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import {
  DEFAULT_SCENE_WAVE,
  MIN_SCENE_WAVE_HEIGHT,
  sceneSpectrumRect,
  type ISceneWave,
} from 'common/sceneWave';

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

/** The scene's band under a wave (`common/sceneWave.ts`), as the Studio names it. */
export const studioSpectrumRect = sceneSpectrumRect;
