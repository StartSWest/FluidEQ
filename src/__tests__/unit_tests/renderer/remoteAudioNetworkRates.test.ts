/* FluidEQ — GPL-3.0-or-later */

/**
 * The rate on each Share Audio line reads as an average. Main reports every
 * quarter second, and over Wi-Fi a quarter second holds a burst or nothing,
 * so the raw figure moved with every report and two computers showed
 * different figures for the same stream.
 */

import { act, renderHook } from '@testing-library/react';
import type { ILanRemoteAudioNetworkStats } from 'common/remoteAudio';
import useRemoteAudioNetworkStats from 'renderer/remoteAudio/useRemoteAudioNetworkStats';

let report: (stats: ILanRemoteAudioNetworkStats) => void = () => undefined;
let clock = 0;

beforeEach(() => {
  clock = 0;
  jest.spyOn(performance, 'now').mockImplementation(() => clock);
  Object.assign(window, {
    electron: {
      ipcRenderer: {
        onRemoteAudioLanNetwork: (
          listener: (stats: ILanRemoteAudioNetworkStats) => void,
        ) => {
          report = listener;
          return () => undefined;
        },
      },
    },
  });
});

afterEach(() => jest.restoreAllMocks());

/** Bytes a second for this many megabits a second. */
const megabits = (value: number) => (value * 1_000_000) / 8;

const reading = (
  bytesPerSecond: number,
  direction: 'receive' | 'send' = 'receive',
): ILanRemoteAudioNetworkStats => ({
  peerId: 'peer',
  direction,
  bytesPerSecond,
  queuedBytes: 0,
  queuedMilliseconds: 0,
});

const shown = (
  stats: readonly ILanRemoteAudioNetworkStats[],
  direction: 'receive' | 'send' = 'receive',
) => {
  const entry = stats.find((candidate) => candidate.direction === direction);
  return entry ? Math.round(entry.bytesPerSecond / megabits(0.1)) / 10 : NaN;
};

describe('the rate a line shows', () => {
  it('shows the first reading as it is', () => {
    const { result } = renderHook(() => useRemoteAudioNetworkStats(true));
    act(() => report(reading(megabits(3.1))));
    expect(shown(result.current.networkStats)).toBe(3.1);
  });

  it('holds still through bursts around a steady stream', () => {
    const { result } = renderHook(() => useRemoteAudioNetworkStats(true));
    act(() => report(reading(megabits(3.1))));
    // Two seconds of Wi-Fi: a burst, a gap, a burst, every quarter second.
    const bursts = [6.2, 0.4, 5.8, 0.6, 6.0, 0.2, 5.6, 0.8];
    bursts.forEach((value) => {
      clock += 250;
      act(() => report(reading(megabits(value))));
    });
    const figure = shown(result.current.networkStats);
    expect(figure).toBeGreaterThan(2.4);
    expect(figure).toBeLessThan(3.8);
  });

  it('follows a stream that really changes', () => {
    const { result } = renderHook(() => useRemoteAudioNetworkStats(true));
    act(() => report(reading(megabits(3.1))));
    const steady = Array.from({ length: 40 }, () => megabits(6.1));
    steady.forEach((value) => {
      clock += 250;
      act(() => report(reading(value)));
    });
    expect(shown(result.current.networkStats)).toBeCloseTo(6.1, 0);
  });

  it('keeps each direction to itself', () => {
    const { result } = renderHook(() => useRemoteAudioNetworkStats(true));
    act(() => report(reading(megabits(3.1), 'receive')));
    act(() => report(reading(megabits(1.5), 'send')));
    expect(shown(result.current.networkStats, 'receive')).toBe(3.1);
    expect(shown(result.current.networkStats, 'send')).toBe(1.5);
  });
});
