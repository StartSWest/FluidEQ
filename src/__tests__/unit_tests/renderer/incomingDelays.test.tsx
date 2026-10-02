/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * One delay per linked computer whose sound is playing here — what the
 * Share page's lane, the second output and the player bar all show, so the
 * three never disagree. An average that moves only by a step worth reading.
 */

import { act, renderHook } from '@testing-library/react';
import type {
  IRemoteAudioMeter,
  TRemoteAudioMeterListener,
} from 'renderer/remoteAudio/meter';
import useIncomingDelays from 'renderer/remoteAudio/useIncomingDelays';

const bus = () => {
  const listeners = new Set<TRemoteAudioMeterListener>();
  return {
    subscribe: (listener: TRemoteAudioMeterListener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    emit: (meter: Partial<IRemoteAudioMeter>) =>
      act(() =>
        listeners.forEach((listener) =>
          listener({
            peak: 0.2,
            rms: 0.1,
            waveform: new Float32Array(8),
            ...meter,
          } as IRemoteAudioMeter),
        ),
      ),
  };
};

describe('the incoming delays', () => {
  it('keeps one figure per computer whose sound arrives', () => {
    const meters = bus();
    const { result } = renderHook(() =>
      useIncomingDelays(meters.subscribe, ['yoga', 'office']),
    );
    meters.emit({ sourceId: 'yoga', bufferedMs: 144.6 });
    meters.emit({ sourceId: 'office', bufferedMs: 60 });
    expect(result.current).toEqual({ yoga: 145, office: 60 });
  });

  it('ignores this computer’s own sound and computers not arriving', () => {
    const meters = bus();
    const { result } = renderHook(() =>
      useIncomingDelays(meters.subscribe, ['yoga']),
    );
    meters.emit({ sourceId: undefined, bufferedMs: 20 });
    meters.emit({ sourceId: 'stranger', bufferedMs: 80 });
    meters.emit({ sourceId: 'yoga', bufferedMs: undefined });
    expect(result.current).toEqual({});
  });

  it('moves only when the delay really moves', () => {
    const meters = bus();
    const { result } = renderHook(() =>
      useIncomingDelays(meters.subscribe, ['yoga']),
    );
    meters.emit({ sourceId: 'yoga', bufferedMs: 145 });
    const first = result.current;
    meters.emit({ sourceId: 'yoga', bufferedMs: 146 });
    // The same object: nothing reading it is redrawn for a jitter.
    expect(result.current).toBe(first);
  });

  it('forgets a computer whose sound stops, and starts it afresh after', () => {
    const meters = bus();
    const { result, rerender } = renderHook(
      ({ ids }: { ids: string[] }) => useIncomingDelays(meters.subscribe, ids),
      { initialProps: { ids: ['yoga'] } },
    );
    meters.emit({ sourceId: 'yoga', bufferedMs: 145 });
    rerender({ ids: [] });
    expect(result.current).toEqual({});
    rerender({ ids: ['yoga'] });
    meters.emit({ sourceId: 'yoga', bufferedMs: 60 });
    // A fresh average shows the first reading as it is, not 145 drifting
    // down.
    expect(result.current).toEqual({ yoga: 60 });
  });
});
