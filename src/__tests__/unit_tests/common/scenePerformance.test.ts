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
  SCENE_AUTO_FLOOR,
  SCENE_BALANCED_FLOOR,
  SCENE_FRAME_RATES,
  SCENE_MENU_FRAME_RATES,
  SCENE_QUALITIES,
  scenePaceMs,
  sceneQualityPlan,
} from '../../../common/scenePerformance';
import { THIRTY_A_SECOND_MS } from '../../../common/smoothing';

const whole = { frameRate: 'sixty', quality: 'balanced' } as const;

describe('the visualizer drawing choice', () => {
  it('draws at the display rate by default, on Auto', () => {
    expect(DEFAULT_SCENE_PERFORMANCE).toEqual({
      frameRate: 'display',
      quality: 'auto',
    });
    expect(scenePaceMs('display')).toBe(0);
  });

  // Ivan, 2026-11-27: "lets do auto, blance, and full".
  it('offers three qualities and nothing else', () => {
    expect(SCENE_QUALITIES).toEqual(['auto', 'balanced', 'full']);
  });

  it('paces the caps at sixty, thirty and FluidWallpapers’ fifteen', () => {
    expect(scenePaceMs('sixty')).toBeCloseTo(1000 / 60, 6);
    expect(scenePaceMs('thirty')).toBe(THIRTY_A_SECOND_MS);
    expect(scenePaceMs('fifteen')).toBeCloseTo(1000 / 15, 6);
    // FluidEQ's own row cycles three of them.
    expect(SCENE_MENU_FRAME_RATES).toEqual(['display', 'sixty', 'thirty']);
    expect(SCENE_FRAME_RATES).toContain('fifteen');
  });

  /** A laptop unplugged is not where a hundred and forty-four frames earn their power. */
  it('holds the display rate to sixty on battery, and the caps as they are', () => {
    expect(scenePaceMs('display', true)).toBeCloseTo(1000 / 60, 6);
    expect(scenePaceMs('sixty', true)).toBeCloseTo(1000 / 60, 6);
    expect(scenePaceMs('thirty', true)).toBe(THIRTY_A_SECOND_MS);
    expect(scenePaceMs('fifteen', true)).toBeCloseTo(1000 / 15, 6);
  });

  it('draws a scene by each quality’s own plan', () => {
    // Auto: from larger than the panel down as far as the rate forces it.
    expect(sceneQualityPlan('auto')).toEqual({
      floor: SCENE_AUTO_FLOOR,
      supersample: true,
      fsr: true,
      fxaa: true,
    });
    // Balanced: never larger than the panel, never under half of it.
    expect(sceneQualityPlan('balanced')).toEqual({
      floor: SCENE_BALANCED_FLOOR,
      supersample: false,
      fsr: true,
      fxaa: true,
    });
    expect(SCENE_BALANCED_FLOOR).toBe(0.5);
    // Full: the whole picture with full smoothing, every frame.
    expect(sceneQualityPlan('full')).toEqual({
      floor: 'top',
      supersample: true,
      fsr: true,
      fxaa: true,
    });
  });

  /** A look's shader draws its own edges: its quality is its size alone. */
  it('draws a Standard look at the quality’s size with no finishing pass', () => {
    SCENE_QUALITIES.forEach((quality) => {
      const look = sceneQualityPlan(quality, 'look');
      expect(look.floor).toBe(sceneQualityPlan(quality).floor);
      expect(look).toMatchObject({
        supersample: false,
        fsr: false,
        fxaa: false,
      });
    });
  });

  it('recognises a whole choice and nothing else', () => {
    expect(isScenePerformance(whole)).toBe(true);
    expect(isScenePerformance({ ...whole, frameRate: 'fifteen' })).toBe(true);
    expect(isScenePerformance({ ...whole, quality: 'best' })).toBe(false);
    expect(isScenePerformance({ ...whole, quality: undefined })).toBe(false);
    expect(isScenePerformance({ frameRate: 120, quality: 'auto' })).toBe(false);
    expect(isScenePerformance(null)).toBe(false);
    expect(isScenePerformance('display')).toBe(false);
  });

  it('repairs a stored value field by field', () => {
    expect(normalizeScenePerformance(undefined)).toEqual(
      DEFAULT_SCENE_PERFORMANCE,
    );
    expect(
      normalizeScenePerformance({ frameRate: 'thirty', quality: 'fast' }),
    ).toEqual({ frameRate: 'thirty', quality: 'auto' });
    expect(normalizeScenePerformance({ quality: 'full' })).toEqual({
      frameRate: 'display',
      quality: 'full',
    });
  });

  /** What a listener chose before the three existed is kept in their words. */
  it('reads a choice saved before Auto, Balanced and Full as the one it stood for', () => {
    const earlier = (fields: Record<string, unknown>) =>
      normalizeScenePerformance({
        frameRate: 'sixty',
        upscaler: 'fsr',
        smoothing: 'best',
        ...fields,
      });
    expect(earlier({ resolution: 'native', autoFloor: 0.35 })).toEqual({
      frameRate: 'sixty',
      quality: 'full',
    });
    expect(earlier({ resolution: 'performance' }).quality).toBe('balanced');
    expect(earlier({ resolution: 'quality' }).quality).toBe('balanced');
    expect(earlier({ resolution: 'auto', autoFloor: 0.35 }).quality).toBe(
      'auto',
    );
    // A smallest size raised to half or more asked for a lighter floor.
    expect(earlier({ resolution: 'auto', autoFloor: 0.67 }).quality).toBe(
      'balanced',
    );
    // A quality, once saved, is the answer whatever else the file holds.
    expect(earlier({ resolution: 'native', quality: 'auto' }).quality).toBe(
      'auto',
    );
  });

  it('compares two choices field by field', () => {
    expect(sameScenePerformance(whole, { ...whole })).toBe(true);
    expect(sameScenePerformance(whole, { ...whole, quality: 'full' })).toBe(
      false,
    );
    expect(sameScenePerformance(whole, { ...whole, frameRate: 'thirty' })).toBe(
      false,
    );
  });
});
