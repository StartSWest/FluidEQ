/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Fit dialog's sound: a burst that walks around the listener — front,
 * right, behind, left — rendered through one head.
 *
 * Rendered once per head, offline, and played back as a buffer: the listener
 * compares two heads on the same sound, so the sound has to be identical
 * to the sample, and a live convolution per press would not be. A moving
 * source rather than a source in front, because what separates one head
 * from another is heard most where the sound goes to the side and behind.
 */

import { IRoomHeadBlock, nearestDirection } from '../../common/roomHeadText';

/** Front, right, behind, left: one burst at each. */
const STOPS_DEG = [0, 90, 180, 270];
const BURST_SECONDS = 0.35;
const STEP_SECONDS = 0.6;
const LEAD_SECONDS = 0.1;
const TAIL_SECONDS = 0.4;

export const FIT_DEMO_SECONDS =
  LEAD_SECONDS +
  STEP_SECONDS * (STOPS_DEG.length - 1) +
  BURST_SECONDS +
  TAIL_SECONDS;

/**
 * A short pink burst with a soft edge. Pink rather than white: white noise
 * through a head is all hiss, and the cues that place a sound are in the
 * middle of the spectrum.
 */
const pinkBurst = (context: BaseAudioContext, seed: number): AudioBuffer => {
  const frames = Math.round(context.sampleRate * BURST_SECONDS);
  const buffer = context.createBuffer(1, frames, context.sampleRate);
  const out = buffer.getChannelData(0);
  // Paul Kellet's pink filter over a small deterministic generator
  // (Park–Miller, whose product stays below 2^47 and so exact in a double),
  // so the two heads are heard on the very same noise.
  let state = seed;
  const random = () => {
    state = (state * 48271) % 2147483647;
    return state / 2147483647 - 0.5;
  };
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  const edge = Math.round(context.sampleRate * 0.02);
  for (let at = 0; at < frames; at += 1) {
    const white = random();
    b0 = 0.99765 * b0 + white * 0.099046;
    b1 = 0.963 * b1 + white * 0.2965164;
    b2 = 0.57 * b2 + white * 1.0526913;
    const pink = (b0 + b1 + b2 + white * 0.1848) * 0.25;
    const fade = Math.min(1, at / edge, (frames - at) / edge);
    out[at] = pink * fade;
  }
  return buffer;
};

/** The demo through `block`, at the block's own rate. */
export const renderFitDemo = async (
  block: IRoomHeadBlock,
): Promise<AudioBuffer> => {
  const rate = block.sampleRate;
  const context = new OfflineAudioContext(
    2,
    Math.round(rate * FIT_DEMO_SECONDS),
    rate,
  );
  const burst = pinkBurst(context, 7);
  STOPS_DEG.forEach((angle, at) => {
    const direction = nearestDirection(block, angle);
    const impulse = context.createBuffer(2, block.taps, rate);
    impulse.copyToChannel(block.left[direction], 0);
    impulse.copyToChannel(block.right[direction], 1);
    const convolver = context.createConvolver();
    convolver.normalize = false;
    convolver.buffer = impulse;
    const source = context.createBufferSource();
    source.buffer = burst;
    source.connect(convolver);
    convolver.connect(context.destination);
    source.start(LEAD_SECONDS + at * STEP_SECONDS);
  });
  return context.startRendering();
};

export interface IFitPlayer {
  /** Plays the buffer to the end, or until `stop`; resolves when it ends. */
  play: (buffer: AudioBuffer) => Promise<void>;
  stop: () => void;
  close: () => void;
}

/** One output context for the dialog's life, opened on the first press. */
export const createFitPlayer = (): IFitPlayer => {
  let context: AudioContext | undefined;
  let current: AudioBufferSourceNode | undefined;
  const stop = () => {
    if (current) {
      current.onended = null;
      current.stop();
      current = undefined;
    }
  };
  return {
    play: (buffer) => {
      stop();
      context = context ?? new AudioContext();
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      current = source;
      return new Promise<void>((resolve) => {
        source.onended = () => {
          if (current === source) {
            current = undefined;
          }
          resolve();
        };
        source.start();
      });
    },
    stop,
    close: () => {
      stop();
      context?.close().catch(() => undefined);
      context = undefined;
    },
  };
};
