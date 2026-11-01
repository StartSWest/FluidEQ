/* FluidEQ — GPL-3.0-or-later */
import { act, renderHook } from '@testing-library/react';
import ChannelEnum from 'common/channels';
import useRemoteAudioRecovery from '../../../renderer/remoteAudio/useRemoteAudioRecovery';
import type { TRemoteAudioPhase } from '../../../renderer/remoteAudio/remoteAudioState';

/**
 * Where a device change comes from. Listening for Chromium's own
 * `devicechange` starts its audio and video capture services and keeps them
 * running, so on Windows, where main pushes every new output list, a Share
 * Audio pairing must not listen for it — and must still retry on the push.
 */
describe('a device plugged in while the sound failed', () => {
  const original = window.electron;
  const originalMedia = navigator.mediaDevices;
  let pushed: ((payload: unknown) => void) | undefined;
  const addListener = jest.fn();
  const removeListener = jest.fn();
  const retry = jest.fn().mockResolvedValue(undefined);

  const mount = (platform: string) => {
    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: {
        platform,
        ipcRenderer: {
          retryRemoteAudioLan: retry,
          on: (channel: string, listener: (payload: unknown) => void) => {
            if (channel === ChannelEnum.AUDIO_DEVICES_CHANGED) {
              pushed = listener;
            }
            return () => undefined;
          },
        },
      },
    });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        addEventListener: addListener,
        removeEventListener: removeListener,
      },
    });
    return renderHook(() =>
      useRemoteAudioRecovery('playback-blocked', true, jest.fn(), jest.fn()),
    );
  };

  afterEach(() => {
    pushed = undefined;
    jest.clearAllMocks();
    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: original,
    });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: originalMedia,
    });
  });

  it('hears it from main on Windows and never wakes Chromium’s devices service', () => {
    const view = mount('win32');
    try {
      expect(addListener).not.toHaveBeenCalled();
      act(() => {
        pushed?.({ result: [] });
      });
      expect(retry).toHaveBeenCalledTimes(1);
    } finally {
      view.unmount();
    }
  });

  it('listens to Chromium where main does not follow the outputs', () => {
    // POSITIVE CONTROL: the same pairing elsewhere retries on `devicechange`.
    const view = mount('linux');
    try {
      expect(addListener).toHaveBeenCalledWith(
        'devicechange',
        expect.any(Function),
      );
      const [[, listener]] = addListener.mock.calls as [[string, () => void]];
      act(() => {
        listener();
      });
      expect(retry).toHaveBeenCalledTimes(1);
    } finally {
      view.unmount();
    }
    expect(removeListener).toHaveBeenCalledWith(
      'devicechange',
      expect.any(Function),
    );
  });
});

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
