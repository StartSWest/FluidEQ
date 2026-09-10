/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * @jest-environment node
 */

import { EventEmitter } from 'events';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  writeStarterProject,
  type TProjectBuild,
} from '../../../main/memberScenes/project';
import { watchProject } from '../../../main/memberScenes/projectWatcher';
import type { IScenePack } from '../../../common/scenePacks';

class FakeWatcher extends EventEmitter {
  closed = false;

  close() {
    this.closed = true;
  }
}

const pack = (version: number): IScenePack => ({
  schema: 1,
  id: 'glow-test',
  version,
  contract: 6,
  names: { en: 'Glow Test' },
  fallbackStyle: 'bars',
  swatch: ['#000000', '#00e5cf'],
  source: 'vec4 sceneColour(vec2 uv) { return vec4(1.0); }',
  params: [],
});

/** A read the test finishes by hand, so nothing waits on a clock. */
const deferredReads = () => {
  const pending: Array<(build: TProjectBuild) => void> = [];
  const waiters: Array<{ count: number; resolve: () => void }> = [];
  let calls = 0;
  const read = jest.fn(
    () =>
      new Promise<TProjectBuild>((resolve) => {
        pending.push(resolve);
        calls += 1;
        waiters
          .filter((waiter) => calls >= waiter.count)
          .forEach((waiter) => waiter.resolve());
      }),
  );
  const finish = (build: TProjectBuild) => {
    const next = pending.shift();
    if (!next) {
      throw new Error('no read in flight');
    }
    next(build);
  };
  /** Resolves once the watcher has started its `count`th read. */
  const started = (count: number) =>
    new Promise<void>((resolve) => {
      if (calls >= count) {
        resolve();
      } else {
        waiters.push({ count, resolve });
      }
    });
  return { read, finish, pending, started };
};

const setup = () => {
  const fake = new FakeWatcher();
  const reads = deferredReads();
  const builds: TProjectBuild[] = [];
  const watcher = watchProject('C:\\project', (build) => builds.push(build), {
    watch: () => fake,
    read: reads.read,
  });
  return { fake, reads, builds, watcher };
};

describe('watching a project folder', () => {
  it('builds once as soon as it starts', async () => {
    const { reads, builds, watcher } = setup();
    expect(reads.read).toHaveBeenCalledTimes(1);
    reads.finish({ ok: true, pack: pack(1) });
    await watcher.settled();
    expect(builds).toEqual([{ ok: true, pack: pack(1) }]);
  });

  it('turns a burst of saves during a build into exactly one more build', async () => {
    const { fake, reads, builds, watcher } = setup();
    ['change', 'rename', 'change', 'change', 'change'].forEach((type) =>
      fake.emit('change', type, 'scene.frag'),
    );
    // Still only the first read: the burst waits for it, it does not stack.
    expect(reads.read).toHaveBeenCalledTimes(1);
    reads.finish({ ok: true, pack: pack(1) });
    await reads.started(2);
    reads.finish({ ok: true, pack: pack(2) });
    await watcher.settled();
    expect(reads.read).toHaveBeenCalledTimes(2);
    expect(builds.map((build) => build.ok && build.pack.version)).toEqual([
      1, 2,
    ]);
  });

  it('does not send a build identical to the last one', async () => {
    const { fake, reads, builds, watcher } = setup();
    reads.finish({ ok: true, pack: pack(1) });
    await watcher.settled();
    fake.emit('change', 'change', 'scene.frag.swp');
    reads.finish({ ok: true, pack: pack(1) });
    await watcher.settled();
    expect(builds).toHaveLength(1);
    // The control: a real change is sent.
    fake.emit('change', 'change', 'scene.frag');
    reads.finish({ ok: true, pack: pack(2) });
    await watcher.settled();
    expect(builds).toHaveLength(2);
  });

  it('sends problems, and sends the fix after them', async () => {
    const { fake, reads, builds, watcher } = setup();
    reads.finish({
      ok: false,
      problems: [{ code: 'preprocessor', file: 'source', line: 3 }],
    });
    await watcher.settled();
    fake.emit('change', 'change', 'scene.frag');
    reads.finish({ ok: true, pack: pack(1) });
    await watcher.settled();
    expect(builds.map((build) => build.ok)).toEqual([false, true]);
  });

  it('stops for good when closed, even with a build in flight', async () => {
    const { fake, reads, builds, watcher } = setup();
    watcher.close();
    expect(fake.closed).toBe(true);
    reads.finish({ ok: true, pack: pack(1) });
    await watcher.settled();
    fake.emit('change', 'change', 'scene.frag');
    expect(reads.read).toHaveBeenCalledTimes(1);
    expect(builds).toEqual([]);
  });

  it('rebuilds when a file really changes on disk', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-watch-'));
    try {
      expect(await writeStarterProject(root)).toBe('written');
      const versions: number[] = [];
      let waiting: ((version: number) => void) | undefined;
      const watcher = watchProject(root, (build) => {
        const version = build.ok ? build.pack.version : -1;
        versions.push(version);
        waiting?.(version);
      });
      await watcher.settled();
      expect(versions).toEqual([1]);
      const rebuilt = new Promise<number>((resolve) => {
        waiting = resolve;
      });
      const manifest = JSON.parse(
        fs.readFileSync(path.join(root, 'pack.json'), 'utf8'),
      );
      fs.writeFileSync(
        path.join(root, 'pack.json'),
        JSON.stringify({ ...manifest, version: 2 }),
      );
      expect(await rebuilt).toBe(2);
      watcher.close();
      await watcher.settled();
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('reports a folder that went away and stops watching it', async () => {
    const { fake, reads, builds, watcher } = setup();
    reads.finish({ ok: true, pack: pack(1) });
    await watcher.settled();
    fake.emit('error', new Error('EPERM'));
    expect(fake.closed).toBe(true);
    expect(builds[builds.length - 1]).toEqual({
      ok: false,
      problems: [{ code: 'missing-file', file: 'pack.json' }],
    });
    expect(reads.pending).toHaveLength(0);
  });
});
