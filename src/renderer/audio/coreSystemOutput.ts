/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { Translate } from 'common/i18n';
import {
  SYSTEM_SOUND_PORT_CHANNEL,
  type TSystemSoundMessage,
} from 'common/systemSound';
import workletUrl from '../remoteAudio/workletUrl';

/** The receiver's name for this one source (`pcmReceiver.worklet.ts`). */
const SYSTEM_SOUND_PEER = 'system-sound';

export interface ICoreSystemOutput {
  stream: MediaStream;
  /**
   * Lets go of it. Stopping the generated track does not: a track made by a
   * stream destination fires no `ended` when it is stopped, so nothing here
   * would hear that it is no longer wanted.
   */
  release: () => void;
}

/**
 * What the speakers play, as heard by the app's core (`src/core/systemSound`)
 * and generated here as an ordinary MediaStream, so every analyser, meter and
 * mirror built on a capture takes it unchanged.
 *
 * The blocks arrive over a port of this window's own and go through the same
 * buffer and resampler Share Audio plays a remote computer through
 * (`pcmReceiver.worklet.ts`), into a stream destination. No `getDisplayMedia`
 * and no device list: those are what started Chromium's capture process, and
 * the core follows the default output by itself, so this stream never needs
 * taking again when the output moves.
 *
 * Rejects when the core cannot hear the output this way at all, and the caller
 * hears it the way it always did. A capture the core loses later ends its
 * track (`ended`, dispatched here), and the caller restarts on it like any
 * other end.
 */
const captureCoreSystemOutput = async (
  t: Translate,
): Promise<ICoreSystemOutput> => {
  const context = new AudioContext();
  const destination = context.createMediaStreamDestination();
  const { stream } = destination;
  const [track] = stream.getAudioTracks();
  const { port1, port2 } = new MessageChannel();
  let receiver: AudioWorkletNode | undefined;
  let mute: GainNode | undefined;
  let isClosed = false;
  let refuseOpening: ((error: Error) => void) | undefined;
  const unavailable = () => new Error(t('eq.smart.error.noAudioTrack'));

  const release = () => {
    if (isClosed) {
      return;
    }
    isClosed = true;
    window.removeEventListener('pagehide', release);
    // Closing the port is what tells main this window has let go.
    port1.close();
    receiver?.port.postMessage({ kind: 'close' });
    receiver?.disconnect();
    mute?.disconnect();
    destination.disconnect();
    stream.getTracks().forEach((candidate) => candidate.stop());
    context.close().catch(() => undefined);
    refuseOpening?.(unavailable());
    refuseOpening = undefined;
  };
  const lost = () => {
    if (!isClosed) {
      release();
      track?.dispatchEvent(new Event('ended'));
    }
  };
  window.addEventListener('pagehide', release, { once: true });

  try {
    if (!track) {
      throw unavailable();
    }
    await context.audioWorklet.addModule(workletUrl().href);
    if (isClosed) {
      throw unavailable();
    }
    receiver = new AudioWorkletNode(context, 'fluideq-remote-audio', {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    });
    receiver.onprocessorerror = lost;
    // A source on this machine, so a buffer only as long as the bursts it
    // comes in: Windows hands loopback over ten milliseconds at a time.
    // Measured against Chromium's capture of the same samples, in one
    // context: a 30 ms buffer put the displays 19.4 ms behind it, 6 to 12 ms
    // put them 9 to 12 ms behind, and none of them dropped a block in 10 to
    // 15 s on a loaded machine. Every display reads this stream, and every
    // millisecond of it is a millisecond the bass lands before the graph
    // moves; a machine that does run it dry grows it in 5 ms steps and gets
    // them back after a minute of steady sound.
    receiver.port.postMessage({
      kind: 'configure',
      peerId: SYSTEM_SOUND_PEER,
      profile: {
        startBufferSeconds: 0.01,
        maximumBufferSeconds: 0.16,
        recoveryStepSeconds: 0.005,
        recoveryDecaySeconds: 60,
        deadbandSeconds: 0.003,
      },
    });
    receiver.port.start();
    receiver.connect(destination);
    // The context's clock is what pulls the worklet, so it has to be running
    // before anything reads the stream; only silence reaches the speakers.
    mute = context.createGain();
    mute.gain.value = 0;
    receiver.connect(mute);
    mute.connect(context.destination);
    await context.resume();
    context.addEventListener('statechange', () => {
      if (!isClosed && context.state === 'suspended') {
        context.resume().catch(lost);
      } else if (!isClosed && context.state === 'closed') {
        lost();
      }
    });

    await new Promise<void>((resolve, reject) => {
      refuseOpening = reject;
      port1.onmessage = ({ data }: MessageEvent<TSystemSoundMessage>) => {
        if (data.kind === 'ready') {
          refuseOpening = undefined;
          resolve();
        } else if (data.kind === 'failed' || data.kind === 'lost') {
          release();
        }
      };
      window.postMessage({ channel: SYSTEM_SOUND_PORT_CHANNEL }, '*', [port2]);
    });
    if (isClosed || track.readyState !== 'live') {
      throw unavailable();
    }
    // From here only the blocks cross into the worklet; anything else on the
    // port is the core losing the output.
    port1.onmessage = ({ data }: MessageEvent<TSystemSoundMessage>) => {
      if (data.kind === 'push') {
        receiver?.port.postMessage({ ...data, peerId: SYSTEM_SOUND_PEER }, [
          data.pcm,
        ]);
      } else if (data.kind === 'failed' || data.kind === 'lost') {
        lost();
      }
    };
    return { stream, release };
  } catch (error) {
    release();
    throw error;
  }
};

export default captureCoreSystemOutput;
