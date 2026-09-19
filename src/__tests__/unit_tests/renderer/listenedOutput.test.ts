/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { act, renderHook } from '@testing-library/react';
import type { IAudioDevice } from 'common/constants';
import type { IEngineHealth, IEngineOutputHealth } from 'common/engineHealth';
import { getAudioDevices } from 'renderer/utils/equalizerApi';
import {
  combineListenedDelay,
  listenedDelay,
  useListenedOutput,
} from 'renderer/utils/useListenedOutput';

jest.mock('renderer/utils/equalizerApi', () => ({
  getAudioDevices: jest.fn(),
}));

const speakers: IAudioDevice = {
  id: 'speakers',
  name: 'Speakers',
  guid: 'aaaa',
  isDefault: true,
  isActive: true,
};
const output = (endpoint = '{AAAA}'): IEngineOutputHealth => ({
  endpoint,
  locked: true,
  processing: true,
  owner: true,
  carried: true,
  problems: [],
  latency: { rate: 48000, frames: 96, parts: [{ stage: 'guard', frames: 96 }] },
});
const deferred = <T>() => {
  let complete: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolve) => {
    complete = resolve;
  });
  return { promise, resolve: complete };
};
let push: (health: IEngineHealth) => void;
let read: ReturnType<typeof deferred<IEngineHealth>>;

beforeEach(() => {
  jest.clearAllMocks();
  read = deferred<IEngineHealth>();
  jest.mocked(getAudioDevices).mockResolvedValue([speakers]);
  window.electron = {
    ipcRenderer: {
      getEngineHealth: () => read.promise,
      onEngineHealth: (listener: typeof push) => {
        push = listener;
        return () => undefined;
      },
    },
  } as unknown as typeof window.electron;
});

it('never borrows a locked output before the default device is known', async () => {
  const devices = deferred<IAudioDevice[]>();
  jest.mocked(getAudioDevices).mockReturnValue(devices.promise);
  const { result } = renderHook(() => useListenedOutput(true));
  await act(async () => {
    read.resolve({ outputs: [output('{BBBB}'), output()] });
  });
  expect(result.current).toEqual({ known: false, output: undefined });
  await act(async () => {
    devices.resolve([speakers]);
  });
  expect(result.current.output?.endpoint).toBe('{AAAA}');
});

it('keeps a push newer than the initial health request', async () => {
  const { result } = renderHook(() => useListenedOutput(true));
  await act(async () => {
    push({ outputs: [output()] });
  });
  await act(async () => {
    read.resolve({ outputs: [] });
  });
  expect(result.current.output?.latency?.frames).toBe(96);
});

it('invalidates the old output during a switch and ignores reordered device replies', async () => {
  const { result } = renderHook(() => useListenedOutput(true));
  await act(async () => {
    read.resolve({ outputs: [output(), output('{BBBB}')] });
  });
  expect(result.current.output?.endpoint).toBe('{AAAA}');
  const old = deferred<IAudioDevice[]>();
  const latest = deferred<IAudioDevice[]>();
  jest
    .mocked(getAudioDevices)
    .mockReturnValueOnce(old.promise)
    .mockReturnValueOnce(latest.promise);
  act(() => {
    window.dispatchEvent(new Event('fluideq-output-changed'));
  });
  expect(result.current.output).toBeUndefined();
  act(() => {
    window.dispatchEvent(new Event('fluideq-output-changed'));
  });
  await act(async () => {
    latest.resolve([{ ...speakers, guid: '{BBBB}' }]);
  });
  await act(async () => {
    old.resolve([speakers]);
  });
  expect(result.current.output?.endpoint).toBe('{BBBB}');
});

it('does not resurrect health from an earlier engine activation', async () => {
  const { result, rerender } = renderHook(
    ({ enabled }) => useListenedOutput(enabled),
    { initialProps: { enabled: true } },
  );
  await act(async () => {
    read.resolve({ outputs: [output()] });
  });
  rerender({ enabled: false });
  read = deferred<IEngineHealth>();
  rerender({ enabled: true });
  expect(result.current.output).toBeUndefined();
  await act(async () => {
    read.resolve({ outputs: [output('{BBBB}')] });
  });
  expect(result.current.output).toBeUndefined();
});

it('hides the delay for pass-through, missing or idle telemetry', () => {
  const bypassed = { ...output(), processing: false };
  expect(listenedDelay({ known: true, output: bypassed })).toBeUndefined();
  expect(listenedDelay({ known: false, output: output() })).toBeUndefined();
  expect(
    listenedDelay({ known: true, output: { ...output(), locked: false } }),
  ).toBeUndefined();
  expect(
    listenedDelay({ known: true, output: { ...output(), carried: false } }),
  ).toBeUndefined();
  expect(
    listenedDelay({ known: true, output: { ...output(), latency: undefined } }),
  ).toBeUndefined();
  expect(listenedDelay({ known: true, output: output() })?.latency.frames).toBe(
    96,
  );
});
it('adds Library processing exactly once to the final output delay', () => {
  const listening = { known: true, output: output() };
  const library = {
    endpoint: 'aaaa',
    latency: {
      rate: 48000,
      frames: 480,
      parts: [{ stage: 'linearEq' as const, frames: 480, active: true }],
    },
  };
  expect(combineListenedDelay(listening, true, library)?.latency.frames).toBe(
    576,
  );
  expect(combineListenedDelay(listening, false, library)?.latency.frames).toBe(
    96,
  );
  expect(combineListenedDelay(listening, true, undefined)).toBeUndefined();
  expect(
    combineListenedDelay(listening, true, { ...library, endpoint: 'bbbb' }),
  ).toBeUndefined();
  expect(
    combineListenedDelay(listening, true, {
      ...library,
      latency: { ...library.latency, rate: 44100 },
    }),
  ).toBeUndefined();
  expect(
    combineListenedDelay(
      { ...listening, output: { ...output(), latency: library.latency } },
      true,
      library,
    ),
  ).toBeUndefined();
});
