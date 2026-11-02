/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A desktop background's scene as the C++ host draws it: what its page gave
 * the scene runner, worked out in main — framed for the monitor, the band the
 * wave puts it in, the listener's tuning, and the limiter for strangers.
 */

import type { IScenePack } from '../../../common/scenePacks';
import { SCENE_VIEW_VERTEX_SOURCE } from '../../../common/sceneView';
import { sceneSpectrumRect } from '../../../common/sceneWave';
import {
  DEFAULT_SCENE_PERFORMANCE,
  DEFAULT_STANDARD_PERFORMANCE,
} from '../../../common/scenePerformance';
import {
  desktopHostSceneOf,
  drawnByDesktopHost,
  measuredByFluidEq,
  monitorDrawChoiceOf,
} from '../../../main/wallpaper/desktopScene';

const pack = {
  id: 'aurora',
  source: 'void main() { fragColor = vec4(uLevel); }',
  params: [
    { id: 'glow', value: 0.25, min: 0, max: 1, names: { en: 'Glow' } },
    { id: 'speed', value: 2, min: 1, max: 4, names: { en: 'Speed' } },
  ],
  response: { sensitivity: 1.5, threshold: 0.1, attack: 40, release: 300 },
} as unknown as IScenePack;

const FULL_WAVE = { height: 1, position: 0 };

describe("a desktop background's scene on the C++ host", () => {
  it("is the page's program, its sliders and its response", () => {
    const scene = desktopHostSceneOf(
      { pack, madeBy: 'fluideq' },
      { width: 1920, height: 1080 },
      FULL_WAVE,
      undefined,
    );
    expect(scene.vertexSource).toBe(SCENE_VIEW_VERTEX_SOURCE);
    expect(scene.fragmentSource).toContain(pack.source);
    expect(scene.params.map(({ value }) => value)).toEqual([0.25, 2]);
    expect(scene.response).toEqual(pack.response);
    expect(scene.view).toEqual([0, 0, 1, 1]);
    expect(scene.spectrumRect).toEqual([0, 1, 0, 1]);
    expect(scene.guarded).toBe(false);
  });

  it('draws the band where a short, lifted wave puts it', () => {
    const wave = { height: 0.4, position: 0.5 };
    const scene = desktopHostSceneOf(
      { pack, madeBy: 'fluideq' },
      { width: 1920, height: 1080 },
      wave,
      undefined,
    );
    const [, , floor, ceiling] = sceneSpectrumRect(pack, wave);
    expect(scene.spectrumRect[2]).toBeCloseTo(floor, 12);
    expect(scene.spectrumRect[3]).toBeCloseTo(ceiling, 12);
    // A positive control: a lifted wave's floor is off the bottom edge.
    expect(floor).toBeGreaterThan(0.2);
  });

  it("is framed for the monitor's own shape, the band with the picture", () => {
    const framed: IScenePack = {
      ...pack,
      framing: { focus: [0.25, 0.5], narrowest: 32 / 9 },
    };
    const wide = desktopHostSceneOf(
      { pack: framed, madeBy: 'fluideq' },
      { width: 1920, height: 1080 },
      FULL_WAVE,
      undefined,
    );
    // A 16:9 monitor shows half a picture composed at 32:9.
    expect(wide.view[2]).toBeCloseTo(2, 12);
    expect(wide.spectrumRect[1]).toBeCloseTo(0.5, 12);
    const ultrawide = desktopHostSceneOf(
      { pack: framed, madeBy: 'fluideq' },
      { width: 3840, height: 1080 },
      FULL_WAVE,
      undefined,
    );
    expect(ultrawide.view).toEqual([0, 0, 1, 1]);
  });

  it("takes the listener's sliders and timing, inside each slider's range", () => {
    const scene = desktopHostSceneOf(
      { pack, madeBy: 'fluideq' },
      { width: 1920, height: 1080 },
      FULL_WAVE,
      { params: { glow: 0.75, speed: 9 }, response: { release: 120 } },
    );
    expect(scene.params.map(({ value }) => value)).toEqual([0.75, 4]);
    expect(scene.response).toEqual({ ...pack.response, release: 120 });
  });

  it('limits only what another member made', () => {
    const made = (madeBy: 'fluideq' | 'listener' | 'member') =>
      desktopHostSceneOf(
        { pack, madeBy },
        { width: 1920, height: 1080 },
        FULL_WAVE,
        undefined,
      ).guarded;
    expect([made('fluideq'), made('listener'), made('member')]).toEqual([
      false,
      false,
      true,
    ]);
  });

  it('leaves worlds and the calm motion to the page', () => {
    const scene = { pack, madeBy: 'fluideq' as const };
    expect(drawnByDesktopHost(scene, 'music')).toBe(true);
    expect(drawnByDesktopHost(scene, 'calm')).toBe(false);
    expect(
      drawnByDesktopHost(
        {
          pack: { ...pack, world: {} } as unknown as IScenePack,
          madeBy: 'fluideq',
        },
        'music',
      ),
    ).toBe(false);
  });

  it('is drawn from full size only when FluidEQ made it', () => {
    expect(
      (['fluideq', 'listener', 'member'] as const).map((madeBy) =>
        measuredByFluidEq({ pack, madeBy }),
      ),
    ).toEqual([true, false, false]);
  });

  it("is drawn by the listener's performance choice, as the page drew it", () => {
    expect(monitorDrawChoiceOf(DEFAULT_SCENE_PERFORMANCE, false)).toEqual({
      autoFloor: 0.35,
      fsr: true,
      smoothing: 'best',
      paceMs: 0,
    });
    // Standard looks: full size, the plain scaler, no smoothing.
    expect(monitorDrawChoiceOf(DEFAULT_STANDARD_PERFORMANCE, false)).toEqual({
      pinned: 1,
      autoFloor: 0.35,
      fsr: false,
      smoothing: 'off',
      paceMs: 0,
    });
    expect(
      monitorDrawChoiceOf(
        {
          ...DEFAULT_SCENE_PERFORMANCE,
          resolution: 'balanced',
          frameRate: 'thirty',
        },
        false,
      ),
    ).toMatchObject({ pinned: 0.67, paceMs: 1000 / 30 });
  });

  it('holds every refresh to sixty on battery, as the page did', () => {
    expect(monitorDrawChoiceOf(DEFAULT_SCENE_PERFORMANCE, true).paceMs).toBe(
      1000 / 60,
    );
  });
});
