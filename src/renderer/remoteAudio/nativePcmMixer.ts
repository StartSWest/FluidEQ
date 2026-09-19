/* FluidEQ — GPL-3.0-or-later */
import type { IPcmMixer } from './pcmMixer';
import type { TRemoteAudioMeterListener } from './meter';

/** PCM stays in main/native. Only display meters cross into the window. */
export const createNativePcmMixer = async (
  output: string,
  onBlocked: (blocked: boolean) => void,
  onMeter: TRemoteAudioMeterListener,
  volume: number,
): Promise<IPcmMixer> => {
  const bridge = window.electron.ipcRenderer;
  let selectedOutput = output;
  let selectedVolume = volume;
  let session = await bridge.startRemoteAudioPlayback(output, volume);
  let closed = false;
  const unsubscribe = bridge.onRemoteAudioPlayback((event) => {
    if (closed || event.session !== session) {
      return;
    }
    if (event.kind === 'meter') {
      onMeter(event.meter);
    } else {
      onBlocked(true);
    }
  });
  onBlocked(false);
  const command = (
    action: 'output' | 'volume' | 'remove' | 'close',
    value?: string | number,
  ) => bridge.remoteAudioPlaybackCommand(session, action, value);
  return {
    push: () => undefined,
    setPeerMode: () => undefined,
    removePeer: (peerId) => {
      if (!closed) {
        command('remove', peerId).catch(() => onBlocked(true));
      }
    },
    resume: async () => {
      if (closed) {
        return;
      }
      // The old helper can have exited. Reopening gives Resume a fresh native
      // output instead of acknowledging a command to a dead session.
      const nextSession = await bridge.startRemoteAudioPlayback(
        selectedOutput,
        selectedVolume,
      );
      if (closed) {
        await bridge.remoteAudioPlaybackCommand(nextSession, 'close');
        return;
      }
      session = nextSession;
      onBlocked(false);
    },
    setOutput: async (next) => {
      if (!closed) {
        await command('output', next);
        selectedOutput = next;
      }
    },
    setVolume: (next) => {
      if (!closed) {
        selectedVolume = next;
        command('volume', next).catch(() => onBlocked(true));
      }
    },
    close: async () => {
      if (closed) {
        return;
      }
      closed = true;
      unsubscribe();
      await command('close');
    },
  };
};
