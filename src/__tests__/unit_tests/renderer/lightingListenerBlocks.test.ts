/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The lamps hear the capture from the blocks the audio thread hands over.
 * On time, a picture every thirtieth of a second of sound; behind — the page
 * held back while blocks queued — no pictures of moments already past, and
 * the one made at the newest block stands for all the time since the last;
 * and a distance to the audio that holds still is not taken for a backlog.
 */

import type { ICaptureGraph } from 'renderer/graph/useLiveOutputSpectrum';
import {
  startLightingListener,
  type IHeardFrame,
} from 'renderer/lighting/lightingListener';

const RATE = 48_000;

const setup = async () => {
  const node = () => ({ connect: jest.fn(), disconnect: jest.fn() });
  const analyser = {
    ...node(),
    frequencyBinCount: 1024,
    getFloatFrequencyData: (out: Float32Array) => out.fill(-30),
    getFloatTimeDomainData: (out: Float32Array) => out.fill(0),
  };
  let blockFrames = 0;
  const tap = {
    ...node(),
    port: {
      postMessage: jest.fn(
        (message: { kind: string; blockFrames?: number }) => {
          if (message.kind === 'attach') {
            blockFrames = message.blockFrames ?? 0;
          }
        },
      ),
    },
  };
  const blocks = {
    port1: {},
    port2: {
      onmessage: null as null | ((event: { data: unknown }) => void),
      close: jest.fn(),
    },
  };
  const context = {
    state: 'running',
    sampleRate: RATE,
    currentTime: 0,
    destination: {},
    audioWorklet: { addModule: jest.fn(async () => undefined) },
    createAnalyser: () => analyser,
    createGain: () => ({ ...node(), gain: { value: 1 } }),
  };
  Object.defineProperty(window, 'AudioWorkletNode', {
    configurable: true,
    value: jest.fn(() => tap),
  });
  Object.defineProperty(window, 'MessageChannel', {
    configurable: true,
    value: jest.fn(() => blocks),
  });
  const heard: IHeardFrame[] = [];
  const listener = await startLightingListener(
    { context, source: node() } as unknown as ICaptureGraph,
    [1, 1, 1],
    () => false,
    (frame) => heard.push(frame),
  );
  let delivered = 0;
  /** One block handed over, the audio clock `ahead` frames past it. */
  const deliver = (ahead: number) => {
    delivered += blockFrames;
    context.currentTime = (delivered + ahead) / RATE;
    blocks.port2.onmessage?.({
      data: {
        channels: 2,
        frames: blockFrames,
        pcm: new Float32Array(blockFrames * 2).buffer,
      },
    });
  };
  const blocksIn = (seconds: number) =>
    Math.round((seconds * RATE) / blockFrames);
  return { heard, deliver, blocksIn, listener, blockFrames: () => blockFrames };
};

afterEach(() => {
  Reflect.deleteProperty(window, 'AudioWorkletNode');
  Reflect.deleteProperty(window, 'MessageChannel');
});

it('makes a picture every thirtieth of a second of sound while on time', async () => {
  const { heard, deliver, blocksIn, listener } = await setup();
  for (let block = 0; block < blocksIn(2); block += 1) {
    deliver(64);
  }
  expect(heard.length).toBeGreaterThanOrEqual(59);
  expect(heard.length).toBeLessThanOrEqual(60);
  const total = heard.reduce((sum, { frame }) => sum + frame.deltaMs, 0);
  expect(total).toBeGreaterThan(1_950);
  expect(total).toBeLessThanOrEqual(2_000);
  listener.close();
});

it('makes one picture at the newest block after a stall, standing for all the time since', async () => {
  const { heard, deliver, blocksIn, listener } = await setup();
  for (let block = 0; block < blocksIn(1); block += 1) {
    deliver(64);
  }
  const before = heard.length;
  // Five seconds of blocks waiting behind a held page, handed over at once:
  // the audio clock is already past all of them.
  const backlog = blocksIn(5);
  for (let block = 0; block < backlog; block += 1) {
    deliver(64 + (backlog - 1 - block) * 480);
  }
  const during = heard.slice(before);
  expect(during.length).toBeLessThanOrEqual(2);
  const last = during[during.length - 1];
  expect(last.frame.deltaMs).toBeGreaterThan(4_900);
  listener.close();
});

it('takes a distance to the audio that holds still for where the handover is now', async () => {
  const { heard, deliver, blocksIn, blockFrames, listener } = await setup();
  for (let block = 0; block < blocksIn(1); block += 1) {
    deliver(64);
  }
  const before = heard.length;
  // The tap counted nothing for a while (its source silent to it): every
  // block from now on is as far behind the clock as the gap was, for good.
  for (let block = 0; block < blocksIn(3); block += 1) {
    deliver(64 + 10 * blockFrames());
  }
  // A second of sound put off, then the pictures come back at the rate.
  const after = heard.slice(before);
  expect(after.length).toBeGreaterThan(55);
  expect(after.length).toBeLessThan(65);
  listener.close();
});
