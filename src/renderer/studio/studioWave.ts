/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import type { IScenePack } from 'common/scenePacks';
import { getWaveTransform } from '../graph/liveTracePaint';
import { MIN_GRAPH_WAVE_HEIGHT } from '../utils/graphViewSettings';

/**
 * The graph's wave height and position, as the Studio tries them on a scene.
 *
 * On the graph those two settings reach a Plus scene as the band its spectrum
 * is drawn in: the height is how tall the band is, the position lifts its
 * floor from the bottom edge toward the middle. A scene that reserves its own
 * band (`spectrumRange` in its pack) is handed that band instead and the two
 * settings do nothing to it. The Studio's stage used to be handed the whole
 * frame always, so a scene that fell apart under a low or lifted wave looked
 * fine right up until somebody used it.
 */
export interface IStudioWave {
  /** 0.05 to 1, as the graph's slider. */
  height: number;
  /** 0 (the bottom edge) to 1 (the middle), as the graph's slider. */
  position: number;
}

/** What the graph starts with: the full height, standing on the bottom. */
export const DEFAULT_STUDIO_WAVE: IStudioWave = { height: 1, position: 0 };

export const STUDIO_WAVE_MIN_HEIGHT = MIN_GRAPH_WAVE_HEIGHT;

/**
 * The band `pack` is handed on a stage with no gutters — `[left, right,
 * bottom, top]`, from the bottom — under `wave`, worked out by the same
 * transform the graph applies to its own wave so the two cannot drift.
 */
export const studioSpectrumRect = (
  pack: Pick<IScenePack, 'spectrumRange'>,
  wave: IStudioWave,
): readonly [number, number, number, number] => {
  if (pack.spectrumRange) {
    const [bottom, top] = pack.spectrumRange;
    return [0, 1, bottom, top];
  }
  // A plot one unit tall, measured from the top as the graph measures it:
  // the loudest reading at 0, the quietest at 1.
  const { translateY, scaleY } = getWaveTransform(
    {
      isFlipped: false,
      isHalfHeight: false,
      isFromCentre: false,
      heightScale: wave.height,
      verticalPosition: wave.position,
    },
    1,
    0,
  );
  const quietest = translateY + scaleY;
  const loudest = translateY;
  return [0, 1, 1 - quietest, 1 - loudest];
};
