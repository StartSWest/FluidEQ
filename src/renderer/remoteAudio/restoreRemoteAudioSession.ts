/* FluidEQ — GPL-3.0-or-later */

import type {
  ILanPairingOption,
  TRemoteAudioStreamMode,
} from '../../common/remoteAudio';
import type { TRemoteAudioMeterListener } from './meter';
import { createPcmMixer, type IPcmMixer } from './pcmMixer';
import type { TRemoteAudioError, TRemoteAudioRole } from './remoteAudioState';

interface IRestoreRemoteAudioSessionOptions {
  isCancelled(): boolean;
  isCurrentRole(role: TRemoteAudioRole): boolean;
  onBegin(role: TRemoteAudioRole): void;
  onFailure(error: TRemoteAudioError): void;
  onListenerMixer(mixer: IPcmMixer): void;
  onListenerRestored(deviceName: string, options: ILanPairingOption[]): void;
  onPlaybackBlocked(blocked: boolean): void;
  onSenderRestored(deviceName: string): void;
  outputSinkId: string;
  publishMeter: TRemoteAudioMeterListener;
  streamMode: TRemoteAudioStreamMode;
}

/**
 * Restore whichever role was last active without generating a new pairing.
 * The same encrypted listener secret or sender code survives both app and PC
 * restarts; only the user's explicit New Code action replaces it.
 */
const restoreRemoteAudioSession = async ({
  isCancelled,
  isCurrentRole,
  onBegin,
  onFailure,
  onListenerMixer,
  onListenerRestored,
  onPlaybackBlocked,
  onSenderRestored,
  outputSinkId,
  publishMeter,
  streamMode,
}: IRestoreRemoteAudioSessionOptions) => {
  const bridge = window.electron?.ipcRenderer;
  if (!bridge?.getSavedRemoteAudioLanRole || !bridge.restoreRemoteAudioLan) {
    return;
  }
  const savedRole = await bridge.getSavedRemoteAudioLanRole();
  if (isCancelled() || !savedRole || !isCurrentRole(savedRole)) {
    return;
  }
  onBegin(savedRole);
  let restoreError: TRemoteAudioError = 'connection';
  let mixer: IPcmMixer | undefined;
  try {
    if (savedRole === 'listener') {
      restoreError = 'playback';
      mixer = await createPcmMixer(
        outputSinkId,
        onPlaybackBlocked,
        publishMeter,
      );
      if (isCancelled() || !isCurrentRole('listener')) {
        await mixer.close().catch(() => undefined);
        return;
      }
      onListenerMixer(mixer);
    }
    restoreError = 'connection';
    const restored = await bridge.restoreRemoteAudioLan(streamMode);
    if (isCancelled() || !isCurrentRole(savedRole)) {
      if (isCancelled()) {
        await mixer?.close().catch(() => undefined);
      }
      return;
    }
    if (!restored || restored.role !== savedRole) {
      throw new Error('Saved LAN audio session is unavailable.');
    }
    if (restored.role === 'listener') {
      onListenerRestored(restored.details.deviceName, restored.details.options);
    } else {
      onSenderRestored(restored.listener.deviceName);
    }
  } catch {
    if (!isCancelled() && isCurrentRole(savedRole)) {
      await mixer?.close().catch(() => undefined);
      onFailure(restoreError);
    }
  }
};

export default restoreRemoteAudioSession;
