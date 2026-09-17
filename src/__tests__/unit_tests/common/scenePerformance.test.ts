/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  DEFAULT_SCENE_PERFORMANCE,
  isScenePerformance,
  normalizeScenePerformance,
  sameScenePerformance,
  SCENE_PRESET_SCALES,
  scenePaceMs,
  scenePinnedScale,
} from '../../../common/scenePerformance';
import { SMOOTH_FRAME_MS } from '../../../common/smoothing';

const whole = {
  frameRate: 'sixty',
  resolution: 'native',
  autoFloor: 0.5,
  upscaler: 'simple',
  smoothing: 'fast',
} as const;

describe('the visualizer performance choice', () => {
  it('draws every frame the display offers by default, sized by the controller down to a third, FSR up, FXAA over it', () => {
    expect(DEFAULT_SCENE_PERFORMANCE).toEqual({
      frameRate: 'display',
      resolution: 'auto',
      autoFloor: 0.35,
      upscaler: 'fsr',
      smoothing: 'fast',
    });
    expect(scenePaceMs('display')).toBe(0);
  });

  it('paces the two caps at sixty and at the graph’s thirty', () => {
    expect(scenePaceMs('sixty')).toBeCloseTo(1000 / 60, 6);
    expect(scenePaceMs('thirty')).toBe(SMOOTH_FRAME_MS);
  });

  /** A laptop unplugged is not where a hundred and forty-four frames earn their power. */
  it('holds the display rate to sixty on battery, and the caps as they are', () => {
    expect(scenePaceMs('display', true)).toBeCloseTo(1000 / 60, 6);
    expect(scenePaceMs('sixty', true)).toBeCloseTo(1000 / 60, 6);
    expect(scenePaceMs('thirty', true)).toBe(SMOOTH_FRAME_MS);
  });

  it('pins the presets to AMD’s own scales and leaves automatic to the controller', () => {
    expect(scenePinnedScale('auto')).toBeUndefined();
    expect(scenePinnedScale('native')).toBe(1);
    expect(scenePinnedScale('quality')).toBe(SCENE_PRESET_SCALES.quality);
    expect(scenePinnedScale('balanced')).toBe(0.67);
    expect(scenePinnedScale('performance')).toBe(0.5);
  });

  it('recognises a whole choice and nothing else', () => {
    expect(isScenePerformance(whole)).toBe(true);
    expect(isScenePerformance({ ...whole, smoothing: undefined })).toBe(false);
    expect(isScenePerformance({ ...whole, upscaler: 'dlss' })).toBe(false);
    expect(isScenePerformance({ ...whole, autoFloor: 0.4 })).toBe(false);
    expect(isScenePerformance({ frameRate: 120, resolution: 'auto' })).toBe(
      false,
    );
    expect(isScenePerformance(null)).toBe(false);
    expect(isScenePerformance('display')).toBe(false);
  });

  it('repairs a stored value field by field', () => {
    expect(normalizeScenePerformance(undefined)).toEqual(
      DEFAULT_SCENE_PERFORMANCE,
    );
    expect(
      normalizeScenePerformance({ frameRate: 'thirty', resolution: 'fast' }),
    ).toEqual({ ...DEFAULT_SCENE_PERFORMANCE, frameRate: 'thirty' });
    expect(
      normalizeScenePerformance({ resolution: 'quality', smoothing: 'best' }),
    ).toEqual({
      frameRate: 'display',
      resolution: 'quality',
      autoFloor: 0.35,
      upscaler: 'fsr',
      smoothing: 'best',
    });
    // A floor that is not one of the four — a hand-edited file — is the default.
    expect(normalizeScenePerformance({ autoFloor: 0.6 }).autoFloor).toBe(0.35);
    expect(normalizeScenePerformance({ autoFloor: 0.67 }).autoFloor).toBe(0.67);
  });

  it('compares two choices field by field', () => {
    expect(sameScenePerformance(whole, { ...whole })).toBe(true);
    expect(sameScenePerformance(whole, { ...whole, upscaler: 'fsr' })).toBe(
      false,
    );
    expect(sameScenePerformance(whole, { ...whole, autoFloor: 0.85 })).toBe(
      false,
    );
  });
});
