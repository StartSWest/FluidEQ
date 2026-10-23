/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { act, cleanup, render } from '@testing-library/react';
import EngineLookLayer from '../../../../renderer/graph/engineLooks/EngineLookLayer';
import { engineLookPack } from '../../../../renderer/graph/engineLooks/engineLooks';
import useSceneRunner from '../../../../renderer/graph/useSceneRunner';
import {
  resetScenePerformanceForTesting,
  setScenePerformance,
} from '../../../../renderer/utils/scenePerformanceStore';

// The worker/GPU is the boundary: hold what the real layer hands it to draw.
jest.mock('../../../../renderer/graph/useSceneRunner', () => ({
  __esModule: true,
  default: jest.fn(() => ({ current: null })),
}));

afterEach(() => {
  cleanup();
  window.localStorage.removeItem('fluideq.standardPerformance');
  window.localStorage.removeItem('fluideq.scenePerformance');
  resetScenePerformanceForTesting();
  jest.clearAllMocks();
});

it('draws Standard looks with their own saved choices and updates the GPU when those change', () => {
  resetScenePerformanceForTesting();
  setScenePerformance({ resolution: 'performance', smoothing: 'best' }, 'plus');
  const pack = engineLookPack('ledbars');
  if (!pack) {
    throw new Error('LED bars must have a GPU drawing');
  }
  render(
    <EngineLookLayer
      // eslint-disable-next-line react/style-prop-object -- this component's style is the named graph look, not inline CSS
      style="ledbars"
      pack={pack}
      inputRef={{ current: undefined }}
      onPhase={jest.fn()}
      left={0}
      top={0}
      width={800}
      height={400}
    />,
  );
  const drawing = () => {
    const { calls } = jest.mocked(useSceneRunner).mock;
    return calls[calls.length - 1]?.[0].performance;
  };
  expect(drawing()).toEqual({
    frameRate: 'display',
    resolution: 'native',
    autoFloor: 0.35,
    upscaler: 'simple',
    smoothing: 'off',
  });

  act(() =>
    setScenePerformance(
      { resolution: 'quality', smoothing: 'fast', frameRate: 'sixty' },
      'standard',
    ),
  );
  expect(drawing()).toMatchObject({
    resolution: 'quality',
    smoothing: 'fast',
    frameRate: 'sixty',
  });
  act(() =>
    setScenePerformance({ resolution: 'balanced', smoothing: 'off' }, 'plus'),
  );
  expect(drawing()).toMatchObject({
    resolution: 'quality',
    smoothing: 'fast',
    frameRate: 'sixty',
  });
});
