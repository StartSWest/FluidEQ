/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const PROCESSOR_NAME = 'fluideq-remote-audio-capture';
const CAPTURE_FRAMES = 1_024;
const CAPTURE_CHANNELS = 2;

/**
 * Gather exact loopback samples on the audio render thread.
 *
 * The old ScriptProcessor callback ran on the renderer thread, so a busy UI
 * could delay capture long enough for Chromium to drop a block. A worklet is
 * driven by the audio device itself and hands complete 1,024-frame blocks to
 * the network without a clock or timer of its own.
 */
class RemoteAudioCaptureProcessor extends AudioWorkletProcessor {
  private channels = 0;

  private filledFrames = 0;

  private samples = new Float32Array(0);

  private sequence = 0;

  private reset(channels: number) {
    this.channels = channels;
    this.filledFrames = 0;
    this.samples = new Float32Array(CAPTURE_FRAMES * channels);
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    outputs[0]?.forEach((channel) => channel.fill(0));
    const input = inputs[0];
    const channels = Math.min(input?.length ?? 0, CAPTURE_CHANNELS);
    const frames = input?.[0]?.length ?? 0;
    if (!input || channels === 0 || frames === 0) {
      return true;
    }
    if (channels !== this.channels) {
      this.reset(channels);
    }

    for (let frame = 0; frame < frames; frame += 1) {
      for (let channel = 0; channel < channels; channel += 1) {
        this.samples[this.filledFrames * channels + channel] =
          input[channel][frame] ?? 0;
      }
      this.filledFrames += 1;
      if (this.filledFrames === CAPTURE_FRAMES) {
        const completed = this.samples;
        this.port.postMessage(
          {
            channels,
            frames: CAPTURE_FRAMES,
            pcm: completed.buffer,
            sampleRate,
            sequence: this.sequence,
          },
          [completed.buffer],
        );
        this.sequence = this.sequence === 0xffff_ffff ? 0 : this.sequence + 1;
        this.reset(channels);
      }
    }
    return true;
  }
}

registerProcessor(PROCESSOR_NAME, RemoteAudioCaptureProcessor);

export {};
