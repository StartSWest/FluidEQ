/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  buildRoot,
  queueLibraryFiles,
} from '../../../main/library/libraryQueueFiles';
import {
  discoverDirectory,
  trackIdForPath,
  type IDiscoverState,
} from '../../../main/library/libraryScanDiscovery';
import type { ILibraryStore } from '../../../main/library/libraryStore';
import { openLibraryStore } from '../../../main/library/libraryStoreOpen';

let store: ILibraryStore;
let music: string;
const scanRoots = jest.fn(async (rootIds: readonly string[]) => {
  const scanningStore = store;
  for (let i = 0; i < rootIds.length; i += 1) {
    const root = scanningStore.root(rootIds[i]);
    if (root) {
      const state: IDiscoverState = {
        candidates: [],
        seen: 0,
        karaokeSkipped: 0,
        cancelled: false,
      };
      // Real folder discovery, without parsing these deliberately empty media
      // fixtures. The scan runner's metadata and cancellation have own tests.
      // eslint-disable-next-line no-await-in-loop -- the production runner serializes roots too
      await discoverDirectory(
        root.path,
        {
          rootId: root.id,
          userDataDir: music,
          lookupKnown: scanningStore.trackByPath,
          force: false,
          onProgress: () => undefined,
          onTracks: (tracks) => scanningStore.upsertTracks(tracks, 0),
          isCancelled: () => false,
        },
        state,
      );
    }
  }
});

beforeEach(() => {
  scanRoots.mockClear();
  music = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-drop-'));
  ['Loose/a.mp3', 'Loose/b.flac', 'Loose/notes.txt', 'Known/c.mp3'].forEach(
    (name) => {
      fs.mkdirSync(path.dirname(path.join(music, name)), { recursive: true });
      fs.writeFileSync(path.join(music, name), 'x');
    },
  );
  ({ store } = openLibraryStore(
    fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-userdata-')),
  ));
});

afterEach(async () => {
  await Promise.all(scanRoots.mock.results.map((result) => result.value));
  store.close();
});

describe('music dropped on the queue', () => {
  it('answers every playable file in the order dropped, and writes the new ones pending', async () => {
    const dropped = [
      path.join(music, 'Loose', 'b.flac'),
      path.join(music, 'Loose', 'notes.txt'),
      path.join(music, 'Loose', 'a.mp3'),
    ];
    const queued = await queueLibraryFiles(store, dropped, scanRoots);
    expect(queued.trackIds).toEqual([
      trackIdForPath(dropped[0]),
      trackIdForPath(dropped[2]),
    ]);
    expect(store.trackCount()).toBe(2);
    expect(store.track(queued.trackIds[0])?.isPending).toBe(true);
    // Its folder becomes a root, once, for a scan to keep them alive.
    expect(queued.addedRootIds).toHaveLength(1);
    expect(store.roots().map((root) => root.path)).toEqual([
      path.join(music, 'Loose'),
    ]);
  });

  it('keeps the id and the row of a song the library already has', async () => {
    const root = buildRoot(music);
    store.addRoots([root]);
    const known = path.join(music, 'Known', 'c.mp3');
    store.upsertTracks(
      [
        {
          id: trackIdForPath(known),
          rootId: root.id,
          path: known,
          kind: 'audio',
          isPlayable: true,
          title: 'Known song',
          sizeBytes: 1,
          mtimeMs: 1,
          addedAt: 5,
        },
      ],
      1,
    );
    const queued = await queueLibraryFiles(store, [known], scanRoots);
    expect(queued.trackIds).toEqual([trackIdForPath(known)]);
    expect(queued.addedRootIds).toEqual([]);
    expect(store.track(trackIdForPath(known))?.title).toBe('Known song');
  });

  it('refuses a path on another machine before asking the disk anything', async () => {
    const stat = jest.spyOn(fs.promises, 'stat');
    const queued = await queueLibraryFiles(
      store,
      ['\\\\host\\share\\song.mp3', 42],
      scanRoots,
    );
    expect(queued).toEqual({ trackIds: [], addedRootIds: [] });
    expect(store.trackCount()).toBe(0);
    expect(stat).not.toHaveBeenCalled();
    stat.mockRestore();
  });

  it('queues music recursively from a folder using the Library discovery rules', async () => {
    const loose = path.join(music, 'Loose');
    fs.mkdirSync(path.join(loose, 'Disc 2'));
    fs.writeFileSync(path.join(loose, 'Disc 2', 'c.wav'), 'x');
    fs.writeFileSync(path.join(loose, 'karaoke.mp3'), 'x');
    fs.writeFileSync(path.join(loose, 'karaoke.lrc'), '[00:00]Lyrics');
    const queued = await queueLibraryFiles(store, [loose], scanRoots);
    expect(new Set(queued.trackIds)).toEqual(
      new Set([
        trackIdForPath(path.join(loose, 'a.mp3')),
        trackIdForPath(path.join(loose, 'b.flac')),
        trackIdForPath(path.join(loose, 'Disc 2', 'c.wav')),
      ]),
    );
    expect(store.trackCount()).toBe(3);
    expect(store.roots().map((root) => root.path)).toEqual([loose]);
  });

  it('keeps drop order and deduplicates overlapping folders and files', async () => {
    const first = path.join(music, 'Known', 'c.mp3');
    const folder = path.join(music, 'Loose');
    const second = path.join(folder, 'a.mp3');
    const queued = await queueLibraryFiles(
      store,
      [first, second, folder, second, folder],
      scanRoots,
    );
    expect(queued.trackIds).toEqual([
      trackIdForPath(first),
      trackIdForPath(second),
      trackIdForPath(path.join(folder, 'b.flac')),
    ]);
    expect(store.roots()).toHaveLength(2);
  });

  it('reuses a covering root when its subfolder is dropped', async () => {
    store.addRoots([buildRoot(music)]);
    const queued = await queueLibraryFiles(
      store,
      [path.join(music, 'Loose')],
      scanRoots,
    );
    expect(queued.trackIds).toHaveLength(2);
    expect(queued.addedRootIds).toEqual([]);
    expect(store.roots()).toHaveLength(1);
  });
});
