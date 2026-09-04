/* FluidEQ — GPL-3.0-or-later */

import { act, renderHook } from '@testing-library/react';
import useRemoteAudioListenerReconnect from '../../../renderer/remoteAudio/useRemoteAudioListenerReconnect';

describe('remote audio listener reconnect', () => {
  it('restores the same listener without requiring a new code', async () => {
    const restoreRemoteAudioLan = jest.fn().mockResolvedValue({
      role: 'listener',
      details: {
        deviceName: 'HEADSET-PC',
        options: [
          {
            address: '192.168.1.20',
            code: 'saved-code',
            deviceName: 'HEADSET-PC',
          },
        ],
      },
    });
    Object.assign(window, {
      electron: { ipcRenderer: { restoreRemoteAudioLan } },
    });
    const setConnectedCount = jest.fn();
    const setConnectedComputers = jest.fn();
    const setDeviceName = jest.fn();
    const setError = jest.fn();
    const setLanOptions = jest.fn();
    const setPhase = jest.fn();
    const { result } = renderHook(() =>
      useRemoteAudioListenerReconnect({
        reconnectGenerationRef: { current: 0 },
        roleRef: { current: 'listener' },
        setConnectedComputers,
        setConnectedCount,
        setDeviceName,
        setError,
        setLanOptions,
        setPhase,
        stoppingRef: { current: false },
        streamModeRef: { current: 'video' },
      }),
    );

    await act(() => result.current());

    expect(restoreRemoteAudioLan).toHaveBeenCalledWith('video');
    expect(setConnectedComputers).toHaveBeenCalledWith([]);
    expect(setConnectedCount).toHaveBeenCalledWith(0);
    expect(setDeviceName).toHaveBeenCalledWith('HEADSET-PC');
    expect(setLanOptions).toHaveBeenCalledWith([
      {
        address: '192.168.1.20',
        code: 'saved-code',
        deviceName: 'HEADSET-PC',
      },
    ]);
    expect(setPhase).toHaveBeenLastCalledWith('waiting');
  });

  it('cannot publish a restore completed after manual stop', async () => {
    let finishRestore: ((value: unknown) => void) | undefined;
    const restoreRemoteAudioLan = jest.fn(
      () =>
        new Promise((resolve) => {
          finishRestore = resolve;
        }),
    );
    Object.assign(window, {
      electron: { ipcRenderer: { restoreRemoteAudioLan } },
    });
    const generationRef = { current: 0 };
    const roleRef: { current: 'listener' | undefined } = {
      current: 'listener',
    };
    const setPhase = jest.fn();
    const { result } = renderHook(() =>
      useRemoteAudioListenerReconnect({
        reconnectGenerationRef: generationRef,
        roleRef,
        setConnectedComputers: jest.fn(),
        setConnectedCount: jest.fn(),
        setDeviceName: jest.fn(),
        setError: jest.fn(),
        setLanOptions: jest.fn(),
        setPhase,
        stoppingRef: { current: false },
        streamModeRef: { current: 'music' },
      }),
    );

    const restoring = result.current();
    roleRef.current = undefined;
    generationRef.current += 1;
    finishRestore?.({
      role: 'listener',
      details: { deviceName: 'HEADSET-PC', options: [] },
    });
    await act(() => restoring);

    expect(setPhase).not.toHaveBeenCalledWith('waiting');
    expect(setPhase).not.toHaveBeenCalledWith('disconnected');
  });
});
