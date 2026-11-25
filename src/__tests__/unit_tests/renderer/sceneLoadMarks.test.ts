/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  markSceneStep,
  timeSceneStep,
} from '../../../renderer/graph/sceneLoadMarks';

/**
 * Each step of a scene's load is one user-timing entry, what the load harness
 * and a Performance recording read. A worker loads its scene again on every
 * Studio save and the browser keeps every entry with no limit, so a step
 * keeps only its newest.
 */

afterEach(() => performance.clearMeasures());

const measures = (name: string) =>
  performance.getEntriesByName(name, 'measure');

it('marks a step from when it started until now', () => {
  const startedAt = performance.now();
  markSceneStep('link', startedAt);
  const [entry] = measures('scene:link');
  expect(entry.startTime).toBe(startedAt);
  expect(entry.duration).toBeGreaterThanOrEqual(0);
});

it('keeps only the newest entry of each step', () => {
  markSceneStep('link', performance.now());
  markSceneStep('link', performance.now());
  markSceneStep('artwork-decode', performance.now());
  expect(measures('scene:link')).toHaveLength(1);
  expect(measures('scene:artwork-decode')).toHaveLength(1);
});

it('times a step that fails as well as one that succeeds, and passes either on', async () => {
  await expect(timeSceneStep('compile', async () => 7)).resolves.toBe(7);
  const failure = new Error('no');
  await expect(
    timeSceneStep('decode', async () => {
      throw failure;
    }),
  ).rejects.toBe(failure);
  expect(measures('scene:compile')).toHaveLength(1);
  expect(measures('scene:decode')).toHaveLength(1);
});
