/* FluidEQ — GPL-3.0-or-later */

import { useCallback } from 'react';
import type { TRemoteAudioStreamMode } from '../../common/remoteAudio';
import type { IPcmSender } from './pcmSender';
import type {
  TRemoteAudioError,
  TRemoteAudioPhase,
  TRemoteAudioRole,
} from './remoteAudioState';
import restoreRemoteAudioSender from './restoreRemoteAudioSender';

interface IRemoteAudioSenderReconnectOptions {
  publishConnected(name: string): void;
  removeNetworkPeer(peerId: string): void;
  roleRef: { current: TRemoteAudioRole | undefined };
  senderPeerIdRef: { current: string | undefined };
  senderReconnectGenerationRef: { current: number };
  senderRef: { current: IPcmSender | undefined };
  senderStartingRef: { current: boolean };
  setConnectedCount(count: number): void;
  setError(error: TRemoteAudioError | undefined): void;
  setPhase(phase: TRemoteAudioPhase): void;
  stoppingRef: { current: boolean };
  streamModeRef: { current: TRemoteAudioStreamMode };
}

/**
 * Every reconnect owns a generation. A new mode selection deliberately stops
 * the previous IPC restore, so the rejected older promise must not be allowed
 * to paint a failure over the newer authenticated session.
 */
const useRemoteAudioSenderReconnect = ({
  publishConnected,
  removeNetworkPeer,
  roleRef,
  senderPeerIdRef,
  senderReconnectGenerationRef,
  senderRef,
  senderStartingRef,
  setConnectedCount,
  setError,
  setPhase,
  stoppingRef,
  streamModeRef,
}: IRemoteAudioSenderReconnectOptions) =>
  useCallback(
    async (mode: TRemoteAudioStreamMode) => {
      if (roleRef.current !== 'sender' || stoppingRef.current) {
        return;
      }
      const attempt = senderReconnectGenerationRef.current + 1;
      senderReconnectGenerationRef.current = attempt;
      const previousPeerId = senderPeerIdRef.current;
      senderRef.current?.close();
      senderRef.current = undefined;
      senderStartingRef.current = false;
      senderPeerIdRef.current = undefined;
      if (previousPeerId) {
        removeNetworkPeer(previousPeerId);
      }
      setConnectedCount(0);
      setError(undefined);
      setPhase('connecting');
      await restoreRemoteAudioSender({
        isActive: () =>
          roleRef.current === 'sender' &&
          !stoppingRef.current &&
          senderReconnectGenerationRef.current === attempt &&
          streamModeRef.current === mode,
        onConnected: publishConnected,
        onDisconnected: () => setPhase('disconnected'),
        onFailure: () => {
          setPhase('disconnected');
          setError('connection');
        },
        streamMode: mode,
      });
    },
    [
      publishConnected,
      removeNetworkPeer,
      roleRef,
      senderPeerIdRef,
      senderReconnectGenerationRef,
      senderRef,
      senderStartingRef,
      setConnectedCount,
      setError,
      setPhase,
      stoppingRef,
      streamModeRef,
    ],
  );

export default useRemoteAudioSenderReconnect;
