/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  forgetSceneDraw,
  readSceneDraws,
  reportSceneDraw,
} from '../../../renderer/utils/sceneDrawStats';

const report = (costMs: number) => ({
  scale: 1,
  costMs,
  intervalMs: 10,
  drawnWidth: 2560,
  drawnHeight: 1392,
  outputWidth: 2560,
  outputHeight: 1392,
  fsr: false,
  fxaa: false,
});

describe('what each visualizer is costing', () => {
  afterEach(() => {
    forgetSceneDraw('graph');
    forgetSceneDraw('studio');
  });

  it('keeps the newest report per place', () => {
    reportSceneDraw('graph', 'Aurora', report(2.1));
    reportSceneDraw('graph', 'Aurora', report(2.4));
    reportSceneDraw('studio', 'Coral', report(7));
    expect(readSceneDraws()).toEqual([
      { place: 'graph', name: 'Aurora', report: report(2.4) },
      { place: 'studio', name: 'Coral', report: report(7) },
    ]);
  });

  it('drops a place that stopped drawing', () => {
    reportSceneDraw('graph', 'Aurora', report(2.1));
    forgetSceneDraw('graph');
    expect(readSceneDraws()).toEqual([]);
  });
});
