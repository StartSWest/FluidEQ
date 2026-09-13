/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { RESPONSE_LIMITS, type ISceneResponse } from 'common/sceneResponse';

/** Slider positions: fine enough that no control jumps between two. */
export const RESPONSE_SLIDER_STEPS = 1000;

/**
 * Where a response value sits on its slider, 0..1, and back. Sensitivity is
 * logarithmic, so neutral (100%) is the middle and halving and doubling are
 * the same distance either side; the two times are squared, so the short
 * ones a snappy scene wants get most of the travel. One curve for the
 * Studio's settings and the graph's menu, so the same value sits at the same
 * place on both.
 */
export const responseToPosition = (
  key: keyof ISceneResponse,
  value: number,
) => {
  const [min, max] = RESPONSE_LIMITS[key];
  if (key === 'sensitivity') {
    return Math.log(value / min) / Math.log(max / min);
  }
  if (key === 'attack' || key === 'release') {
    return Math.sqrt((value - min) / (max - min));
  }
  return (value - min) / (max - min);
};

export const responseFromPosition = (
  key: keyof ISceneResponse,
  position: number,
) => {
  const [min, max] = RESPONSE_LIMITS[key];
  if (key === 'sensitivity') {
    return min * (max / min) ** position;
  }
  if (key === 'attack' || key === 'release') {
    return Math.round(min + (max - min) * position * position);
  }
  return min + (max - min) * position;
};
