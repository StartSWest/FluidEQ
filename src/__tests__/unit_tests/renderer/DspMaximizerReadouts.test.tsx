/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { render, cleanup } from '@testing-library/react';
import { DSP_DEFAULTS } from '../../../common/dsp/chain';
import DspMaximizerGraph from '../../../renderer/dsp/DspMaximizerGraph';
import { startGraphLoop } from '../../../renderer/dsp/graphLoop';
import {
  setDspPeak,
  setDspMaximizerReduction,
} from '../../../renderer/dsp/store';

jest.mock('../../../renderer/dsp/graphLoop', () => ({
  startGraphLoop: jest.fn(),
}));

let paint: () => void;
let engineGone: (() => void) | undefined;
let now = 0;
const settings = { ...DSP_DEFAULTS.maximizer, enabled: true };

beforeEach(() => {
  now = 0;
  jest.spyOn(performance, 'now').mockImplementation(() => now);
  // The zero-size canvas stops before drawing; these cases exercise its text.
  jest
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue({} as CanvasRenderingContext2D);
  jest.mocked(startGraphLoop).mockImplementation((callback, options) => {
    const schedule = jest.fn();
    paint = () => callback({ schedule });
    engineGone = options?.onEngineGone;
    return { schedule, stop: jest.fn() };
  });
  setDspPeak(0.5);
  setDspMaximizerReduction(-6);
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  setDspPeak(0);
  setDspMaximizerReduction(0);
});

it('shows averaged labels at reading cadence while the graph keeps painting', () => {
  const { container } = render(<DspMaximizerGraph maximizer={settings} />);
  const figures = [...container.querySelectorAll('.live-figure__text')];
  paint();
  now = 249;
  paint();
  expect(figures[0].textContent).toBe('0.0 dB');
  now = 250;
  paint();
  expect(figures[0].textContent).toBe('-6.0 dB');
  expect(figures[2].textContent).toBe('-6.0 dBFS');
  setDspPeak(0.01);
  setDspMaximizerReduction(0);
  now = 266;
  paint();
  expect(figures[0].textContent).toBe('-6.0 dB');
  expect(figures[2].textContent).toBe('-6.0 dBFS');
});

it('clears labels immediately when the engine stops, even without another reading window', () => {
  const { container } = render(<DspMaximizerGraph maximizer={settings} />);
  paint();
  now = 250;
  paint();
  const figures = [...container.querySelectorAll('.live-figure__text')];
  expect(figures[0].textContent).toBe('-6.0 dB');
  expect(engineGone).toBeDefined();
  engineGone?.();
  expect(figures[0].textContent).toBe('0.0 dB');
  expect(figures[1].textContent).toBe('0.0 dB');
  expect(figures[2].closest('[hidden]')).not.toBeNull();
});

it('clears reduction and held peak when bypassed while idle', () => {
  const { container, rerender } = render(
    <DspMaximizerGraph maximizer={settings} />,
  );
  paint();
  now = 250;
  paint();
  rerender(<DspMaximizerGraph maximizer={{ ...settings, enabled: false }} />);
  const figures = [...container.querySelectorAll('.live-figure__text')];
  expect(figures[0].textContent).toBe('0.0 dB');
  expect(figures[1].textContent).toBe('0.0 dB');
});
