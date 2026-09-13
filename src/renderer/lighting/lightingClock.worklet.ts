/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The beat the desk lights are drawn to: a message every thirtieth of a
 * second of audio.
 *
 * Not an animation frame and not a timer. Animation frames stop the moment the
 * window is minimised — and a desk that goes dark whenever FluidEQ is behind a
 * game is the feature not working — while a timer guesses at a machine's speed
 * and gets throttled in the background. The audio thread renders whether or
 * not anyone is looking, so counting the samples it renders is a clock that
 * runs exactly as long as there is audio to follow, and at its pace.
 *
 * Built into the one worklet bundle (`dspProcessor.worklet.ts` imports it), so
 * the capture context loads the file every other processor already lives in.
 */

import {
  LIGHTING_CLOCK_PROCESSOR,
  LIGHTING_TICKS_PER_SECOND,
} from './lightingSceneMessages';

class LightingClock extends AudioWorkletProcessor {
  private elapsed = 0;

  private readonly interval = Math.round(
    sampleRate / LIGHTING_TICKS_PER_SECOND,
  );

  process(inputs: Float32Array[][]): boolean {
    // The render quantum's length, from the input the capture feeds in. A
    // quantum with nothing connected still counts, at the spec's 128.
    const quantum = inputs[0]?.[0]?.length || 128;
    this.elapsed += quantum;
    if (this.elapsed >= this.interval) {
      this.elapsed -= this.interval;
      this.port.postMessage((this.interval * 1000) / sampleRate);
    }
    return true;
  }
}

registerProcessor(LIGHTING_CLOCK_PROCESSOR, LightingClock);
