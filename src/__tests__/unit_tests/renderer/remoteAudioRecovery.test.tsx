/* FluidEQ — GPL-3.0-or-later */
import { act, renderHook } from '@testing-library/react';
import useRemoteAudioRecovery from '../../../renderer/remoteAudio/useRemoteAudioRecovery';
import type { TRemoteAudioPhase } from '../../../renderer/remoteAudio/remoteAudioState';

it('reconnects and reopens audio on network return and OS resume, without restarting healthy audio on focus', async () => {
  const original = window.electron;
  let wake: (() => void) | undefined;
  const retry = jest.fn().mockResolvedValue(undefined);
  const start = jest.fn().mockResolvedValue(undefined);
  const recover = jest.fn();
  const stop = jest.fn();
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      ipcRenderer: {
        retryRemoteAudioLan: retry,
        onRemoteAudioLanResume: (listener: () => void) => {
          wake = listener;
          return stop;
        },
      },
    },
  });
  const view = renderHook(
    ({ phase, failed }: { phase: TRemoteAudioPhase; failed: boolean }) =>
      useRemoteAudioRecovery(phase, failed, start, recover),
    {
      initialProps: { phase: 'ready' as TRemoteAudioPhase, failed: false },
    },
  );
  try {
    act(() => {
      window.dispatchEvent(new FocusEvent('focus'));
    });
    expect(recover).not.toHaveBeenCalled();
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(retry).toHaveBeenCalledTimes(1);
    expect(recover).toHaveBeenCalledTimes(1);
    act(() => {
      wake?.();
    });
    expect(recover).toHaveBeenCalledTimes(2);
    view.rerender({ phase: 'playback-blocked', failed: true });
    act(() => {
      window.dispatchEvent(new FocusEvent('focus'));
    });
    expect(retry).toHaveBeenCalledTimes(2);
    view.rerender({ phase: 'error', failed: true });
    await act(async () => {
      wake?.();
    });
    expect(start).toHaveBeenCalledTimes(1);
    view.rerender({ phase: 'idle', failed: false });
    retry.mockClear();
    recover.mockClear();
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(retry).not.toHaveBeenCalled();
    expect(recover).not.toHaveBeenCalled();
  } finally {
    view.unmount();
    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: original,
    });
  }
});
