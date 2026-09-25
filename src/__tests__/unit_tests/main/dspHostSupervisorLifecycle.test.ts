/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The DSP host's start, requests and stop are decided by the process, never by
 * a clock.
 *
 * There used to be three deadlines here — five seconds for the handshake, five
 * for every acknowledgement, two for a shutdown before a kill. Each test holds
 * that no timer is started, that the wait does not end by itself (the null),
 * and that the event which now ends it does (the positive control).
 */

import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import {
  ACK_BYTES,
  COMMAND_BYTES,
  HANDSHAKE_BYTES,
  HOST_COMMANDS,
  HOST_STATUS,
  HOST_WIRE_PROTOCOL_VERSION,
  MAGIC_ACK,
  MAGIC_HANDSHAKE,
} from '../../../main/dspHost/wire';
import { ANALYSIS_HEADER_BYTES } from '../../../common/dsp/analysisWire';

interface IFakeHost extends EventEmitter {
  stdin: PassThrough;
  stdout: PassThrough;
  stderr: PassThrough;
  pid: number;
  kill: jest.Mock;
}

const hosts: IFakeHost[] = [];

jest.mock('child_process', () => ({
  spawn: jest.fn(() => {
    // eslint-disable-next-line global-require, @typescript-eslint/no-require-imports -- inside a hoisted factory
    const stream = require('stream') as typeof import('stream');
    // eslint-disable-next-line global-require, @typescript-eslint/no-require-imports -- inside a hoisted factory
    const events = require('events') as typeof import('events');
    const host = Object.assign(new events.EventEmitter(), {
      stdin: new stream.PassThrough(),
      stdout: new stream.PassThrough(),
      stderr: new stream.PassThrough(),
      pid: 4242,
      kill: jest.fn(),
    });
    hosts.push(host as unknown as IFakeHost);
    return host;
  }),
}));

// eslint-disable-next-line import/first -- the process boundary is installed first
import { DspHostSupervisor } from '../../../main/dspHost/supervisor';

const PARAMETERS = 12;

const handshake = (): Buffer => {
  const frame = Buffer.alloc(HANDSHAKE_BYTES);
  frame.writeUInt32LE(MAGIC_HANDSHAKE, 0);
  frame.writeUInt32LE(HOST_WIRE_PROTOCOL_VERSION, 4);
  frame.writeUInt32LE(PARAMETERS, 16);
  frame.writeUInt32LE(ANALYSIS_HEADER_BYTES, 20);
  return frame;
};

const ack = (requestId: number): Buffer => {
  const frame = Buffer.alloc(ACK_BYTES);
  frame.writeUInt32LE(MAGIC_ACK, 0);
  frame.writeUInt16LE(HOST_STATUS.applied, 6);
  frame.writeUInt32LE(requestId, 8);
  return frame;
};

/** Every command the supervisor has written to the host so far. */
const commandsTo = (host: IFakeHost): Array<{ id: number; kind: number }> => {
  const written: Buffer[] = [];
  let chunk: unknown = host.stdin.read();
  while (chunk !== null) {
    if (Buffer.isBuffer(chunk)) {
      written.push(chunk);
    }
    chunk = host.stdin.read();
  }
  const bytes = Buffer.concat(written);
  const commands: Array<{ id: number; kind: number }> = [];
  for (let at = 0; at + COMMAND_BYTES <= bytes.length; at += COMMAND_BYTES) {
    commands.push({
      kind: bytes.readUInt16LE(at + 6),
      id: bytes.readUInt32LE(at + 8),
    });
  }
  return commands;
};

/**
 * Lets the streams and promises run to rest: a few turns of the real event
 * loop, taken before the fake timers replace `setImmediate`, so nothing here
 * is counted as a timer of the code under test.
 */
const nextTurn = setImmediate;
const settle = async () => {
  for (let turn = 0; turn < 5; turn += 1) {
    // eslint-disable-next-line no-await-in-loop -- one turn of the loop at a time
    await new Promise<void>((resolve) => {
      nextTurn(resolve);
    });
  }
};

const supervisor = () =>
  new DspHostSupervisor({
    executablePath: 'fluideq-dsp-host',
    roomHeadsDir: 'heads',
    expectedParameterCount: PARAMETERS,
  });

const started = async () => {
  const host = supervisor();
  const starting = host.start();
  const child = hosts[hosts.length - 1];
  child.stdout.write(handshake());
  await expect(starting).resolves.toBe(true);
  return { host, child };
};

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask'] });
  hosts.length = 0;
});

afterEach(() => {
  jest.useRealTimers();
});

describe('the handshake', () => {
  it('is waited for with no deadline, and a host that closes its output without one is refused', async () => {
    const host = supervisor();
    let answer: boolean | undefined;
    host.start().then((ready) => {
      answer = ready;
      return ready;
    });
    await settle();
    expect(jest.getTimerCount()).toBe(0);
    expect(answer).toBeUndefined();
    hosts[0].stdout.end();
    await settle();
    expect(answer).toBe(false);
    expect(host.getState()).toBe('failed');
  });

  it('is taken whenever it arrives', async () => {
    const { host } = await started();
    expect(host.getState()).toBe('ready');
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe('a request', () => {
  it('waits for its acknowledgement with no deadline', async () => {
    const { host, child } = await started();
    let opened: boolean | undefined;
    host.openDevice().then((applied) => {
      opened = applied;
      return applied;
    });
    await settle();
    expect(jest.getTimerCount()).toBe(0);
    expect(opened).toBeUndefined();
    const [request] = commandsTo(child);
    expect(request.kind).toBe(HOST_COMMANDS.start);
    child.stdout.write(ack(request.id));
    await settle();
    expect(opened).toBe(true);
  });

  it('is refused when the host exits before answering', async () => {
    const { host, child } = await started();
    const opening = host.openDevice();
    await settle();
    child.emit('close', 1, null);
    await expect(opening).rejects.toThrow('the DSP host exited');
  });
});

describe('stop', () => {
  it('asks the host to leave, closes its input, and waits for it to go — no clock, no kill', async () => {
    const { host, child } = await started();
    let stopped = false;
    host.stop().then(() => {
      stopped = true;
      return stopped;
    });
    await settle();
    const commands = commandsTo(child);
    expect(commands.map(({ kind }) => kind)).toEqual([HOST_COMMANDS.shutdown]);
    expect(child.stdin.writableEnded).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
    // Acknowledged is not gone: the host still has its endpoint to close.
    child.stdout.write(ack(commands[0].id));
    await settle();
    expect(stopped).toBe(false);
    child.emit('close', 0, null);
    await settle();
    expect(stopped).toBe(true);
    expect(child.kill).not.toHaveBeenCalled();
    expect(host.getState()).toBe('stopped');
  });

  it('finishes when a host that never acknowledged exits on the end of its input', async () => {
    const { host, child } = await started();
    const stopping = host.stop();
    await settle();
    expect(child.stdin.writableEnded).toBe(true);
    child.emit('close', 0, null);
    await expect(stopping).resolves.toBeUndefined();
    expect(child.kill).not.toHaveBeenCalled();
  });
});
