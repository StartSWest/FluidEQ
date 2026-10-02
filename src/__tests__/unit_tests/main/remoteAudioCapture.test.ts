/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

/**
 * The two captures and who shares them.
 *
 * The network's capture (`lan`) leaves the LAN audio helper's whole tree out,
 * so nothing another computer sends here goes back out in it; the second
 * output's (`local`) leaves only itself out and hears that sound, as it
 * should. So they are never the same process, whoever asks first — and each
 * is one process however many ask, ended by the last to let go. The frames and
 * the pipe each process speaks are `nativeCaptureProcess.test.ts`.
 */

import type { ILanRemoteAudioChunk } from 'common/remoteAudio';

const mockStart = jest.fn();
jest.mock('../../../main/nativeCaptureProcess', () => ({
  startNativeCaptureProcess: (...args: unknown[]) => mockStart(...args),
}));

type TCaptureModule = typeof import('main/remoteAudioCapture');

interface IFakeCapture {
  mode: 'local' | 'lan';
  audio(chunk: ILanRemoteAudioChunk): void;
  fail(): void;
  reply(kind: number, id: number, result: number): void;
  process: { close: jest.Mock; command: jest.Mock };
  ready(): void;
}

let capture: TCaptureModule;
let fakes: IFakeCapture[];

const chunk = (sequence: number): ILanRemoteAudioChunk => ({
  channels: 2,
  frames: 1,
  pcm: new Float32Array([0.25, -0.5]).buffer,
  peerId: '',
  sampleRate: 48_000,
  sequence,
});

const only = (mode: 'local' | 'lan') => {
  const found = fakes.filter((fake) => fake.mode === mode);
  expect(found).toHaveLength(1);
  return found[0];
};

/** Answers the newest command the local capture was given, as the helper
 * would; returns the command. */
const answer = (result = 0) => {
  const local = only('local');
  const { calls } = local.process.command.mock;
  const command = calls[calls.length - 1][0] as string;
  local.reply(3, Number(command.split(' ')[1]), result);
  return command;
};

/** Lets a chain of awaits inside the module run on. */
const settle = async () => {
  for (let step = 0; step < 20; step += 1) {
    // eslint-disable-next-line no-await-in-loop -- one microtask per step, on purpose
    await Promise.resolve();
  }
};

beforeEach(() => {
  jest.resetModules();
  fakes = [];
  mockStart.mockReset().mockImplementation(
    (
      mode: 'local' | 'lan',
      onAudio: IFakeCapture['audio'],
      onFailure: IFakeCapture['fail'],
      onReply: IFakeCapture['reply'],
    ) =>
      new Promise((resolve) => {
        const process = { close: jest.fn(), command: jest.fn() };
        fakes.push({
          mode,
          audio: onAudio,
          fail: onFailure,
          reply: onReply,
          process,
          ready: () => resolve(process),
        });
      }),
  );
  // eslint-disable-next-line global-require -- the module holds its sessions; each case needs a fresh copy after resetModules
  capture = require('main/remoteAudioCapture');
});

