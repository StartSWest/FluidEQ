/* FluidEQ — GPL-3.0-or-later */

import { act, renderHook } from '@testing-library/react';
import useRemoteAudioRecovery from '../../../renderer/remoteAudio/useRemoteAudioRecovery';

const recoveryOptions = () => ({
  clearNetworkStats: jest.fn(),
  connectedPeerIdsRef: { current: new Set<string>() },
  lanOptionsCount: 1,
  mixerRef: { current: undefined },
  peerAddressesRef: { current: new Map<string, string>() },
  peerIdsRef: { current: new Set<string>() },
  peerNamesRef: { current: new Map<string, string>() },
  phase: 'disconnected' as const,
  reconnectListener: jest.fn().mockResolvedValue(undefined),
  reconnectSender: jest.fn().mockResolvedValue(undefined),
  role: 'listener' as const,
  roleRef: { current: 'listener' as const },
  stoppingRef: { current: false },
  streamModeRef: { current: 'video' as const },
});

describe('remote audio background recovery', () => {
  it('retries the active listener when the network returns', () => {
    const options = recoveryOptions();
    renderHook(() => useRemoteAudioRecovery(options));

    act(() => window.dispatchEvent(new Event('online')));

    expect(options.reconnectListener).toHaveBeenCalledTimes(1);
    expect(options.reconnectSender).not.toHaveBeenCalled();
  });

  it('does not retry a session after manual stop cleared its role', () => {
    const options = recoveryOptions();
    const { roleRef }: { roleRef: { current: 'listener' | undefined } } =
      options;
    roleRef.current = undefined;
    renderHook(() =>
      useRemoteAudioRecovery({ ...options, role: undefined, roleRef }),
    );

    act(() => window.dispatchEvent(new Event('online')));

    expect(options.reconnectListener).not.toHaveBeenCalled();
    expect(options.reconnectSender).not.toHaveBeenCalled();
  });
});
