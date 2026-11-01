/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Main's hold on the core's process (`main/coreProcess/coreClient.ts`): it
 * runs exactly while something needs to hear the output, is handed what is
 * wanted whenever it starts, answers what main asks, and is let go after
 * crashing too often — with every listener told so.
 */
import { EventEmitter } from 'events';
import type { MessagePortMain } from 'electron';
import {
  MAX_RESTARTS,
  createProcessCoreClient,
  type ICoreChild,
} from 'main/coreProcess/coreClient';
import type { TToCore } from 'core/process/coreWire';

const fakeChild = () => {
  const emitter = new EventEmitter();
  const posted: { message: TToCore; transfer?: unknown[] }[] = [];
  const child = Object.assign(emitter, {
    posted,
    postMessage: jest.fn((message: TToCore, transfer?: unknown[]) => {
      posted.push({ message, transfer });
    }),
    kill: jest.fn(() => true),
  });
  return {
    child,
    say: (message: unknown) => emitter.emit('message', message),
    exit: (code: number) => emitter.emit('exit', code),
    lastPosted: () => posted[posted.length - 1]?.message,
  };
};

const fakePort = () =>
  ({ postMessage: jest.fn(), close: jest.fn() }) as unknown as MessagePortMain &
    Record<'postMessage' | 'close', jest.Mock>;

const setUp = () => {
  const children: ReturnType<typeof fakeChild>[] = [];
  const fork = jest.fn(() => {
    const made = fakeChild();
    children.push(made);
    return made.child as unknown as ICoreChild;
  });
  const applyTrim = jest.fn(async () => true);
  const log = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const client = createProcessCoreClient({ fork, applyTrim, log });
  const latest = () => children[children.length - 1];
  return { client, fork, applyTrim, log, children, latest };
};

const settled = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe('the core’s process, there only while needed', () => {
  it('starts no core while nothing needs to hear the output', () => {
    const { client, fork } = setUp();
    client.createClock({
      secondsPerStep: 0.25,
      onStep: jest.fn(),
      onLost: jest.fn(),
    });
    client.desktopSound.want(false);
    client.apoHeadroom.follow({
      enabled: false,
      trimDb: 0,
      hasLegacyProgramme: false,
    });
    expect(fork).not.toHaveBeenCalled();
  });

  it('starts one for the window’s port, and hands the port over once it listens', () => {
    const { client, fork, latest } = setUp();
    const port = fakePort();
    client.attachWindowPort(port);
    expect(fork).toHaveBeenCalledTimes(1);
    expect(latest().child.postMessage).not.toHaveBeenCalled();
    latest().say({ kind: 'ready' });
    expect(latest().child.posted).toEqual([
      { message: { kind: 'port', id: 1 }, transfer: [port] },
    ]);
  });

  it('ends it when the last need goes, and does not count that as a crash', () => {
    const { client, fork, latest, log } = setUp();
    client.attachWindowPort(fakePort());
    const first = latest();
    first.say({ kind: 'ready' });
    first.say({ kind: 'port-gone', id: 1 });
    expect(first.child.kill).toHaveBeenCalledTimes(1);
    first.exit(0);
    expect(fork).toHaveBeenCalledTimes(1);
    expect(log.warn).not.toHaveBeenCalled();
    // POSITIVE CONTROL: a new need starts a new one.
    client.desktopSound.want(true);
    expect(fork).toHaveBeenCalledTimes(2);
  });

  it('hands a fresh core everything wanted, in one go', () => {
    const { client, latest } = setUp();
    client.desktopSound.want(true);
    const clock = client.createClock({
      secondsPerStep: 0.25,
      onStep: jest.fn(),
      onLost: jest.fn(),
    });
    clock.follow(true);
    client.apoHeadroom.follow({
      enabled: true,
      trimDb: -2,
      hasLegacyProgramme: false,
    });
    expect(latest().child.postMessage).not.toHaveBeenCalled();
    latest().say({ kind: 'ready' });
    expect(latest().child.posted.map(({ message }) => message)).toEqual([
      { kind: 'desktop-want', wanted: true },
      { kind: 'clock-follow', id: 1, secondsPerStep: 0.25, wanted: true },
      {
        kind: 'headroom-follow',
        state: { enabled: true, trimDb: -2, hasLegacyProgramme: false },
      },
    ]);
  });
});

