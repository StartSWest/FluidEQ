/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/
import { cleanup, render } from '@testing-library/react';
import { dynamicsPresetSettings } from '../../../common/dsp/dynamicsPresets';
import DspDynamicsGraph from '../../../renderer/dsp/DspDynamicsGraph';
import { startGraphLoop } from '../../../renderer/dsp/graphLoop';
import paintDynamicsGraph from '../../../renderer/dsp/paintDynamicsGraph';
import { setDspDynamicsReport } from '../../../renderer/dsp/dynamicsTelemetry';
import { clearDspAnalysers, setDspAnalyser } from '../../../renderer/dsp/store';

jest.mock('../../../renderer/dsp/graphLoop', () => ({
  startGraphLoop: jest.fn(),
}));
jest.mock('../../../renderer/dsp/paintDynamicsGraph', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('../../../renderer/dsp/useCanvasSize', () => ({
  __esModule: true,
  default: () => ({ current: { width: 600, height: 260 } }),
}));

let paint: () => void;
let engineGone: (() => void) | undefined;
let now = 0;
const settings = dynamicsPresetSettings('vocal', true);
const report = {
  active: true,
  levelDb: [-45, -25, -40] as const,
  gainDb: [6, -4, 2] as const,
};
const analyser = (db: number) => ({
  frequencyBinCount: 1024,
  getFloatFrequencyData: (out: Float32Array) => out.fill(db),
});

beforeEach(() => {
  now = 0;
  jest.spyOn(performance, 'now').mockImplementation(() => now);
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    setTransform: jest.fn(),
  } as unknown as CanvasRenderingContext2D);
  jest.mocked(startGraphLoop).mockImplementation((callback, options) => {
    const schedule = jest.fn();
    paint = () => callback({ schedule });
    engineGone = options?.onEngineGone;
    return { schedule, stop: jest.fn() };
  });
  setDspAnalyser('master', analyser(-10));
  setDspAnalyser('dynamicsIn', analyser(-40));
  setDspAnalyser('dynamicsOut', analyser(-34));
  setDspDynamicsReport(report);
});
afterEach(() => {
  cleanup();
  clearDspAnalysers();
  setDspDynamicsReport(undefined);
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

it('uses one graph with the actual stage taps and gains rather than settings or the Master spectrum', () => {
  const { container } = render(<DspDynamicsGraph dynamics={settings} />);
  paint();
  expect(container.querySelectorAll('canvas')).toHaveLength(1);
  expect(container.querySelector('svg')).toBeNull();
  expect(
    [...container.querySelectorAll('output')].map((el) => el.textContent),
  ).toEqual(['+6.0 dB', '-4.0 dB', '+2.0 dB']);
  const args = jest.mocked(paintDynamicsGraph).mock.calls.slice(-1)[0];
  expect(args[4]?.levels[100]).toBeLessThan(args[5]!.levels[100]);
  expect(args[5]!.levels[100] - args[4]!.levels[100]).toBeCloseTo(6);
  expect(args[6]).toEqual([6, -4, 2]);
});

it('keeps labels readable while painting between updates and clears bypass and stopped values immediately', () => {
  const { container, rerender } = render(
    <DspDynamicsGraph dynamics={settings} />,
  );
  const labels = () =>
    [...container.querySelectorAll('output')].map((el) => el.textContent);
  paint();
  setDspDynamicsReport({ ...report, gainDb: [-6, 4, -2] });
  now = 16;
  paint();
  now = 249;
  paint();
  expect(labels()).toEqual(['+6.0 dB', '-4.0 dB', '+2.0 dB']);
  expect(jest.mocked(paintDynamicsGraph)).toHaveBeenCalledTimes(3);
  now = 250;
  paint();
  expect(labels()[0]).toBe('-6.0 dB');
  rerender(<DspDynamicsGraph dynamics={{ ...settings, enabled: false }} />);
  now = 251;
  paint();
  expect(labels()).toEqual(['0.0 dB', '0.0 dB', '0.0 dB']);
  expect(jest.mocked(paintDynamicsGraph).mock.calls.slice(-1)[0][6]).toEqual([
    0, 0, 0,
  ]);
  engineGone?.();
  expect(labels()).toEqual(['—', '—', '—']);
});

it('does not claim measured band gains on an older engine', () => {
  setDspDynamicsReport(undefined);
  setDspAnalyser('dynamicsIn', undefined);
  setDspAnalyser('dynamicsOut', undefined);
  const { container } = render(<DspDynamicsGraph dynamics={settings} />);
  paint();
  expect(
    [...container.querySelectorAll('output')].every(
      (el) => el.textContent === '—',
    ),
  ).toBe(true);
  const args = jest.mocked(paintDynamicsGraph).mock.calls.slice(-1)[0];
  expect(args[4]).toBeUndefined();
  expect(args[5]).toBeDefined();
  expect(args[6]).toBeUndefined();
});
