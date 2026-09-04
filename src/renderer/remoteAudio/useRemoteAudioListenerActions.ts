/* FluidEQ — GPL-3.0-or-later */

import { useCallback } from 'react';
import type {
  ILanPairingOption,
  TRemoteAudioStopMode,
} from '../../common/remoteAudio';
import { createPcmMixer, type IPcmMixer } from './pcmMixer';
import type { TRemoteAudioMeterListener } from './meter';
import type {
  TRemoteAudioError,
  TRemoteAudioPhase,
  TRemoteAudioRole,
} from './remoteAudioState';

interface IListenerActionOptions {
  clearConnection(
    notify: boolean,
    stopMode: TRemoteAudioStopMode,
  ): Promise<void>;
  mixerRef: { current: IPcmMixer | undefined };
  outputSinkIdRef: { current: string };
  playbackBlockedRef: { current: boolean };
  publishListenerState(): void;
  publishMeter: TRemoteAudioMeterListener;
  reconnectGenerationRef: { current: number };
  roleRef: { current: TRemoteAudioRole | undefined };
  setDeviceName(name: string): void;
  setError(error: TRemoteAudioError | undefined): void;
  setLanOptions(options: ILanPairingOption[]): void;
  setPhase(phase: TRemoteAudioPhase): void;
  setRole(role: TRemoteAudioRole | undefined): void;
}

const useRemoteAudioListenerActions = ({
  clearConnection,
  mixerRef,
  outputSinkIdRef,
  playbackBlockedRef,
  publishListenerState,
  publishMeter,
  reconnectGenerationRef,
  roleRef,
  setDeviceName,
  setError,
  setLanOptions,
  setPhase,
  setRole,
}: IListenerActionOptions) =>
  useCallback(
    async (replaceCode = false) => {
      await clearConnection(false, 'pause');
      const attempt = reconnectGenerationRef.current + 1;
      reconnectGenerationRef.current = attempt;
      roleRef.current = 'listener';
      setRole('listener');
      setPhase('preparing');
      let mixer: IPcmMixer;
      try {
        mixer = await createPcmMixer(
          outputSinkIdRef.current,
          (blocked) => {
            playbackBlockedRef.current = blocked;
            publishListenerState();
          },
          publishMeter,
        );
      } catch {
        if (
          roleRef.current === 'listener' &&
          reconnectGenerationRef.current === attempt
        ) {
          roleRef.current = undefined;
          setRole(undefined);
          setError('playback');
          setPhase('error');
        }
        return;
      }
      if (
        roleRef.current !== 'listener' ||
        reconnectGenerationRef.current !== attempt
      ) {
        await mixer.close().catch(() => undefined);
        return;
      }
      mixerRef.current = mixer;
      try {
        const details =
          await window.electron.ipcRenderer.startRemoteAudioLanHost(
            replaceCode,
          );
        if (
          roleRef.current === 'listener' &&
          reconnectGenerationRef.current === attempt
        ) {
          setDeviceName(details.deviceName);
          setLanOptions(details.options);
          setPhase('waiting');
        }
      } catch {
        if (
          roleRef.current === 'listener' &&
          reconnectGenerationRef.current === attempt
        ) {
          if (mixerRef.current === mixer) {
            mixerRef.current = undefined;
          }
          await mixer.close().catch(() => undefined);
          roleRef.current = undefined;
          setRole(undefined);
          setError('lan');
          setPhase('error');
        }
      }
    },
    [
      clearConnection,
      mixerRef,
      outputSinkIdRef,
      playbackBlockedRef,
      publishListenerState,
      publishMeter,
      reconnectGenerationRef,
      roleRef,
      setDeviceName,
      setError,
      setLanOptions,
      setPhase,
      setRole,
    ],
  );

export default useRemoteAudioListenerActions;
