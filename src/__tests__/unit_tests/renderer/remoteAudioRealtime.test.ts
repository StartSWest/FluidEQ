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

const simulate = (
  delivery: (frame: number, sequence: number) => number,
  durationSeconds = 4,
  toneHz = 0,
) => {
  const instance = processor();
  let sequence = 0;
  const outputs = [[new Float32Array(128), new Float32Array(128)]];
  let minimumStableSample = 1;
  let minimumRunningSample = 1;
  let minimumStableRms = 1;
  let latestBufferMs = 0;
  for (let at = 0; at < 48000 * durationSeconds; at += 128) {
    while (delivery((sequence + 1) * 480, sequence) <= at) {
      const pcm = new Float32Array(960).fill(0.25);
      if (toneHz) {
        for (let frame = 0; frame < 480; frame += 1) {
          const value =
            0.25 *
            Math.sin((2 * Math.PI * toneHz * (sequence * 480 + frame)) / 48000);
          pcm[frame * 2] = value;
          pcm[frame * 2 + 1] = -value;
        }
      }
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
    // Allow the advertised 100 ms startup reservoir and its 12 ms fade-in.
    if (at >= 7200) {
      minimumRunningSample = Math.min(minimumRunningSample, ...outputs[0][0]);
    }
    if (at >= 48000 * 3) {
      minimumStableSample = Math.min(minimumStableSample, ...outputs[0][0]);
      const squareSum = outputs[0][0].reduce(
        (sum, value) => sum + value * value,
        0,
      );
      minimumStableRms = Math.min(minimumStableRms, Math.sqrt(squareSum / 128));
    }
    const meter = instance.port.messages.pop();
    if (meter) {
      latestBufferMs = meter.bufferedMs;
    }
    instance.port.messages.length = 0;
  }
  return {
    minimumStableSample,
    minimumRunningSample,
    minimumStableRms,
    latestBufferMs,
  };
};

describe('video-mode continuous playback', () => {
  it('restores each startup buffer when switching Music to Game/Video and back', () => {
    const instance = processor();
    const outputs = [[new Float32Array(128), new Float32Array(128)]];
    const modes = [
      { mode: 'music', frames: 11_520 },
      { mode: 'video', frames: 4_800 },
      { mode: 'music', frames: 11_520 },
    ];
    modes.forEach(({ mode, frames }) => {
      // Mode changes re-handshake the sender and reset the playback port.
      // Exercise that same worklet instance so old profile state cannot leak.
      instance.port.onmessage({ data: { kind: 'reset' } });
      instance.port.onmessage({
        data: { kind: 'configure', peerId: 'source', mode },
      });
      let sequence = 0;
      const pushFrames = (count: number) => {
        for (let offset = 0; offset < count; offset += 480) {
          const packetFrames = Math.min(480, count - offset);
          instance.port.onmessage({
            data: {
              kind: 'push',
              peerId: 'source',
              sequence,
              sampleRate: 48_000,
              channels: 2,
              frames: packetFrames,
              pcm: new Float32Array(packetFrames * 2).fill(0.25).buffer,
            },
          });
          sequence += 1;
        }
      };
      pushFrames(frames - 1);
      instance.process([], outputs);
      expect(outputs[0][0].every((sample) => sample === 0)).toBe(true);
      pushFrames(1);
      instance.process([], outputs);
      expect(outputs[0][0][127]).toBeGreaterThan(0);
    });
  });

  it.each([40, 60, 80, 160])(
    'retains the protection needed by recurring %i ms delivery bursts',
    (batchMs) => {
      const batchFrames = 48 * batchMs;
      const result = simulate(
        (at) => Math.ceil(at / batchFrames) * batchFrames,
        12,
      );
      // Cross several recovery windows: the old unconditional decay played
      // cleanly for two seconds, then deliberately shrank into another dropout.
      expect(result.minimumStableSample).toBeGreaterThan(0.245);
      expect(result.latestBufferMs).toBeLessThan(Math.max(100, batchMs) + 30);
    },
  );

  it('keeps an audible stereo tone continuous through recurring bursts', () => {
    const result = simulate((at) => Math.ceil(at / 2880) * 2880, 8, 997);
    expect(result.minimumStableRms).toBeGreaterThan(0.16);
    expect(result.latestBufferMs).toBeLessThan(110);
  });

  it('keeps ordinary 8 ms packet jitter at full level', () => {
    const result = simulate(
      (at, sequence) => at + (sequence % 4 === 0 ? 384 : 0),
    );
    expect(result.minimumStableSample).toBeGreaterThan(0.245);
    expect(result.minimumRunningSample).toBeGreaterThan(0.245);
    expect(result.latestBufferMs).toBeLessThan(110);
  });

  it('absorbs 20 ms delivery jitter with the Game/Video reservoir', () => {
    const result = simulate(
      (at, sequence) => at + (sequence % 4 === 0 ? 960 : 0),
    );
    expect(result.minimumRunningSample).toBeGreaterThan(0.245);
    expect(result.latestBufferMs).toBeLessThan(110);
  });

  it('crossfades accumulated video backlog without stopping the playing stream', () => {
    const result = simulate((at) => (at >= 96000 ? at - 2880 : at));
    expect(result.minimumRunningSample).toBeGreaterThan(0.245);
    expect(result.latestBufferMs).toBeLessThan(110);
  });

  it('returns to a live buffer after a 90 ms stall instead of retaining its delay', () => {
    const result = simulate((at) => (at >= 96000 && at < 100320 ? 100320 : at));
    expect(result.minimumStableSample).toBeGreaterThan(0.245);
    expect(result.latestBufferMs).toBeLessThan(110);
  });

  it('accepts the main-process port without relaying audio through the UI callback', () => {
    const instance = processor();
    const port = {
      onmessage: (_event: { data: unknown }) => undefined,
      close: jest.fn(),
    };
    instance.port.onmessage({ data: { kind: 'attach', port } });
    const pcm = new Float32Array(9600).fill(0.25);
    port.onmessage({
      data: {
        kind: 'push',
        peerId: 'source',
        sequence: 0,
        sampleRate: 48000,
        channels: 2,
        frames: 4800,
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
