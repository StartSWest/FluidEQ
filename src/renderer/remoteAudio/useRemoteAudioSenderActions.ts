/* FluidEQ — GPL-3.0-or-later */

import { useCallback } from 'react';
import type {
  ILanRemoteComputer,
  TRemoteAudioStreamMode,
} from '../../common/remoteAudio';
import type {
  TRemoteAudioError,
  TRemoteAudioPhase,
  TRemoteAudioRole,
} from './remoteAudioState';

interface IRemoteAudioSenderActionsOptions {
  clearConnection(notify: boolean, forget: boolean): Promise<void>;
  publishConnected(name: string): void;
  roleRef: { current: TRemoteAudioRole | undefined };
  setError(error: TRemoteAudioError | undefined): void;
  setPhase(phase: TRemoteAudioPhase): void;
  setRole(role: TRemoteAudioRole | undefined): void;
  streamModeRef: { current: TRemoteAudioStreamMode };
}

const useRemoteAudioSenderActions = ({
  clearConnection,
  publishConnected,
  roleRef,
  setError,
  setPhase,
  setRole,
  streamModeRef,
}: IRemoteAudioSenderActionsOptions) => {
  const begin = useCallback(
    async (connect: () => Promise<ILanRemoteComputer | undefined>) => {
      await clearConnection(false, false);
      roleRef.current = 'sender';
      setRole('sender');
      setError(undefined);
      setPhase('preparing');
      try {
        const listener = await connect();
        if (roleRef.current !== 'sender') {
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
        if (roleRef.current === 'sender') {
          roleRef.current = undefined;
          setRole(undefined);
          setError('lan');
          setPhase('error');
        }
      }
    },
    [clearConnection, publishConnected, roleRef, setError, setPhase, setRole],
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
  const resumeSending = useCallback(
    () =>
      begin(() =>
        window.electron.ipcRenderer.resumeRemoteAudioLanSender(
          streamModeRef.current,
        ),
      ),
    [begin, streamModeRef],
  );
  return { resumeSending, startSending };
};

export default useRemoteAudioSenderActions;