describe('what main asks of it', () => {
  it('asks for a desktop frame, and answers silence while there is no core', async () => {
    const { client, latest } = setUp();
    await expect(client.desktopSound.read()).resolves.toEqual(
      expect.objectContaining({ waveform: expect.any(Array) }),
    );
    client.desktopSound.want(true);
    latest().say({ kind: 'ready' });
    const reading = client.desktopSound.read();
    const asked = latest().lastPosted();
    expect(asked).toEqual({ kind: 'desktop-read', id: expect.any(Number) });
    const frame = { points: [{ x: 1, y: 2 }], waveform: [0.5] };
    latest().say({
      kind: 'desktop-frame',
      id: (asked as { id: number }).id,
      frame,
    });
    await expect(reading).resolves.toEqual(frame);
  });

  it('answers a read made while the core is starting with silence', async () => {
    const { client, fork } = setUp();
    client.desktopSound.want(true);
    expect(fork).toHaveBeenCalledTimes(1);
    await expect(client.desktopSound.read()).resolves.toEqual(
      expect.objectContaining({ points: expect.any(Array) }),
    );
  });

  it('gives the backgrounds to the window when the core cannot hear, and takes them back on an output change', () => {
    const { client, fork, latest } = setUp();
    const serves = jest.fn();
    client.desktopSound.onServesChanged(serves);
    client.desktopSound.want(true);
    latest().say({ kind: 'ready' });
    latest().say({ kind: 'desktop-serves', serves: false });
    expect(serves).toHaveBeenLastCalledWith(false);
    // Nothing else needs it: the core goes.
    expect(latest().child.kill).toHaveBeenCalled();
    client.desktopSound.outputChanged();
    expect(serves).toHaveBeenLastCalledWith(true);
    expect(client.desktopSound.serves()).toBe(true);
    expect(fork).toHaveBeenCalledTimes(2);
  });

  it('answers a read still waiting with silence when the core ends', async () => {
    const { client, latest } = setUp();
    client.desktopSound.want(true);
    latest().say({ kind: 'ready' });
    const reading = client.desktopSound.read();
    latest().exit(1);
    await expect(reading).resolves.toEqual(
      expect.objectContaining({ points: expect.any(Array) }),
    );
  });

  it('steps the clock, says when it is lost, and lets the core go then', () => {
    const { client, latest } = setUp();
    const onStep = jest.fn();
    const onLost = jest.fn();
    const clock = client.createClock({ secondsPerStep: 0.25, onStep, onLost });
    clock.follow(true);
    const core = latest();
    core.say({ kind: 'ready' });
    core.say({ kind: 'clock-step', id: 1 });
    expect(onStep).toHaveBeenCalledTimes(1);
    core.say({ kind: 'clock-lost', id: 1 });
    expect(onLost).toHaveBeenCalledTimes(1);
    expect(clock.isLost()).toBe(true);
    expect(core.child.kill).toHaveBeenCalled();
    clock.reset();
    expect(clock.isLost()).toBe(false);
  });

  it('writes a trim through main and tells the core whether it landed', async () => {
    const { client, applyTrim, latest } = setUp();
    client.apoHeadroom.follow({
      enabled: true,
      trimDb: 0,
      hasLegacyProgramme: false,
    });
    latest().say({ kind: 'ready' });
    latest().say({ kind: 'trim', id: 7, trimDb: -3 });
    expect(applyTrim).toHaveBeenCalledWith(-3);
    await settled();
    expect(latest().lastPosted()).toEqual({
      kind: 'trim-result',
      id: 7,
      applied: true,
    });
  });

  it('pays no attention to what a let-go core still says', () => {
    const { client, latest } = setUp();
    const onStep = jest.fn();
    const clock = client.createClock({
      secondsPerStep: 0.25,
      onStep,
      onLost: jest.fn(),
    });
    clock.follow(true);
    const old = latest();
    old.say({ kind: 'ready' });
    clock.follow(false);
    old.say({ kind: 'clock-step', id: 1 });
    expect(onStep).not.toHaveBeenCalled();
  });
});

describe('a core that ends by itself', () => {
  it('is started again and handed what was wanted', () => {
    const { client, fork, latest, log } = setUp();
    client.desktopSound.want(true);
    latest().say({ kind: 'ready' });
    latest().exit(1);
    expect(fork).toHaveBeenCalledTimes(2);
    expect(log.warn).toHaveBeenCalled();
    latest().say({ kind: 'ready' });
    expect(latest().child.posted[0].message).toEqual({
      kind: 'desktop-want',
      wanted: true,
    });
  });

  it(`is let go after ${MAX_RESTARTS} restarts, and everyone is told`, () => {
    const { client, fork, latest, log } = setUp();
    const onLost = jest.fn();
    const clock = client.createClock({
      secondsPerStep: 0.25,
      onStep: jest.fn(),
      onLost,
    });
    clock.follow(true);
    const serves = jest.fn();
    client.desktopSound.onServesChanged(serves);
    client.desktopSound.want(true);
    for (let crash = 0; crash <= MAX_RESTARTS; crash += 1) {
      latest().exit(1);
    }
    expect(fork).toHaveBeenCalledTimes(MAX_RESTARTS + 1);
    expect(log.error).toHaveBeenCalled();
    expect(onLost).toHaveBeenCalledTimes(1);
    expect(serves).toHaveBeenCalledWith(false);
    expect(client.desktopSound.serves()).toBe(false);

    const port = fakePort();
    client.attachWindowPort(port);
    expect(port.postMessage).toHaveBeenCalledWith({ kind: 'failed' });
    expect(port.close).toHaveBeenCalled();
    expect(fork).toHaveBeenCalledTimes(MAX_RESTARTS + 1);
    // A clock made afterwards is lost from the start, and starts nothing.
    const late = client.createClock({
      secondsPerStep: 0.25,
      onStep: jest.fn(),
      onLost: jest.fn(),
    });
    expect(late.isLost()).toBe(true);
    late.follow(true);
    expect(fork).toHaveBeenCalledTimes(MAX_RESTARTS + 1);
  });
});

it('ends the core when main closes', () => {
  const { client, latest } = setUp();
  client.desktopSound.want(true);
  client.close();
  expect(latest().child.kill).toHaveBeenCalled();
});
