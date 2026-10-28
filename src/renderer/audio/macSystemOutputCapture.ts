/* FluidEQ — GPL-3.0-or-later */

import type { Translate } from 'common/i18n';
import {
  MAC_AUDIO_CAPTURE_PORT,
  type TMacAudioCaptureMessage,
} from 'common/macAudioCapture';
import workletUrl from '../remoteAudio/workletUrl';

const captures = new WeakMap<MediaStream, () => void>();

/** Release the native tap too: stopping a generated track fires no ended event. */
export const releaseMacSystemOutput = (stream: MediaStream) => {
  captures.get(stream)?.();
};

/**
 * Chromium rejects legacy desktop audio without video with bad IPC 263 and
 * KILLS the renderer; a catch cannot recover it. A Core Audio tap delivers
 * PCM over a private port instead. No display/getUserMedia request is made.
 * Its generated stream keeps the existing analyser and mirror graph intact.
 */
const captureMacSystemOutput = async (t: Translate): Promise<MediaStream> => {
  const permission = await window.electron.ipcRenderer.getMacAudioPermission();
  if (permission === 'denied') {
    throw new DOMException(
      t('notice.captureNeedsMacPermission'),
      'NotAllowedError',
    );
  }
  const context = new AudioContext();
  const destination = context.createMediaStreamDestination();
  const { stream } = destination;
  const [track] = stream.getAudioTracks();
  const { port1, port2 } = new MessageChannel();
  let receiver: AudioWorkletNode | undefined;
  let mute: GainNode | undefined;
  let closed = false;
  let refuseOpening: ((error: Error) => void) | undefined;
  const close = () => {
    if (closed) {
      return;
    }
    closed = true;
    captures.delete(stream);
    window.removeEventListener('pagehide', close);
    port1.close();
    port2.close();
    receiver?.port.postMessage({ kind: 'close' });
    receiver?.disconnect();
    mute?.disconnect();
    destination.disconnect();
    stream.getTracks().forEach((candidate) => candidate.stop());
    context.close().catch(() => undefined);
    refuseOpening?.(new Error(t('eq.smart.error.noAudioTrack')));
    refuseOpening = undefined;
  };
  const lost = () => {
    if (!closed) {
      close();
      track?.dispatchEvent(new Event('ended'));
    }
  };
  captures.set(stream, close);
  window.addEventListener('pagehide', close, { once: true });
  try {
    if (!track) {
      throw new Error(t('eq.smart.error.noAudioTrack'));
    }
    await context.audioWorklet.addModule(workletUrl().href);
    if (closed) {
      throw new Error(t('eq.smart.error.noAudioTrack'));
    }
    receiver = new AudioWorkletNode(context, 'fluideq-remote-audio', {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    });
    receiver.onprocessorerror = lost;
    // Use the existing local PCM resampler/buffer, never a network reservoir.
    receiver.port.postMessage({
      kind: 'configure',
      peerId: 'mac-loopback',
      profile: {
        startBufferSeconds: 0.03,
        maximumBufferSeconds: 0.16,
        recoveryStepSeconds: 0.01,
        recoveryDecaySeconds: 60,
        deadbandSeconds: 0.005,
      },
    });
    receiver.port.start();
    receiver.connect(destination);
    // The audio clock pulls the worklet even before an analyser consumes its
    // generated track. Only silence reaches speakers: no tap feeds itself.
    mute = context.createGain();
    mute.gain.value = 0;
    receiver.connect(mute);
    mute.connect(context.destination);
    await context.resume();
    if (closed) {
      throw new Error(t('eq.smart.error.noAudioTrack'));
    }
    context.addEventListener('statechange', () => {
      if (!closed && context.state === 'suspended') {
        context.resume().catch(lost);
      } else if (!closed && context.state === 'closed') {
        lost();
      }
    });
    const ready = new Promise<void>((resolve, reject) => {
      refuseOpening = reject;
      port1.onmessage = ({ data }: MessageEvent<TMacAudioCaptureMessage>) => {
        if (data.kind === 'ready') {
          refuseOpening = undefined;
          resolve();
        } else if (data.kind === 'failed' || data.kind === 'lost') {
          lost();
        }
      };
      port1.addEventListener('close', lost, { once: true });
      window.postMessage({ channel: MAC_AUDIO_CAPTURE_PORT }, '*', [port2]);
    });
    await ready;
    if (closed || track.readyState !== 'live') {
      throw new Error(t('eq.smart.error.noAudioTrack'));
    }
    // Keep lifecycle messages on this side; only PCM crosses into the worklet.
    port1.onmessage = ({ data }: MessageEvent<TMacAudioCaptureMessage>) => {
      if (data.kind === 'push') {
        receiver?.port.postMessage(data, [data.pcm]);
      } else if (data.kind === 'failed' || data.kind === 'lost') {
        lost();
      }
    };
    return stream;
  } catch (error) {
    close();
    throw error;
  }
};

export default captureMacSystemOutput;
