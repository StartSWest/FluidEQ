/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Library host's analysis frames have two readers: the window's DSP
 * panels and the core's Smart EQ. The host sends while either wants them,
 * the window is posted frames only while it asked, and the core hears every
 * one at the rate the host reports.
 */
import type { IHostAnalysis } from 'common/dsp/analysisWire';
import {
  dspHostSampleRate,
  listenToDspHostAnalysis,
  registerDspHostIpc,
} from 'main/ipc/dspHost';

type THandler = (...args: unknown[]) => Promise<unknown>;
const mockHandlers = new Map<string, THandler>();
const mockPublish = jest.fn();
const mockPublishTelemetry = jest.fn();
const mockSetAnalysis = jest.fn((_on: boolean) => Promise.resolve(true));
let mockOptions:
  | {
      onAnalysis: (analysis: IHostAnalysis) => void;
      onTelemetry: (telemetry: { sampleRate: number }) => void;
    }
  | undefined;

jest.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: THandler) =>
      mockHandlers.set(channel, handler),
  },
}));
jest.mock('electron-log', () => ({ info: jest.fn(), warn: jest.fn() }));
jest.mock('main/denoiseModel', () => ({
  cancelDenoiseModelDownload: jest.fn(),
  denoiseModelPath: jest.fn(),
  downloadDenoiseModel: jest.fn(),
  isDenoiseModelPresent: () => false,
  onnxRuntimeLibraryPath: jest.fn(),
}));
jest.mock('main/dspHost/hostPath', () => ({
  findDspHostExecutable: () => 'FluidEQ-DSP-Host.exe',
}));
jest.mock('main/dspHost/windowPublisher', () => ({
  createDspHostPublisher: () => ({
    publish: mockPublish,
    publishTelemetry: mockPublishTelemetry,
  }),
}));
jest.mock('main/dspHost/supervisor', () => ({
  DspHostSupervisor: jest.fn().mockImplementation((options) => {
    mockOptions = options;
    return {
      start: () => Promise.resolve(),
      setRawSharing: () => Promise.resolve(true),
      getState: () => 'ready',
      getHandshake: () => undefined,
      getPid: () => 1,
      getStderrTail: () => [],
      setAnalysis: mockSetAnalysis,
    };
  }),
}));

const FRAME = { sequence: 1, spectra: {} } as unknown as IHostAnalysis;
const askFromWindow = (on: boolean) =>
  mockHandlers.get('dsp-host-transport')?.({}, 'analysis', 0, on ? 1 : 0);

it('hears the host only once it runs, and then shares its frames as each reader asked', async () => {
  registerDspHostIpc({ getMainWindow: () => null });
  // No host yet: nothing to hear.
  expect(await listenToDspHostAnalysis(jest.fn())).toBeUndefined();

  await mockHandlers.get('dsp-host-start')?.({});
  const core = jest.fn();
  const stop = await listenToDspHostAnalysis(core);
  expect(stop).toBeDefined();
  expect(mockSetAnalysis).toHaveBeenLastCalledWith(true);

  mockOptions?.onAnalysis(FRAME);
  expect(core).toHaveBeenCalledWith(FRAME);
  // The window did not ask: posted nothing.
  expect(mockPublish).not.toHaveBeenCalledWith('dsp-host-analysis', FRAME);

  await askFromWindow(true);
  mockOptions?.onAnalysis(FRAME);
  expect(mockPublish).toHaveBeenCalledWith('dsp-host-analysis', FRAME);

  // The window lets go while the core still listens: the host keeps sending.
  await askFromWindow(false);
  expect(mockSetAnalysis).toHaveBeenLastCalledWith(true);
  stop?.();
  expect(mockSetAnalysis).toHaveBeenLastCalledWith(false);
  core.mockClear();
  mockOptions?.onAnalysis(FRAME);
  expect(core).not.toHaveBeenCalled();
});

it('knows the rate the host plays at from its telemetry', () => {
  mockOptions?.onTelemetry({ sampleRate: 96000 });
  expect(dspHostSampleRate()).toBe(96000);
  expect(mockPublishTelemetry).toHaveBeenCalled();
});