describe("the network's capture", () => {
  it('is one process for every computer it goes to, ended by the last', async () => {
    const firstAudio = jest.fn();
    const secondAudio = jest.fn();
    const first = capture.startNetworkCapture(firstAudio, jest.fn());
    const second = capture.startNetworkCapture(secondAudio, jest.fn());
    only('lan').ready();
    const [a, b] = await Promise.all([first, second]);
    expect(mockStart).toHaveBeenCalledTimes(1);

    only('lan').audio(chunk(1));
    expect(firstAudio).toHaveBeenCalledTimes(1);
    expect(secondAudio).toHaveBeenCalledTimes(1);
    a.close();
    expect(only('lan').process.close).not.toHaveBeenCalled();
    only('lan').audio(chunk(2));
    expect(firstAudio).toHaveBeenCalledTimes(1);
    expect(secondAudio).toHaveBeenCalledTimes(2);
    b.close();
    expect(only('lan').process.close).toHaveBeenCalledTimes(1);
  });

  it('is never the capture Smart EQ and the second output hear', async () => {
    const network = jest.fn();
    const source = jest.fn();
    const sharing = capture.startNetworkCapture(network, jest.fn());
    const measuring = capture.startRawSourceCapture(source, jest.fn());
    fakes.forEach((fake) => fake.ready());
    await Promise.all([sharing, measuring]);
    expect(fakes.map((fake) => fake.mode).sort()).toEqual(['lan', 'local']);

    // What the local capture hears includes the other computers' sound; none
    // of it reaches what goes out.
    only('local').audio(chunk(1));
    expect(source).toHaveBeenCalledTimes(1);
    expect(network).not.toHaveBeenCalled();
  });

  it('tells everyone it served when it fails, and starts afresh after', async () => {
    const failed = jest.fn();
    const starting = capture.startNetworkCapture(jest.fn(), failed);
    only('lan').ready();
    await starting;
    only('lan').fail();
    expect(failed).toHaveBeenCalledTimes(1);

    const again = capture.startNetworkCapture(jest.fn(), jest.fn());
    expect(mockStart).toHaveBeenCalledTimes(2);
    fakes[1].ready();
    await expect(again).resolves.toBeDefined();
  });

  it('passes on a capture that could not start', async () => {
    mockStart.mockImplementationOnce(() =>
      Promise.reject(new Error('activation failed')),
    );
    await expect(
      capture.startNetworkCapture(jest.fn(), jest.fn()),
    ).rejects.toThrow('activation failed');
  });
});

describe('the second output', () => {
  const GUID = '{12345678-1234-1234-1234-123456789abc}';

  it('starts, turns and stops a mirror on the local capture, not the network’s', async () => {
    const network = capture.startNetworkCapture(jest.fn(), jest.fn());
    only('lan').ready();
    const lan = await network;

    const starting = capture.startNativeOutputMirror(
      GUID,
      0.7,
      jest.fn(),
      jest.fn(),
    );
    only('local').ready();
    await settle();
    // No mode: the helper keeps the output in time by itself.
    expect(answer()).toMatch(/^start \d+ \d+ \{[0-9a-f-]+\} 0\.7$/);
    const mirror = await starting;

    const turning = mirror.setVolume(0.4);
    await settle();
    expect(answer()).toMatch(/^volume \d+ \d+ 0\.4$/);
    await turning;

    const stopping = mirror.close();
    expect(mirror.close()).toBe(stopping);
    await settle();
    expect(answer()).toMatch(/^stop /);
    await stopping;
    expect(only('local').process.close).toHaveBeenCalledTimes(1);
    expect(only('lan').process.command).not.toHaveBeenCalled();
    expect(only('lan').process.close).not.toHaveBeenCalled();
    lan.close();
  });

  it('refuses a mirror Windows would not open, and frees the capture', async () => {
    const starting = capture.startNativeOutputMirror(
      GUID,
      1,
      jest.fn(),
      jest.fn(),
    );
    only('local').ready();
    await settle();
    answer(0x8889_0004);
    await expect(starting).rejects.toThrow('0x88890004');
    expect(only('local').process.close).toHaveBeenCalledTimes(1);
  });

  it('tells a mirror whose device went away', async () => {
    const lost = jest.fn();
    const starting = capture.startNativeOutputMirror(GUID, 1, lost, jest.fn());
    only('local').ready();
    await settle();
    const command = answer();
    await starting;
    only('local').reply(4, Number(command.split(' ')[2]), 0);
    expect(lost).toHaveBeenCalledTimes(1);
  });

  it('passes on how far behind each mirror plays, in milliseconds', async () => {
    const heard = jest.fn();
    const other = jest.fn();
    const first = capture.startNativeOutputMirror(GUID, 1, jest.fn(), heard);
    only('local').ready();
    await settle();
    const firstId = Number(answer().split(' ')[2]);
    await first;
    const second = capture.startNativeOutputMirror(GUID, 1, jest.fn(), other);
    await settle();
    answer();
    await second;
    // The helper reports microseconds in the result field (`mirror_control.h`).
    only('local').reply(5, firstId, 41_600);
    expect(heard).toHaveBeenCalledWith(41.6);
    expect(other).not.toHaveBeenCalled();
  });
});
