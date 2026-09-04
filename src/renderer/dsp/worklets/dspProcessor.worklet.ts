/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { DSP_OUTPUT_INDEX } from '../monitorOutputs';
import '../../remoteAudio/pcmCapture.worklet';
import '../../remoteAudio/pcmReceiver.worklet';

/**
 * A wire, and deliberately nothing else.
 *
 * This node used to hold the whole rack — normalizer, exciter, EQ, compressor,
 * maximizer, master, output safety — about nineteen hundred lines of it. All of
 * that now lives in C++, in `native/dsp-core`, and this stopped running long
 * before it was removed: `useDspEngine` stands the worklet down unconditionally
 * on every engine start, so every stage sat behind a branch that was never
 * taken. What is deleted here is code that had already stopped executing; the
 * sound does not change, which is the only reason it could go in one step.
 *
 * IT STILL HAS TO EXIST. `createMediaElementSource` cannot be undone: from the
 * moment the element is captured the graph is the only route to the speakers,
 * so removing the node would take the audio with it rather than leaving it
 * unprocessed. That is the whole of this file's job.
 *
 * There is one output. The six silent monitor outputs and their AnalyserNodes
 * went with the rack: native analysis owns those meters while the DSP panel is
 * visible, so keeping FFT buffers here for an off-screen panel was pure cost.
 */
class DspProcessor extends AudioWorkletProcessor {
  /* eslint-disable-next-line class-methods-use-this --
     `process` is called by the audio thread on the instance and cannot be
     static, and a wire holds no state, so there is nothing for it to reach
     `this` for. The rule is right about ordinary classes and wrong about this
     one interface. */
  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const input = inputs[0];
    const output = outputs[DSP_OUTPUT_INDEX.master];
    if (!output || output.length === 0) {
      return true;
    }

    for (let channel = 0; channel < output.length; channel += 1) {
      const target = output[channel];
      const source = input?.[Math.min(channel, (input?.length ?? 1) - 1)];
      if (!source || source.length === 0) {
        // A disconnected or silent input arrives as an empty array, not as a
        // block of zeros. Leaving `target` alone would replay whatever the
        // previous block left in it, which is a stutter rather than silence.
        target.fill(0);
      } else {
        target.set(source);
      }
    }

    return true;
  }
}

registerProcessor('fluideq-dsp', DspProcessor);
