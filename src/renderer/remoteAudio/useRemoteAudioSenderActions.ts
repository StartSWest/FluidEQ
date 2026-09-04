/* FluidEQ — GPL-3.0-or-later */

import { useCallback } from 'react';
import type {
  ILanRemoteComputer,
  TRemoteAudioStopMode,
  TRemoteAudioStreamMode,
} from '../../common/remoteAudio';
import type {
  TRemoteAudioError,
  TRemoteAudioPhase,
  TRemoteAudioRole,
} from './remoteAudioState';

interface IRemoteAudioSenderActionsOptions {
  clearConnection(
    notify: boolean,
    stopMode: TRemoteAudioStopMode,
  ): Promise<void>;
  publishConnected(name: string): void;
  reconnectGenerationRef: { current: number };
  roleRef: { current: TRemoteAudioRole | undefined };
  setError(error: TRemoteAudioError | undefined): void;
  setPhase(phase: TRemoteAudioPhase): void;
  setRole(role: TRemoteAudioRole | undefined): void;
  streamModeRef: { current: TRemoteAudioStreamMode };
}

const useRemoteAudioSenderActions = ({
  clearConnection,
  publishConnected,
  reconnectGenerationRef,
  roleRef,
  setError,
  setPhase,
  setRole,
  streamModeRef,
}: IRemoteAudioSenderActionsOptions) => {
  const begin = useCallback(
    async (connect: () => Promise<ILanRemoteComputer | undefined>) => {
      await clearConnection(false, 'pause');
      const attempt = reconnectGenerationRef.current + 1;
      reconnectGenerationRef.current = attempt;
      roleRef.current = 'sender';
      setRole('sender');
      setError(undefined);
      setPhase('preparing');
      try {
        const listener = await connect();
        if (
          roleRef.current !== 'sender' ||
          reconnectGenerationRef.current !== attempt
        ) {
          return;
        }
        if (listener) {
          publishConnected(listener.deviceName);
        } else {
          roleRef.current = undefined;
          setRole(undefined);
          setPhase('idle');
        }
      } catch {
        if (
          roleRef.current === 'sender' &&
          reconnectGenerationRef.current === attempt
        ) {
          roleRef.current = undefined;
          setRole(undefined);
          setError('lan');
          setPhase('error');
        }
      }
    },
    [
      clearConnection,
      publishConnected,
      reconnectGenerationRef,
      roleRef,
      setError,
      setPhase,
      setRole,
    ],
  );

  const startSending = useCallback(
    (code: string) =>
      begin(() =>
        window.electron.ipcRenderer.joinRemoteAudioLan(
          code.trim(),
          streamModeRef.current,
        ),
      ),
    [begin, streamModeRef],
  );
  return { startSending };
};

export default useRemoteAudioSenderActions;
