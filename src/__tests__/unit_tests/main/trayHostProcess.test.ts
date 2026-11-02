/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * FluidEQ-Tray as main starts it: its `ready`, its connection and hello,
 * what main sends, what it hears — and every way the start can fail, each of
 * which must leave main to draw its own tray rather than wait for ever.
 */

import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import {
  ITrayHostChild,
  ITrayHostParts,
  ITrayHostSocket,
  startTrayHost,
} from '../../../main/nativeTray/trayHostProcess';

jest.mock('electron-log', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const fakeChild = () =>
  Object.assign(new EventEmitter(), {
    stdout: new PassThrough(),
    unref: jest.fn(),
  }) satisfies ITrayHostChild;

/** Main's end of the tray's pipe, recording what main writes. */
const fakeSocket = () => {
  const socket = Object.assign(new EventEmitter(), {
    written: [] as string[],
    destroyed: false,
    write: (text: string) => {
      socket.written.push(text);
      return true;
    },
    destroy: () => {
      if (!socket.destroyed) {
        socket.destroyed = true;
        // As a net socket does: `close` follows, once.
        socket.emit('close');
      }
    },
    /** As a net socket ends: the last line written, then gone. */
    end: (text: string, done: (error?: Error | null) => void) => {
      socket.written.push(text);
      done(null);
      socket.destroy();
    },
    say: (text: string) => socket.emit('data', Buffer.from(text, 'utf8')),
    messages: () =>
      socket.written.flatMap((chunk) =>
        chunk
          .split('\n')
          .filter((line) => line.length > 0)
          .map((line) => JSON.parse(line) as Record<string, unknown>),
      ),
  });
  return socket satisfies ITrayHostSocket;
};

const setUp = () => {
  const child = fakeChild();
  const socket = fakeSocket();
  let reached: () => void = () => undefined;
  /** Settles once main connects to the tray's pipe. */
  const connected = new Promise<void>((resolve) => {
    reached = resolve;
  });
  const parts: ITrayHostParts = {
    start: jest.fn(() => child),
    connect: jest.fn(() => {
      reached();
      return socket;
    }),
  };
  return { child, socket, parts, connected };
};

describe('starting FluidEQ-Tray', () => {
  it('starts it for this data folder, waits for ready, and is greeted', async () => {
    const { child, socket, parts, connected } = setUp();
    const started = startTrayHost(
      {
        executable: 'C:\\app\\FluidEQ-Tray.exe',
        key: 'abc123',
        ownerPipe: '\\\\.\\pipe\\FluidEQ-Engine-Owner',
      },
      parts,
    );
    expect(parts.start).toHaveBeenCalledWith('C:\\app\\FluidEQ-Tray.exe', [
      '--key',
      'abc123',
      '--owner-pipe',
      '\\\\.\\pipe\\FluidEQ-Engine-Owner',
    ]);
    child.stdout.write('rea');
    child.stdout.write('dy\n');
    await connected;
    expect(parts.connect).toHaveBeenCalledWith(
      '\\\\.\\pipe\\FluidEQ-Tray-abc123',
    );
    expect(child.unref).toHaveBeenCalled();
    socket.say('{"type":"hello","pid":77,"ownerPipe":true}\n');
    const host = await started;
    expect(host?.pid).toBe(77);
    expect(host?.servesOwnerPipe).toBe(true);
  });

  it('names no engine line when it is not to serve one', async () => {
    const { child, socket, parts, connected } = setUp();
    const started = startTrayHost({ executable: 'tray.exe', key: 'k' }, parts);
    child.stdout.write('ready\n');
    await connected;
    socket.say('{"type":"hello","pid":5,"ownerPipe":false}\n');
    expect((await started)?.servesOwnerPipe).toBe(false);
    expect(parts.start).toHaveBeenCalledWith('tray.exe', ['--key', 'k']);
  });

  it('gives up when the tray ends without ready, and connects to nothing', async () => {
    const { child, parts } = setUp();
    const started = startTrayHost({ executable: 'tray.exe', key: 'k' }, parts);
    child.stdout.end();
    await expect(started).resolves.toBeUndefined();
    expect(parts.connect).not.toHaveBeenCalled();
  });

  it('gives up when the tray says anything but ready', async () => {
    const { child, parts } = setUp();
    const started = startTrayHost({ executable: 'tray.exe', key: 'k' }, parts);
    child.stdout.write('cannot serve\n');
    await expect(started).resolves.toBeUndefined();
    expect(parts.connect).not.toHaveBeenCalled();
  });

  it('gives up when the program cannot be started', async () => {
    const { child, parts } = setUp();
    const started = startTrayHost({ executable: 'gone.exe', key: 'k' }, parts);
    child.emit('error', new Error('spawn gone.exe ENOENT'));
    await expect(started).resolves.toBeUndefined();
  });

  it('gives up when its line ends before it speaks', async () => {
    const { child, socket, parts, connected } = setUp();
    const started = startTrayHost({ executable: 'tray.exe', key: 'k' }, parts);
    child.stdout.write('ready\n');
    await connected;
    socket.emit('error', new Error('connect ENOENT'));
    socket.emit('close');
    await expect(started).resolves.toBeUndefined();
  });
});

describe('speaking to FluidEQ-Tray', () => {
  const greeted = async () => {
    const { child, socket, parts, connected } = setUp();
    const started = startTrayHost({ executable: 'tray.exe', key: 'k' }, parts);
    child.stdout.write('ready\n');
    await connected;
    socket.say('{"type":"hello","pid":9,"ownerPipe":true}\n');
    const host = await started;
    if (!host) {
      throw new Error('the tray was not greeted');
    }
    return { host, socket };
  };

  it('sends what to show and the recipe, each when it changes', async () => {
    const { host, socket } = await greeted();
    host.setRecipe({
      configDir: 'C:\\cfg',
      rootName: 'fluideq.txt',
      rootText: 'x',
      removeNames: [],
      removePrefixes: [],
    });
    host.show({ tooltip: 'FluidEQ', icon: 'C:\\icon.ico', menu: [] });
    host.setRecipe(undefined);
    expect(socket.messages().map((message) => message.type)).toEqual([
      'recipe',
      'state',
      'recipe',
    ]);
    expect(socket.messages()[2]).toEqual({ type: 'recipe' });
  });

  it('hears presses, a line in pieces and two in one, and nothing else', async () => {
    const { host, socket } = await greeted();
    const pressed = jest.fn();
    host.onPressed(pressed);
    socket.say('{"type":"pressed","id":"op');
    socket.say('en"}\n{"type":"pressed","id":"quit"}\n');
    socket.say('{"type":"pressed","id":"delete-everything"}\nnoise\n');
    expect(pressed.mock.calls).toEqual([['open'], ['quit']]);
  });

  it('hears the tray lost once, and only when main did not end it', async () => {
    const lost = jest.fn();
    const ended = await greeted();
    ended.host.onLost(lost);
    ended.socket.emit('close');
    ended.socket.emit('close');
    expect(lost).toHaveBeenCalledTimes(1);
    ended.host.show({ tooltip: 'late', icon: '', menu: [] });
    expect(ended.socket.messages()).toEqual([]);

    const closed = await greeted();
    const notLost = jest.fn();
    closed.host.onLost(notLost);
    closed.host.close();
    expect(closed.socket.destroyed).toBe(true);
    expect(notLost).not.toHaveBeenCalled();
  });

  it('drops a line no tray would send rather than hold it', async () => {
    const { socket } = await greeted();
    socket.say('x'.repeat(64 * 1024 + 1));
    expect(socket.destroyed).toBe(true);
  });

  const RELAUNCH = { file: 'C:\\app\\FluidEQ.exe', args: [], cwd: 'C:\\app' };

  it('leaves with the relaunch as its last line, and is not lost by it', async () => {
    const { host, socket } = await greeted();
    const lost = jest.fn();
    host.onLost(lost);
    await expect(host.leave(RELAUNCH)).resolves.toBe(true);
    expect(socket.messages()).toEqual([
      { type: 'leaving', relaunch: RELAUNCH },
    ]);
    expect(socket.destroyed).toBe(true);
    expect(lost).not.toHaveBeenCalled();
  });

  it('says it could not tell a tray whose line had ended', async () => {
    const { host, socket } = await greeted();
    socket.emit('close');
    await expect(host.leave(RELAUNCH)).resolves.toBe(false);
  });

  it('says it could not tell a tray whose line ends on the way', async () => {
    const { host, socket } = await greeted();
    // The line goes before the last line has: no `finish`, only `close`.
    socket.end = () => socket.destroy();
    await expect(host.leave(RELAUNCH)).resolves.toBe(false);

    const failing = await greeted();
    failing.socket.end = (_text, done) => done(new Error('EPIPE'));
    await expect(failing.host.leave(RELAUNCH)).resolves.toBe(false);
  });
});
