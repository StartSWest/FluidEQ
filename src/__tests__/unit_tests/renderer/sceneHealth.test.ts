/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  isSceneRenderingAvailable,
  SCENE_CONTEXT_ATTRIBUTES,
  setSceneRenderingAvailableForTesting,
} from '../../../renderer/graph/sceneHealth';

describe('whether a scene can run here', () => {
  afterEach(() => setSceneRenderingAvailableForTesting(undefined));

  /**
   * jsdom answers null for every context, which is exactly what a machine with
   * no usable GPU does — and the right answer for both is "no premium rows".
   */
  it('answers no where the canvas cannot make a WebGL2 context', () => {
    expect(isSceneRenderingAvailable()).toBe(false);
  });

  it('probes once and remembers', () => {
    const spy = jest.spyOn(document, 'createElement');
    isSceneRenderingAvailable();
    isSceneRenderingAvailable();
    expect(
      spy.mock.calls.filter(([tag]) => String(tag) === 'canvas'),
    ).toHaveLength(1);
    spy.mockRestore();
  });
});

/**
 * Ivan, 2026-11-27: "always to try enforce fast high performance". Every
 * scene context asks for the fast card; main starts the app on it too.
 */
it('asks every scene context for the high-performance GPU', () => {
  expect(SCENE_CONTEXT_ATTRIBUTES.powerPreference).toBe('high-performance');
});
