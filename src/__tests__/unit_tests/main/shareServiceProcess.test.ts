/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { EventEmitter, once } from 'events';
import { PassThrough } from 'stream';
import log from 'electron-log';
import {
  type IShareServiceChild,
  createShareServiceProcess,
} from 'main/shareAudio/shareServiceProcess';
import {
  createShareFrameReader,
  encodeShareFrame,
} from 'main/shareAudio/shareServiceWire';

jest.mock('electron-log', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn() },
}));

/**
 * `FluidEQ-Share.exe` as `host.ts` speaks to it: frames out on its standard
 * input, frames in on its standard output, its log on standard error, and
 * its end as the end of everything waiting on it.
 */

const childFixture = () => {
  const child = Object.assign(new EventEmitter(), {
    stdin: new PassThrough(),
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    pid: 4242,
    kill: jest.fn(() => true),
  });
  const written: unknown[] = [];
  child.stdin.on(
    'data',
    createShareFrameReader((message) => written.push(message)),
  );
  return { child, written };
};

const start = () => {
  const { child, written } = childFixture();
  const started: string[] = [];
  const service = createShareServiceProcess(
    'C:\\FluidEQ\\FluidEQ-Share.exe',
    (file) => {
      started.push(file);
      return child as unknown as IShareServiceChild;
    },
  );
  const messages: unknown[] = [];
  const errors: Error[] = [];
  const exits: number[] = [];
  service.on('message', (message) => messages.push(message));
  service.on('error', (error) => errors.push(error));
  service.on('exit', (code) => exits.push(code));
  return { child, written, started, service, messages, errors, exits };
};

afterEach(() => jest.clearAllMocks());

it('starts the program it was given and writes requests as frames', async () => {
  const fixture = start();
  expect(fixture.started).toEqual(['C:\\FluidEQ\\FluidEQ-Share.exe']);
  const delivered = once(fixture.child.stdin, 'data');
  fixture.service.postMessage({
    type: 'request',
    id: 1,
    method: 'status',
    args: [],
  });
  await delivered;
  expect(fixture.written).toEqual([
    { type: 'request', id: 1, method: 'status', args: [] },
  ]);
});

it('hands on each frame the service writes, split however it arrives', async () => {
  const fixture = start();
  const frame = encodeShareFrame({
    type: 'answer',
    id: 1,
    value: { scheduling: true },
  });
  const handed = new Promise<void>((resolve) => {
    fixture.service.on('message', () => resolve());
  });
  fixture.child.stdout.write(frame.subarray(0, 5));
  fixture.child.stdout.write(frame.subarray(5));
  await handed;
  expect(fixture.messages).toEqual([
    { type: 'answer', id: 1, value: { scheduling: true } },
  ]);
});

it("writes the service's log lines into the app's log", async () => {
  const fixture = start();
  const first = once(fixture.child.stderr, 'data');
  fixture.child.stderr.write(
    '{"message":"Share Audio connection closed; keeping pairing","detail":{"code":1006}}\nShare Audio service: Winsock did not ',
  );
  await first;
  expect(log.warn).not.toHaveBeenCalled();
  const second = once(fixture.child.stderr, 'data');
  fixture.child.stderr.write('start\n');
  await second;
  expect(log.info).toHaveBeenCalledWith(
    'Share Audio connection closed; keeping pairing',
    { code: 1006 },
  );
  expect(log.warn).toHaveBeenCalledWith(
    'Share Audio service:',
    'Share Audio service: Winsock did not start',
  );
});

it('ends on a stream that is not the service and kills what sent it', async () => {
  const fixture = start();
  const oversized = Buffer.alloc(4);
  oversized.writeUInt32LE(0xffff_ffff, 0);
  const failed = new Promise<void>((resolve) => {
    fixture.service.on('error', () => resolve());
  });
  fixture.child.stdout.write(oversized);
  await failed;
  expect(fixture.errors).toHaveLength(1);
  expect(fixture.child.kill).toHaveBeenCalledTimes(1);
  expect(() =>
    fixture.service.postMessage({ type: 'credit', key: 'x' }),
  ).toThrow('stopped');
});

it('says when the service exits and sends it nothing after', async () => {
  const fixture = start();
  fixture.child.emit('exit', 3);
  expect(fixture.exits).toEqual([3]);
  expect(() =>
    fixture.service.postMessage({ type: 'credit', key: 'x' }),
  ).toThrow('stopped');
  // The control: a running service is written to.
  const running = start();
  expect(() =>
    running.service.postMessage({ type: 'credit', key: 'x' }),
  ).not.toThrow();
});

it('ends the service when the host stops it', async () => {
  const fixture = start();
  await fixture.service.terminate();
  expect(fixture.child.kill).toHaveBeenCalledTimes(1);
  expect(() =>
    fixture.service.postMessage({ type: 'credit', key: 'x' }),
  ).toThrow('stopped');
});
