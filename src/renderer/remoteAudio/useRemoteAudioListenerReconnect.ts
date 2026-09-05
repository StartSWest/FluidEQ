/* FluidEQ — GPL-3.0-or-later */

import { useCallback } from 'react';
import type {
  ILanPairingOption,
  TRemoteAudioStreamMode,
} from '../../common/remoteAudio';
import type {
  IRemoteAudioComputer,
  TRemoteAudioError,
  TRemoteAudioPhase,
  TRemoteAudioRole,
} from './remoteAudioState';

interface IListenerReconnectOptions {
  reconnectGenerationRef: { current: number };
  roleRef: { current: TRemoteAudioRole | undefined };
  setConnectedComputers(computers: IRemoteAudioComputer[]): void;
  setConnectedCount(count: number): void;
  setDeviceName(name: string): void;
  setError(error: TRemoteAudioError | undefined): void;
  setLanOptions(options: ILanPairingOption[]): void;
  setPhase(phase: TRemoteAudioPhase): void;
  stoppingRef: { current: boolean };
  streamModeRef: { current: TRemoteAudioStreamMode };
}

/**
 * A listener binds the wildcard interface, so it can stay alive while Wi-Fi is
 * absent and accept paired senders as soon as the adapter returns. This path
 * replaces only a listener whose socket actually failed; a manual stop changes
 * both role and generation before the pending restore can publish anything.
 */
const useRemoteAudioListenerReconnect = ({
  reconnectGenerationRef,
  roleRef,
  setConnectedComputers,
  setConnectedCount,
  setDeviceName,
  setError,
  setLanOptions,
  setPhase,
  stoppingRef,
  streamModeRef,
}: IListenerReconnectOptions) =>
  useCallback(async () => {
    if (roleRef.current !== 'listener' || stoppingRef.current) {
      return;
    }
    const attempt = reconnectGenerationRef.current + 1;
    reconnectGenerationRef.current = attempt;
    setConnectedComputers([]);
    setConnectedCount(0);
    setError(undefined);
    setPhase('preparing');
    try {
      const restored = await window.electron.ipcRenderer.restoreRemoteAudioLan(
        streamModeRef.current,
      );
      if (
        roleRef.current !== 'listener' ||
        stoppingRef.current ||
        reconnectGenerationRef.current !== attempt
      ) {
        return;
      }
      if (!restored || restored.role !== 'listener') {
        throw new Error('Saved LAN listener is unavailable.');
      }
      setDeviceName(restored.details.deviceName);
      setLanOptions(restored.details.options);
      setPhase('waiting');
    } catch {
      if (
        roleRef.current === 'listener' &&
        !stoppingRef.current &&
        reconnectGenerationRef.current === attempt
      ) {
        setError('connection');
        setPhase('disconnected');
      }
    }
  }, [
    reconnectGenerationRef,
    roleRef,
    setConnectedComputers,
    setConnectedCount,
    setDeviceName,
    setError,
    setLanOptions,
    setPhase,
    stoppingRef,
    streamModeRef,
  ]);

export default useRemoteAudioListenerReconnect;
