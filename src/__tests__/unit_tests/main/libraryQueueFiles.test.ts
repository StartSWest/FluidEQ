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
import { trackIdForPath } from '../../../main/library/libraryScanDiscovery';
import type { ILibraryStore } from '../../../main/library/libraryStore';
import { openLibraryStore } from '../../../main/library/libraryStoreOpen';

let store: ILibraryStore;
let music: string;

beforeEach(() => {
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

afterEach(() => store.close());

describe('music dropped on the queue', () => {
  it('answers every playable file in the order dropped, and writes the new ones pending', async () => {
    const dropped = [
      path.join(music, 'Loose', 'b.flac'),
      path.join(music, 'Loose', 'notes.txt'),
      path.join(music, 'Loose', 'a.mp3'),
    ];
    const queued = await queueLibraryFiles(store, dropped);
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
    const queued = await queueLibraryFiles(store, [known]);
    expect(queued.trackIds).toEqual([trackIdForPath(known)]);
    expect(queued.addedRootIds).toEqual([]);
    expect(store.track(trackIdForPath(known))?.title).toBe('Known song');
  });

  it('refuses a path on another machine before asking the disk anything', async () => {
    const queued = await queueLibraryFiles(store, [
      '\\\\host\\share\\song.mp3',
      42,
    ]);
    expect(queued).toEqual({ trackIds: [], addedRootIds: [] });
    expect(store.trackCount()).toBe(0);
  });
});
