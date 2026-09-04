/* FluidEQ — GPL-3.0-or-later */

import { useCallback, useEffect } from 'react';
import type { TRemoteAudioStreamMode } from '../../common/remoteAudio';
import type { IPcmMixer } from './pcmMixer';
import type { TRemoteAudioPhase, TRemoteAudioRole } from './remoteAudioState';

interface IRemoteAudioRecoveryOptions {
  clearNetworkStats(): void;
  connectedPeerIdsRef: { current: Set<string> };
  lanOptionsCount: number;
  mixerRef: { current: IPcmMixer | undefined };
  peerAddressesRef: { current: Map<string, string> };
  peerIdsRef: { current: Set<string> };
  peerNamesRef: { current: Map<string, string> };
  phase: TRemoteAudioPhase;
  reconnectListener(): Promise<void>;
  reconnectSender(mode: TRemoteAudioStreamMode): Promise<void>;
  role?: TRemoteAudioRole;
  roleRef: { current: TRemoteAudioRole | undefined };
  stoppingRef: { current: boolean };
  streamModeRef: { current: TRemoteAudioStreamMode };
}

/** Keep durable sessions active across socket, adapter, and renderer loss. */
const useRemoteAudioRecovery = ({
  clearNetworkStats,
  connectedPeerIdsRef,
  lanOptionsCount,
  mixerRef,
  peerAddressesRef,
  peerIdsRef,
  peerNamesRef,
  phase,
  reconnectListener,
  reconnectSender,
  role,
  roleRef,
  stoppingRef,
  streamModeRef,
}: IRemoteAudioRecoveryOptions) => {
  const handleLanError = useCallback(() => {
    if (!roleRef.current || stoppingRef.current) {
      return;
    }
    if (roleRef.current === 'sender') {
      reconnectSender(streamModeRef.current).catch(() => undefined);
      return;
    }
    peerIdsRef.current.forEach((peerId) => {
      mixerRef.current?.removePeer(peerId);
    });
    peerIdsRef.current.clear();
    peerNamesRef.current.clear();
    peerAddressesRef.current.clear();
    connectedPeerIdsRef.current.clear();
    clearNetworkStats();
    reconnectListener().catch(() => undefined);
  }, [
    clearNetworkStats,
    connectedPeerIdsRef,
    mixerRef,
    peerAddressesRef,
    peerIdsRef,
    peerNamesRef,
    reconnectListener,
    reconnectSender,
    roleRef,
    stoppingRef,
    streamModeRef,
  ]);

  useEffect(() => {
    if (
      phase !== 'disconnected' &&
      phase !== 'error' &&
      !(role === 'listener' && lanOptionsCount === 0)
    ) {
      return undefined;
    }
    const reconnectWhenNetworkReturns = () => {
      if (roleRef.current === 'sender') {
        reconnectSender(streamModeRef.current).catch(() => undefined);
      } else if (roleRef.current === 'listener') {
        reconnectListener().catch(() => undefined);
      }
    };
    window.addEventListener('online', reconnectWhenNetworkReturns);
    return () => {
      window.removeEventListener('online', reconnectWhenNetworkReturns);
    };
  }, [
    lanOptionsCount,
    phase,
    reconnectListener,
    reconnectSender,
    role,
    roleRef,
    streamModeRef,
  ]);

  return handleLanError;
};

export default useRemoteAudioRecovery;
