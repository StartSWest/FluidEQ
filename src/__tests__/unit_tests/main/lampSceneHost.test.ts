/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * `FluidEQ-Scenes.exe` as main runs it: started with main as its parent and
 * Electron's ANGLE, its stdout read as the host's messages, and its end told
 * once — as expected when main closed its stdin, as a failure otherwise,
 * with what it last said on stderr.
 */

import { EventEmitter, once } from 'events';
import { PassThrough } from 'stream';
import {
  startLampSceneHost,
  type ILampSceneHostEvents,
  type TSceneHostChild,
} from 'main/lighting/lampSceneHost';
import { referenceLoaded } from 'main/lighting/lampWireFixture';
import { encodePause } from 'main/lighting/sceneHostWire';

const fakeChild = () => {
  const emitter = new EventEmitter();
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const written: Buffer[] = [];
  stdin.on('data', (chunk: Buffer) => written.push(chunk));
  const child = Object.assign(emitter, {
    stdin,
    stdout,
    stderr,
    pid: 4242,
  }) as unknown as TSceneHostChild;
  return { child, emitter, stdin, stdout, stderr, written };
};

const events = (): jest.Mocked<ILampSceneHostEvents> => ({
  grid: jest.fn(),
  picture: jest.fn(),
  loaded: jest.fn(),
  failed: jest.fn(),
  exited: jest.fn(),
});

it('starts the host beside main, hears it, and says it ended as told', async () => {
  const fake = fakeChild();
  const spawnHost = jest.fn(() => fake.child);
  const heard = events();
  const host = startLampSceneHost({
    executable: 'C:\\FluidEQ\\FluidEQ-Scenes.exe',
    angleDir: 'C:\\FluidEQ',
    events: heard,
    spawnHost,
  });
  expect(spawnHost).toHaveBeenCalledWith('C:\\FluidEQ\\FluidEQ-Scenes.exe', [
    '--parent-pid',
    String(process.pid),
    '--angle-dir',
    'C:\\FluidEQ',
  ]);
  expect(host.pid()).toBe(4242);

  host.send(encodePause(true));
  const read = once(fake.stdout, 'data');
  fake.stdout.write(referenceLoaded());
  // Heard by the host's own reader, which listened first.
  await read;
  expect(Buffer.concat(fake.written)).toEqual(Buffer.from(encodePause(true)));
  expect(heard.loaded).toHaveBeenCalledWith(42);

  host.stop();
  fake.emitter.emit('exit', 0);
  expect(heard.exited).toHaveBeenCalledWith(true, '');
  expect(host.pid()).toBeUndefined();
  // Told once, whatever else the child says on the way out.
  fake.emitter.emit('error', new Error('late'));
  expect(heard.exited).toHaveBeenCalledTimes(1);
});

it('calls an end it was not told of a failure, with its last words', async () => {
  const fake = fakeChild();
  const heard = events();
  startLampSceneHost({
    executable: 'x.exe',
    angleDir: 'y',
    events: heard,
    spawnHost: () => fake.child,
  });
  const said = once(fake.stderr, 'data');
  fake.stderr.write('FluidEQ-Scenes: COM could not start\n');
  await said;
  fake.emitter.emit('exit', 1);
  expect(heard.exited).toHaveBeenCalledWith(
    false,
    'FluidEQ-Scenes: COM could not start',
  );
});

it('lets a host go whose stream stops making sense', async () => {
  const fake = fakeChild();
  const heard = events();
  startLampSceneHost({
    executable: 'x.exe',
    angleDir: 'y',
    events: heard,
    spawnHost: () => fake.child,
  });
  const ended = once(fake.stdin, 'finish');
  fake.stdout.write(new Uint8Array(16).fill(0xab));
  // Its stdin closed: the host ends by itself.
  await ended;
  fake.emitter.emit('exit', 0);
  expect(heard.exited).toHaveBeenCalledWith(
    false,
    expect.stringContaining('main could not read it'),
  );
});
