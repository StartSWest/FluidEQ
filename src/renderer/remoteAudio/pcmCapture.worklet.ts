/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const PROCESSOR_NAME = 'fluideq-remote-audio-capture';
const DEFAULT_BLOCK_FRAMES = 1_024;
const MIN_BLOCK_FRAMES = 128;
const MAX_BLOCK_FRAMES = 8_192;
const CAPTURE_CHANNELS = 2;

interface IAttachMessage {
  kind: 'attach';
  port: MessagePort;
  /** Frames per delivered block. Defaults to the network's 1,024. */
  blockFrames?: number;
  /**
   * Stamped on every block. The network sender names its peer after the
   * fact; a block going straight into a playback worklet has nobody in
   * between to do that, and the playback side files samples by this name.
   */
  peerId?: string;
}

const isCloseMessage = (value: unknown): boolean =>
  typeof value === 'object' &&
  value !== null &&
  (value as { kind?: unknown }).kind === 'close';

const isAttachMessage = (value: unknown): value is IAttachMessage => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const message = value as Partial<IAttachMessage>;
  return (
    message.kind === 'attach' &&
    typeof message.port === 'object' &&
    message.port !== null &&
    (message.blockFrames === undefined ||
      (Number.isInteger(message.blockFrames) &&
        message.blockFrames >= MIN_BLOCK_FRAMES &&
        message.blockFrames <= MAX_BLOCK_FRAMES)) &&
    (message.peerId === undefined || typeof message.peerId === 'string')
  );
};

/**
 * Gather exact loopback samples on the audio render thread.
 *
 * The old ScriptProcessor callback ran on the renderer thread, so a busy UI
 * could delay capture long enough for Chromium to drop a block. A worklet is
 * driven by the audio device itself and hands complete blocks to the network
 * without a clock or timer of its own.
 *
 * Blocks go to the node's own port unless a port is attached. The second
 * output attaches one end of a channel whose other end sits inside the
 * playback worklet of another context, so its samples travel audio thread to
 * audio thread and never queue behind whatever the renderer's main thread is
 * doing — a graph repaint there is exactly the kind of stall that would
 * otherwise become a hole in the far speaker. The block size is set on attach
 * because the network wants big packets and a local mirror wants delay
 * measured in a few milliseconds: at 48 kHz, 1,024 frames is 21 ms held back
 * before the first sample can leave, 256 is 5.
 */
class RemoteAudioCaptureProcessor extends AudioWorkletProcessor {
  private channels = 0;

  private filledFrames = 0;

  private samples = new Float32Array(0);

  private sequence = 0;

  private blockFrames = DEFAULT_BLOCK_FRAMES;

  private target: MessagePort = this.port;

  private peerId?: string;

  private closed = false;

  constructor() {
    super();
    this.port.onmessage = (event: MessageEvent<unknown>) => {
      if (isCloseMessage(event.data)) {
        // A processor that keeps answering `true` is kept alive by the
        // context whether or not anything still holds its node, so a tap
        // that was merely disconnected would sit in the graph for as long as
        // the capture ran. Returning `false` once is what lets it go.
        this.closed = true;
        if (this.target !== this.port) {
          this.target.close();
        }
        return;
      }
      if (!isAttachMessage(event.data)) {
        return;
      }
      if (this.target !== this.port) {
        this.target.close();
      }
      this.target = event.data.port;
      this.blockFrames = event.data.blockFrames ?? DEFAULT_BLOCK_FRAMES;
      this.peerId = event.data.peerId;
      // A block sized for the old destination must not be delivered to the
      // new one, so the partial block is dropped and counting starts again.
      this.reset(this.channels);
    };
  }

  private reset(channels: number) {
    this.channels = channels;
    this.filledFrames = 0;
    this.samples = new Float32Array(this.blockFrames * channels);
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    outputs[0]?.forEach((channel) => channel.fill(0));
    if (this.closed) {
      return false;
    }
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
      if (this.filledFrames === this.blockFrames) {
        const completed = this.samples;
        this.target.postMessage(
          {
            channels,
            frames: this.blockFrames,
            pcm: completed.buffer,
            // Named blocks are already in the playback worklet's own
            // vocabulary; unnamed ones are wrapped by whoever forwards them.
            ...(this.peerId === undefined
              ? {}
              : { kind: 'push', peerId: this.peerId }),
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
