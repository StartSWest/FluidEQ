/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A walk through the store: what it confirms, what it sweeps, what a forced
 * walk keeps, and what a cancelled one leaves alone. The scan runs in this
 * process — outside Electron the host has no worker to start — over real
 * files whose tags are made up.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { buildRoot } from '../../../main/library/libraryQueueFiles';
import { createLibraryScanRunner } from '../../../main/library/libraryScanRunner';
import type { ILibraryStore } from '../../../main/library/libraryStore';
import { openLibraryStore } from '../../../main/library/libraryStoreOpen';

jest.mock('../../../main/library/libraryMetadata', () => ({
  readLibraryTags: jest.fn((filePath: string) =>
    Promise.resolve({
      title: `T ${jest.requireActual('path').basename(filePath)}`,
      durationMs: 1000,
    }),
  ),
  findFolderArt: jest.fn(() => undefined),
}));

const folder = (files: readonly string[]): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-runner-'));
  files.forEach((name) => {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), 'x');
  });
  return dir;
};

const setUp = (files: readonly string[]) => {
  const music = folder(files);
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-userdata-'));
  const { store } = openLibraryStore(userData);
  const root = buildRoot(music);
  store.addRoots([root]);
  const finished: boolean[] = [];
  const counts = { announced: 0 };
  const runner = createLibraryScanRunner({
    store,
    userDataDir: userData,
    sendProgress: (event) => finished.push(event.isDone),
    announce: () => {
      counts.announced += 1;
    },
  });
  return { music, store, root, runner, finished, counts };
};

let opened: ILibraryStore | undefined;
afterEach(() => opened?.close());

it('reads a new root into the store, confirmed, and says it is done', async () => {
  const { music, store, root, runner, finished, counts } = setUp([
    'A/one.mp3',
    'A/two.mp3',
    'B/three.mp3',
  ]);
  opened = store;
  await runner.request([root.id]);
  expect(store.trackCount()).toBe(3);
  expect(store.root(root.id)?.trackCount).toBe(3);
  expect(store.root(root.id)?.lastScanAt).toBeGreaterThan(0);
  expect(finished[finished.length - 1]).toBe(true);
  expect(counts.announced).toBeGreaterThan(0);
  const one = store.trackByPath(path.join(music, 'A', 'one.mp3'));
  expect(one?.title).toBe('T one.mp3');
  expect(one?.isPending).toBeUndefined();
});

it('sweeps a file gone from disk when a walk reaches its end, and only then', async () => {
  const { music, store, root, runner } = setUp(['A/one.mp3', 'A/two.mp3']);
  opened = store;
  await runner.request([root.id]);
  fs.rmSync(path.join(music, 'A', 'two.mp3'));

  // Cancelled before it could finish: what it never reached is not gone.
  const cancelled = runner.rescanAll(false);
  runner.cancel();
  await cancelled;
  expect(store.trackCount()).toBe(2);

  await runner.rescanAll(false);
  expect(store.trackCount()).toBe(1);
  expect(store.root(root.id)?.trackCount).toBe(1);
});

it('re-reads everything on a forced walk and keeps the day each song joined', async () => {
  const { music, store, root, runner } = setUp(['A/one.mp3']);
  opened = store;
  await runner.request([root.id]);
  const file = path.join(music, 'A', 'one.mp3');
  const joined = store.trackByPath(file)?.addedAt;
  await runner.rescanAll(true);
  expect(store.trackCount()).toBe(1);
  expect(store.trackByPath(file)?.addedAt).toBe(joined);
});

it('marks a root whose folder is missing offline and keeps its songs', async () => {
  const { music, store, root, runner } = setUp(['A/one.mp3']);
  opened = store;
  await runner.request([root.id]);
  fs.rmSync(music, { recursive: true, force: true });
  await runner.rescanAll(false);
  expect(store.root(root.id)?.isOffline).toBe(true);
  expect(store.trackCount()).toBe(1);
});

it('does not bring back the songs of a root removed while it was walked', async () => {
  const { store, root, runner } = setUp(['A/one.mp3', 'A/two.mp3']);
  opened = store;
  const walk = runner.request([root.id]);
  store.removeRoot(root.id);
  await walk;
  expect(store.trackCount()).toBe(0);
});
