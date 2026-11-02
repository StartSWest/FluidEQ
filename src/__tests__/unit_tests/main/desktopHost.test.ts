/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The desktop backgrounds' one C++ host as main runs it: started with the
 * first monitor, each monitor hearing its own answers, ended with the last,
 * started afresh by the next, and every open monitor failed if it ends.
 */

import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import type { TSceneHostChild } from '../../../main/lighting/lampSceneHost';
import { messageWriter } from '../../../main/lighting/sceneHostWire';
import { createDesktopHost } from '../../../main/wallpaper/desktopHost';
import { DESKTOP_HOST_KIND } from '../../../main/wallpaper/desktopHostWire';

jest.mock('electron-log', () => ({ warn: jest.fn(), info: jest.fn() }));

const fakeChild = () => {
  const stdin = new PassThrough();
  const written: number[] = [];
  stdin.on('data', (chunk: Buffer) =>
    // The kind of each whole message, in order.
    written.push(
      new DataView(chunk.buffer, chunk.byteOffset).getUint32(4, true),
    ),
  );
  const child = Object.assign(new EventEmitter(), {
    stdin,
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    pid: 4242,
  });
  return { child, written };
};

const events = () => ({
  window: jest.fn(),
  loaded: jest.fn(),
  drawn: jest.fn(),
  failed: jest.fn(),
});

const RECT = { x: 0, y: 0, width: 1920, height: 1080 };
const CHOICE = {
  autoFloor: 0.35,
  fsr: true,
  smoothing: 'best' as const,
  paceMs: 0,
};

describe("the desktop backgrounds' host", () => {
  it('starts with the first monitor and routes each answer to its own', () => {
    const fakes: ReturnType<typeof fakeChild>[] = [];
    const spawnHost = jest.fn(
      (_executable: string, args: readonly string[]) => {
        expect(args).toEqual(expect.arrayContaining(['--mode', 'desktop']));
        const fake = fakeChild();
        fakes.push(fake);
        return fake.child as unknown as TSceneHostChild;
      },
    );
    const host = createDesktopHost({
      executable: 'x.exe',
      angleDir: 'a',
      spawnHost,
    });
    const left = events();
    const right = events();
    const one = host.open(RECT, CHOICE, left);
    host.open({ ...RECT, x: 1920 }, { ...CHOICE, pinned: 0.5 }, right);
    expect(spawnHost).toHaveBeenCalledTimes(1);
    expect(one.pid()).toBe(4242);

    fakes[0].child.stdout.write(
      messageWriter(DESKTOP_HOST_KIND.drawn).u32(2).u32(7).finish(),
    );
    expect(right.drawn).toHaveBeenCalledWith(7);
    expect(left.drawn).not.toHaveBeenCalled();
    expect(fakes[0].written).toEqual([
      DESKTOP_HOST_KIND.open,
      DESKTOP_HOST_KIND.open,
    ]);
  });

  it('ends with the last monitor closed, and starts afresh for the next', () => {
    const fakes: ReturnType<typeof fakeChild>[] = [];
    const host = createDesktopHost({
      executable: 'x.exe',
      angleDir: 'a',
      spawnHost: () => {
        const fake = fakeChild();
        fakes.push(fake);
        return fake.child as unknown as TSceneHostChild;
      },
    });
    const first = host.open(RECT, CHOICE, events());
    first.close();
    expect(fakes[0].written).toEqual([
      DESKTOP_HOST_KIND.open,
      DESKTOP_HOST_KIND.close,
    ]);
    // Its input closed: the host ends with it.
    expect(fakes[0].child.stdin.writableEnded).toBe(true);
    // Nothing more reaches a monitor once it is closed.
    first.pause(true);
    host.open(RECT, CHOICE, events());
    expect(fakes).toHaveLength(2);
  });

  it('fails every open monitor when it ends by itself', () => {
    const fake = fakeChild();
    const host = createDesktopHost({
      executable: 'x.exe',
      angleDir: 'a',
      spawnHost: () => fake.child as unknown as TSceneHostChild,
    });
    const left = events();
    const right = events();
    host.open(RECT, CHOICE, left);
    host.open(RECT, CHOICE, right);
    fake.child.stderr.write('FluidEQ-Scenes: waiting failed\n');
    fake.child.emit('exit', 1);
    expect(left.failed).toHaveBeenCalledWith(0, 'lost', expect.any(String));
    expect(right.failed).toHaveBeenCalledWith(0, 'lost', expect.any(String));
    expect(host.pid()).toBeUndefined();
  });
});
