/* FluidEQ — GPL-3.0-or-later */

import { act, renderHook } from '@testing-library/react';

const mockRestoreRemoteAudioSender = jest.fn().mockResolvedValue(undefined);

jest.mock('../../../renderer/remoteAudio/restoreRemoteAudioSender', () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockRestoreRemoteAudioSender(...args),
}));

// eslint-disable-next-line import/first
import useRemoteAudioSenderReconnect from '../../../renderer/remoteAudio/useRemoteAudioSenderReconnect';

describe('remote audio sender reconnect', () => {
  beforeEach(() => jest.clearAllMocks());

  it('closes the old stream and starts a fresh authenticated restore', async () => {
    const close = jest.fn();
    const removeNetworkPeer = jest.fn();
    const setConnectedCount = jest.fn();
    const setError = jest.fn();
    const setPhase = jest.fn();
    const roleRef: { current: 'listener' | 'sender' | undefined } = {
      current: 'sender',
    };
    const senderPeerIdRef: { current: string | undefined } = {
      current: 'old-peer',
    };
    const senderReconnectGenerationRef = { current: 0 };
    const senderRef = { current: { close } };
    const streamModeRef = { current: 'video' as const };
    const { result } = renderHook(() =>
      useRemoteAudioSenderReconnect({
        publishConnected: jest.fn(),
        removeNetworkPeer,
        roleRef,
        senderPeerIdRef,
        senderReconnectGenerationRef,
        senderRef,
        senderStartingRef: { current: true },
        setConnectedCount,
        setError,
        setPhase,
        stoppingRef: { current: false },
        streamModeRef,
      }),
    );

    await act(() => result.current('video'));

    expect(close).toHaveBeenCalledTimes(1);
    expect(senderPeerIdRef.current).toBeUndefined();
    expect(removeNetworkPeer).toHaveBeenCalledWith('old-peer');
    expect(setConnectedCount).toHaveBeenCalledWith(0);
    expect(setError).toHaveBeenCalledWith(undefined);
    expect(setPhase).toHaveBeenCalledWith('connecting');
    expect(mockRestoreRemoteAudioSender).toHaveBeenCalledTimes(1);
    const restoreOptions = mockRestoreRemoteAudioSender.mock.calls[0][0] as {
      isActive(): boolean;
      streamMode: string;
    };
    expect(restoreOptions.streamMode).toBe('video');
    expect(restoreOptions.isActive()).toBe(true);

    senderReconnectGenerationRef.current += 1;
    expect(restoreOptions.isActive()).toBe(false);
  });
});
