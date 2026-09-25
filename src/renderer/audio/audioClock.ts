/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import workletUrl from '../remoteAudio/workletUrl';
import {
  AUDIO_CLOCK_PROCESSOR,
  AUDIO_CLOCK_TICKS_PER_SECOND,
} from './audioClockNames';

/**
 * A tick every thirtieth of a second of audio, on any context that renders.
 *
 * The clock in `audioClock.worklet.ts`, put on whatever context needs one. It counts the samples the audio thread renders,
 * so it runs exactly as long as the context does and at its pace: behind a
 * minimised window, where animation frames stop altogether and the window's
 * timers are throttled to one a second and then one a minute, it keeps
 * time the way the sound does. A Smart EQ measurement left running with the
 * window down is the case it exists for.
 *
 * Every tick carries the audio it stands for, in milliseconds, so a reader
 * that scales a rate by time scales it by the audio that actually passed.
 */

export { AUDIO_CLOCK_TICKS_PER_SECOND };

export interface IAudioClock {
  /** Stops the ticks and takes the clock's two nodes off the context. */
  close(): void;
}

/**
 * Loads the one worklet bundle into `context`, which is where the clock's
 * processor is registered. A context that already has it — the output mirror
 * and the lights load it into the capture's — resolves at once.
 */
export const loadAudioClock = (context: BaseAudioContext): Promise<void> =>
  context.audioWorklet.addModule(workletUrl().href);

/**
 * Each connection this made, and only those. A context that has been closed
 * has taken its nodes down already, and the browser answers a second
 * disconnect with InvalidAccessError — which here means the work is done.
 */
const disconnect = (node: AudioNode) => {
  try {
    node.disconnect();
  } catch (error) {
    if (!(
      error instanceof DOMException && error.name === 'InvalidAccessError'
    )) {
      throw error;
    }
  }
};

/**
 * Starts a clock on `context`, after `loadAudioClock` has resolved for it.
 *
 * `onTick` is handed the audio each tick stands for, in milliseconds.
 */
export const startAudioClock = (
  context: AudioContext,
  onTick: (audioMs: number) => void,
): IAudioClock => {
  const clock = new AudioWorkletNode(context, AUDIO_CLOCK_PROCESSOR, {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1],
  });
  // Silent, and connected all the way to the destination: a node the graph
  // does not pull toward an output is not guaranteed to be processed at all,
  // and an unprocessed clock never ticks. Through a gain of zero nothing
  // reaches the endpoint, so a capture that is a loopback of that same
  // endpoint hears nothing of it.
  const mute = context.createGain();
  mute.gain.value = 0;
  clock.connect(mute).connect(context.destination);
  let isClosed = false;
  clock.port.onmessage = ({ data }: MessageEvent<unknown>) => {
    if (isClosed || typeof data !== 'number' || !Number.isFinite(data)) {
      return;
    }
    onTick(data);
  };
  return {
    close: () => {
      if (isClosed) {
        return;
      }
      isClosed = true;
      clock.port.onmessage = null;
      clock.port.close();
      disconnect(clock);
      disconnect(mute);
    },
  };
};
