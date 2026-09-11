/** @jest-environment node */
/* FluidEQ — GPL-3.0-or-later */

/**
 * The pipe the FluidEQ Engine holds to know FluidEQ is running. What has to
 * hold: it is served by the time startup goes on, a starting app wakes the
 * engine by changing its folder, and nothing the engine does on the line can
 * throw out of the app — an unhandled 'error' there would crash FluidEQ,
 * which is the one thing the engine must never be able to do.
 */

import fs from 'fs';
import net from 'net';
import os from 'os';
import path from 'path';
import { flushPendingWrites } from '../../../main/asyncWriter';
import {
  ENGINE_OWNER_MARKER,
  startEngineOwnerPipe,
} from '../../../main/engineOwnerPipe';

const onWindows = process.platform === 'win32' ? describe : describe.skip;

const connect = (pipe: string) =>
  new Promise<net.Socket>((resolve, reject) => {
    const socket = net.connect(pipe, () => resolve(socket));
    socket.once('error', reject);
  });

const closed = (socket: net.Socket) =>
  new Promise<void>((resolve) => {
    socket.once('close', () => resolve());
    socket.destroy();
  });

onWindows('the FluidEQ Engine owner pipe', () => {
  let dir = '';
  let name = '';

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-owner-'));
    name = `\\\\.\\pipe\\fluideq-owner-test-${process.pid}-${path.basename(dir)}`;
  });

  afterEach(async () => {
    await flushPendingWrites().catch(() => undefined);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('is served, and wakes the engine with a file naming this process', async () => {
    const pipe = await startEngineOwnerPipe(name, dir);
    try {
      await closed(await connect(name));
      await flushPendingWrites();
      const marker = fs.readFileSync(
        path.join(dir, ENGINE_OWNER_MARKER),
        'utf8',
      );
      expect(marker).toContain(`pid=${process.pid}`);
    } finally {
      await pipe.close();
    }
  });

  it('never makes the engine folder on a machine without the engine', async () => {
    const absent = path.join(dir, 'no-engine');
    const pipe = await startEngineOwnerPipe(name, absent);
    try {
      // A positive control that the pipe is really up, so the missing file
      // is not just the whole thing having failed.
      await closed(await connect(name));
    } finally {
      await pipe.close();
    }
    await flushPendingWrites();
    expect(fs.existsSync(absent)).toBe(false);
  });

  it('keeps serving through a connection that writes and then drops', async () => {
    const pipe = await startEngineOwnerPipe(name, dir);
    try {
      const rude = await connect(name);
      rude.write('the engine never writes this');
      await closed(rude);
      // Still there for the next engine process.
      const next = await connect(name);
      expect(next.readyState).toBe('open');
      await closed(next);
    } finally {
      await pipe.close();
    }
  });

  it('resolves, rather than throwing, when the name is already taken', async () => {
    const first = await startEngineOwnerPipe(name, dir);
    try {
      const second = await startEngineOwnerPipe(name, dir);
      await expect(second.close()).resolves.toBeUndefined();
      // And the first is untouched by the second's failure.
      const next = await connect(name);
      expect(next.readyState).toBe('open');
      await closed(next);
    } finally {
      await first.close();
    }
  });
});
