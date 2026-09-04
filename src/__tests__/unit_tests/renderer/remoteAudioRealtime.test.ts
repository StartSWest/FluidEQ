/* FluidEQ — GPL-3.0-or-later */
/** @jest-environment node */

import fs from 'fs';
import path from 'path';
import vm from 'vm';

interface IProcessor {
  port: {
    onmessage(event: { data: unknown }): void;
    messages: { bufferedMs: number }[];
  };
  process(inputs: Float32Array[][], outputs: Float32Array[][]): void;
}

const processor = (): IProcessor => {
  let Constructor: (new () => IProcessor) | undefined;
  const scope = vm.createContext({
    ArrayBuffer,
    Float32Array,
    sampleRate: 48000,
    AudioWorkletProcessor: class {
      port = {
        onmessage: () => undefined,
        messages: [] as { bufferedMs: number }[],
        postMessage: (data: { bufferedMs: number }) =>
          this.port.messages.push(data),
      };
    },
    registerProcessor: (name: string, constructor: new () => IProcessor) => {
      if (name === 'fluideq-remote-audio') {
        Constructor = constructor;
      }
    },
  });
  vm.runInContext(
    fs.readFileSync(
      path.resolve('release/app/dist/renderer/dsp-worklet.js'),
      'utf8',
    ),
    scope,
  );
  if (!Constructor) {
    throw new Error('Remote audio worklet was not built.');
  }
  const instance = new Constructor();
  instance.port.onmessage({
    data: { kind: 'configure', peerId: 'source', mode: 'video' },
  });
  return instance;
};

const simulate = (delivery: (frame: number, sequence: number) => number) => {
  const instance = processor();
  let sequence = 0;
  const outputs = [[new Float32Array(128), new Float32Array(128)]];
  let minimumStableSample = 1;
  let minimumRunningSample = 1;
  let latestBufferMs = 0;
  for (let at = 0; at < 48000 * 4; at += 128) {
    while (delivery((sequence + 1) * 480, sequence) <= at) {
      const pcm = new Float32Array(960).fill(0.25);
      instance.port.onmessage({
        data: {
          kind: 'push',
          peerId: 'source',
          sequence,
          sampleRate: 48000,
          channels: 2,
          frames: 480,
          pcm: pcm.buffer,
        },
      });
      sequence += 1;
    }
    instance.process([], outputs);
    if (at >= 4800) {
      minimumRunningSample = Math.min(minimumRunningSample, ...outputs[0][0]);
    }
    if (at >= 48000 * 3) {
      minimumStableSample = Math.min(minimumStableSample, ...outputs[0][0]);
    }
    const meter = instance.port.messages.pop();
    if (meter) {
      latestBufferMs = meter.bufferedMs;
    }
    instance.port.messages.length = 0;
  }
  return { minimumStableSample, minimumRunningSample, latestBufferMs };
};

describe('video-mode continuous playback', () => {
  it('keeps ordinary 8 ms packet jitter at full level', () => {
    const result = simulate(
      (at, sequence) => at + (sequence % 4 === 0 ? 384 : 0),
    );
    expect(result.minimumStableSample).toBeGreaterThan(0.245);
    expect(result.minimumRunningSample).toBeGreaterThan(0.245);
    expect(result.latestBufferMs).toBeLessThan(50);
  });

  it('crossfades accumulated video backlog without stopping the playing stream', () => {
    const result = simulate((at) => (at >= 96000 ? at - 2880 : at));
    expect(result.minimumRunningSample).toBeGreaterThan(0.245);
    expect(result.latestBufferMs).toBeLessThan(50);
  });

  it('returns to a live buffer after a 90 ms stall instead of retaining its delay', () => {
    const result = simulate((at) => (at >= 96000 && at < 100320 ? 100320 : at));
    expect(result.minimumStableSample).toBeGreaterThan(0.245);
    expect(result.latestBufferMs).toBeLessThan(50);
  });

  it('accepts the main-process port without relaying audio through the UI callback', () => {
    const instance = processor();
    const port = {
      onmessage: (_event: { data: unknown }) => undefined,
      close: jest.fn(),
    };
    instance.port.onmessage({ data: { kind: 'attach', port } });
    const pcm = new Float32Array(2880).fill(0.25);
    port.onmessage({
      data: {
        kind: 'push',
        peerId: 'source',
        sequence: 0,
        sampleRate: 48000,
        channels: 2,
        frames: 1440,
        pcm: pcm.buffer,
      },
    });
    const outputs = [[new Float32Array(128), new Float32Array(128)]];
    instance.process([], outputs);
    expect(outputs[0][0][127]).toBeGreaterThan(0);
    instance.port.onmessage({ data: { kind: 'close' } });
    instance.process([], outputs);
    expect(outputs[0][0].every((sample) => sample === 0)).toBe(true);
    expect(port.close).toHaveBeenCalledTimes(1);
  });
});
