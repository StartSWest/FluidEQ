/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Short-term loudness of what is playing, for the recorder's readout: the
 * last three seconds, K-weighted and summed over both channels as BS.1770
 * measures it, read every hundred milliseconds of audio as a meter does.
 *
 * The filters and the calibration are the Library's own
 * (`loudnessAnalysis.ts`), so the strip and a track's analysis agree on what
 * a LUFS is. Fed the samples the recorder draws and nothing else: no second
 * read of any analyser.
 *
 * Audio the capture never showed — a slow frame longer than the analyser's
 * window — counts as silence in its sub-block. It is a few milliseconds in
 * three seconds, and reading it as anything louder would be inventing it.
 */
import { IBiquadState, createBiquadState } from './dsp/biquad';
import {
  ABSOLUTE_GATE_LUFS,
  kWeighting,
  loudnessFromEnergy,
  processOne,
} from './dsp/loudnessAnalysis';

/** A meter's update rate, and the short-term window in those steps. */
const STEP_SECONDS = 0.1;
const STEPS_PER_WINDOW = 30;
/** How much of the window must be heard before a figure means anything. */
const STEPS_BEFORE_A_READING = 4;

export interface IShortTermLoudness {
  /**
   * `from`..`to` of each channel (the first two), at `sampleRate`, after
   * `unseen` samples nobody saw. Answers whether a step completed, which is
   * when `read` may have changed.
   */
  feed(
    channels: readonly Float32Array[],
    from: number,
    to: number,
    unseen: number,
    sampleRate: number,
  ): boolean;
  /** LUFS over the last three seconds; undefined below the absolute gate. */
  read(): number | undefined;
  reset(): void;
}

export const createShortTermLoudness = (): IShortTermLoudness => {
  let rate = 0;
  let filters = kWeighting(48_000);
  let states: [IBiquadState, IBiquadState][] = [];
  let stepFrames = 1;
  const steps = new Float64Array(STEPS_PER_WINDOW);
  let stepCount = 0;
  let stepAt = 0;
  let energy = 0;
  let framesInStep = 0;

  const reset = () => {
    states = [0, 1].map(() => [createBiquadState(), createBiquadState()]) as [
      IBiquadState,
      IBiquadState,
    ][];
    steps.fill(0);
    stepCount = 0;
    stepAt = 0;
    energy = 0;
    framesInStep = 0;
  };
  reset();

  /** Closes the step when it is full; answers whether it did. */
  const closeStep = () => {
    if (framesInStep < stepFrames) {
      return false;
    }
    steps[stepAt] = energy / stepFrames;
    stepAt = (stepAt + 1) % STEPS_PER_WINDOW;
    stepCount = Math.min(STEPS_PER_WINDOW, stepCount + 1);
    energy = 0;
    framesInStep = 0;
    return true;
  };

  return {
    feed: (channels, from, to, unseen, sampleRate) => {
      if (sampleRate !== rate) {
        rate = sampleRate;
        filters = kWeighting(sampleRate);
        stepFrames = Math.max(1, Math.round(sampleRate * STEP_SECONDS));
        reset();
      }
      let stepped = false;
      // Unseen audio fills its steps with nothing, a step at a time rather
      // than a sample at a time, and leaves the filters' memory behind it:
      // what comes next is not continuous with what they last heard.
      let silent = unseen;
      while (silent > 0) {
        const take = Math.min(silent, stepFrames - framesInStep);
        framesInStep += take;
        silent -= take;
        stepped = closeStep() || stepped;
      }
      if (unseen > 0) {
        states.forEach((pair) => {
          pair[0] = createBiquadState();
          pair[1] = createBiquadState();
        });
      }
      const count = Math.min(2, channels.length);
      for (let frame = from; frame < to; frame += 1) {
        for (let channel = 0; channel < count; channel += 1) {
          const [shelf, highpass] = states[channel];
          const weighted = processOne(
            highpass,
            processOne(shelf, channels[channel][frame], filters.shelf),
            filters.highpass,
          );
          energy += weighted * weighted;
        }
        framesInStep += 1;
        stepped = closeStep() || stepped;
      }
      return stepped;
    },
    read: () => {
      if (stepCount < STEPS_BEFORE_A_READING) {
        return undefined;
      }
      let total = 0;
      for (let index = 0; index < stepCount; index += 1) {
        total += steps[index];
      }
      const lufs = loudnessFromEnergy(total / stepCount);
      return lufs > ABSOLUTE_GATE_LUFS ? lufs : undefined;
    },
    reset,
  };
};
