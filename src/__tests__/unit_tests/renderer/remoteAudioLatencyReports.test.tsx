/* FluidEQ — GPL-3.0-or-later */
import { act, renderHook } from '@testing-library/react';
import useRemoteAudioLatencyReports from '../../../renderer/remoteAudio/useRemoteAudioLatencyReports';
import type { TRemoteAudioMeterListener } from '../../../renderer/remoteAudio/meter';

jest.mock('../../../renderer/utils/equalizerApi', () => ({
  readKnownAudioDevices: async () => [
    { id: 'device', guid: '{ABC}', isDefault: true },
  ],
}));
let accept: TRemoteAudioMeterListener = () => undefined;
const subscribe = (listener: TRemoteAudioMeterListener) => {
  accept = listener;
  return () => undefined;
};
const output = { current: '{ABC}' };
const report = jest.fn();
const getHealth = jest.fn(async () => ({
  outputs: [
    {
      endpoint: '{ABC}',
      locked: true,
      processing: true,
      carried: true,
      latency: { frames: 240, rate: 48_000, parts: [] },
    },
  ],
}));
const meter = {
  sourceId: 'peer',
  playbackMs: 40,
  peak: 0.2,
  rms: 0.1,
  waveform: new Float32Array(64),
};

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(window, {
    electron: {
      ipcRenderer: {
        reportRemoteAudioPlaybackLatency: report,
        getEngineHealth: getHealth,
        onEngineHealth: () => () => undefined,
      },
    },
  });
});
afterEach(() => jest.restoreAllMocks());

it('reports at most once a second from existing meters, including measured processing delay', async () => {
  let clock = 0;
  jest.spyOn(performance, 'now').mockImplementation(() => clock);
  await act(async () => {
    renderHook(() =>
      useRemoteAudioLatencyReports(subscribe, output, 'device', true),
    );
  });
  for (clock = 0; clock < 2_000; clock += 1) {
    accept(meter);
  }
  expect(report).toHaveBeenCalledTimes(2);
  expect(report).toHaveBeenCalledWith('peer', 45);
});

it('does no extra engine or output work when no peer plays here', () => {
  renderHook(() =>
    useRemoteAudioLatencyReports(subscribe, output, 'device', false),
  );
  expect(getHealth).not.toHaveBeenCalled();
  expect(report).not.toHaveBeenCalled();
});

it('does not report a buffer-only figure before output latency is known', async () => {
  await act(async () => {
    renderHook(() =>
      useRemoteAudioLatencyReports(subscribe, output, 'device', true),
    );
  });
  accept({ ...meter, playbackMs: undefined, bufferedMs: 40 });
  expect(report).not.toHaveBeenCalled();
});
