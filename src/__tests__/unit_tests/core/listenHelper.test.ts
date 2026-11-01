/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * `FluidEQ-Listen.exe` as the core runs it: one helper per run, its stdin the
 * whole of its life, its exit code the reason it stopped. Exit 3 is Windows
 * moving the default output, which is heard again at once; anything else is a
 * failure, which is not.
 */
import { EventEmitter } from 'events';
import type { ICoreLog } from 'core/coreLog';
import type { ISystemSoundHandlers } from 'core/systemSound/systemSound';
import {
  createListenHelperSource,
  type TListenChild,
} from 'core/platform/windows/listenHelper';

const MAGIC = 0x314e414c;

const frame = (
  kind: number,
  { samples = [] as number[], sequence = 0, rate = 48_000, channels = 2 } = {},
) => {
  const payload = Buffer.alloc(samples.length * 4);
  samples.forEach((sample, index) => payload.writeFloatLE(sample, index * 4));
  const header = Buffer.alloc(24);
  header.writeUInt32LE(MAGIC, 0);
  header.writeUInt32LE(kind, 4);
  header.writeUInt32LE(sequence, 8);
  header.writeUInt32LE(rate, 12);
  header.writeUInt16LE(channels, 16);
  header.writeUInt16LE(kind === 2 ? samples.length / channels : 0, 18);
  header.writeUInt32LE(payload.byteLength, 20);
  return Buffer.concat([header, payload]);
};

class FakeHelper extends EventEmitter {
  stdin = Object.assign(new EventEmitter(), {
    end: jest.fn(),
    destroy: jest.fn(),
  });

  stdout = new EventEmitter();

  stderr = new EventEmitter();
}

const setUp = () => {
  const helper = new FakeHelper();
  const spawnHelper = jest.fn(() => helper as unknown as TListenChild);
  const log: ICoreLog = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const handlers: ISystemSoundHandlers & {
    ready: jest.Mock;
    audio: jest.Mock;
    ended: jest.Mock;
  } = { ready: jest.fn(), audio: jest.fn(), ended: jest.fn() };
  const run = createListenHelperSource(
    'C:\\FluidEQ\\FluidEQ-Listen.exe',
    log,
    spawnHelper,
  ).start(handlers);
  return { helper, spawnHelper, log, handlers, run };
};

describe('the listening helper', () => {
  it('starts the helper it was given', () => {
    const { spawnHelper } = setUp();
    expect(spawnHelper).toHaveBeenCalledWith('C:\\FluidEQ\\FluidEQ-Listen.exe');
  });

  it('hands on its blocks, split across reads, as their own buffers', () => {
    const { helper, handlers } = setUp();
    const audio = frame(2, { samples: [0.25, -0.5, 0.75, -1], sequence: 9 });
    helper.stdout.emit(
      'data',
      Buffer.concat([frame(1), audio.subarray(0, 30)]),
    );
    helper.stdout.emit('data', audio.subarray(30));

    expect(handlers.ready).toHaveBeenCalledTimes(1);
    expect(handlers.audio).toHaveBeenCalledTimes(1);
    const [block] = handlers.audio.mock.calls[0];
    expect(block).toMatchObject({
      sampleRate: 48_000,
      channels: 2,
      frames: 2,
      sequence: 9,
    });
    // Exactly the block's bytes: a window takes the whole of whatever buffer
    // it is handed, and a slice of the read buffer would carry its neighbours.
    expect(block.pcm.byteLength).toBe(16);
    expect(Array.from(new Float32Array(block.pcm))).toEqual([
      0.25, -0.5, 0.75, -1,
    ]);
  });

  it('hears the new output when the helper says the output moved', () => {
    const { helper, handlers, log } = setUp();
    helper.emit('exit', 3);

    expect(handlers.ended).toHaveBeenCalledWith('output-changed');
    expect(log.warn).not.toHaveBeenCalled();
  });

  it('calls any other exit a failure, with the helper’s own reason', () => {
    const { helper, handlers, log } = setUp();
    helper.stderr.emit('data', Buffer.from('No default output.\n'));
    helper.emit('exit', 1);

    expect(handlers.ended).toHaveBeenCalledWith('failed');
    expect(log.warn).toHaveBeenCalledWith(
      'The listening helper stopped: No default output.',
    );
  });

  it('fails on a frame it does not understand, once', () => {
    const { helper, handlers } = setUp();
    helper.stdout.emit('data', Buffer.alloc(24, 0xff));
    helper.emit('exit', 1);

    expect(handlers.ended).toHaveBeenCalledTimes(1);
    expect(handlers.ended).toHaveBeenCalledWith('failed');
  });

  it('fails when the helper cannot be started at all', () => {
    const { helper, handlers } = setUp();
    helper.emit('error', new Error('spawn ENOENT'));

    expect(handlers.ended).toHaveBeenCalledWith('failed');
  });

  it('stops the helper by closing its stdin, and reports no end of its own', () => {
    const { helper, handlers, run } = setUp();
    run.stop();
    run.stop();
    helper.emit('exit', 0);

    expect(helper.stdin.end).toHaveBeenCalledTimes(1);
    expect(handlers.ended).not.toHaveBeenCalled();
  });

  it('survives a broken stdin', () => {
    const { helper } = setUp();
    expect(() => helper.stdin.emit('error', new Error('EPIPE'))).not.toThrow();
  });
});
