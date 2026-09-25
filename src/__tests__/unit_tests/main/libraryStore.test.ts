/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import os from 'os';
import path from 'path';
import type {
  ILibraryIndex,
  ILibraryRoot,
  ILibraryTrack,
} from '../../../common/library/types';
import {
  libraryStorePath,
  openLibraryReader,
  openLibraryStore,
} from '../../../main/library/libraryStoreOpen';
import type { ILibraryStore } from '../../../main/library/libraryStore';
import {
  TRACK_SELECT,
  trackFromRow,
  type TStoreRow,
} from '../../../main/library/libraryStoreRows';

/** Every root and song, in the order the store learned them. */
const exportLibraryIndex = (store: ILibraryStore): ILibraryIndex => ({
  version: 1,
  roots: store.roots(),
  tracks: (
    store.database
      .prepare(`SELECT ${TRACK_SELECT} FROM tracks t ORDER BY t.seq`)
      .all() as TStoreRow[]
  ).map(trackFromRow),
});

const temp = (): string =>
  fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-store-'));

const root = (over: Partial<ILibraryRoot> = {}): ILibraryRoot => ({
  id: 'r1',
  path: 'C:\\Music',
  addedAt: 10,
  trackCount: 0,
  karaokeSkipped: 0,
  ...over,
});

let serial = 0;
const track = (over: Partial<ILibraryTrack> = {}): ILibraryTrack => {
  serial += 1;
  return {
    id: `t${serial}`,
    rootId: 'r1',
    path: `C:\\Music\\Pop\\${serial}.mp3`,
    kind: 'audio',
    isPlayable: true,
    title: `Song ${serial}`,
    sizeBytes: 1000 + serial,
    mtimeMs: 1700000000000.25 + serial,
    addedAt: 5 + serial,
    ...over,
  };
};

const opened: { close: () => void }[] = [];
const open = (dir: string) => {
  const result = openLibraryStore(dir);
  opened.push(result.store);
  return result;
};

afterEach(() => {
  opened.splice(0).forEach((store) => store.close());
});

describe('the library store', () => {
  it('opens empty the first time, with nothing to say about a reset', () => {
    const dir = temp();
    const { store, wasReset } = open(dir);
    expect(wasReset).toBe(false);
    expect(store.roots()).toEqual([]);
    expect(store.trackCount()).toBe(0);
    expect(fs.existsSync(libraryStorePath(dir))).toBe(true);
  });

  it('gives back every field exactly as written, and nothing that was absent', () => {
    const { store } = open(temp());
    const full = track({
      artist: "N'Sync",
      albumArtist: '*NSYNC',
      album: 'No Strings Attached',
      trackNo: 3,
      discNo: 1,
      year: 2000,
      genre: 'Pop; Dance',
      durationMs: 201234.5,
      bitrate: 320000,
      sampleRate: 44100,
      channels: 2,
      codec: 'MPEG 1 Layer 3',
      artId: 'abc',
      artworkChecked: true,
      hasMetadataError: false,
      isPending: false,
      normalization: {
        version: 2,
        truePeakDbtp: -0.4,
        integratedLufs: -9.1,
        edges: { leadInMs: 120, endMs: 199000 },
      },
    });
    const bare = track();
    store.addRoots([root()]);
    store.upsertTracks([full, bare], 0);
    expect(store.track(full.id)).toEqual(full);
    const back = store.track(bare.id);
    expect(back).toEqual(bare);
    // Absent, not undefined-valued: `'artist' in track` is how some readers ask.
    expect(Object.keys(back ?? {}).sort()).toEqual(Object.keys(bare).sort());
    expect(store.trackPath(full.id)).toBe(full.path);
    expect(store.trackByPath(full.path)?.id).toBe(full.id);
    // An id from a media URL resolves to its own file and nothing else to
    // anything — the only lookup the media protocol makes.
    expect(store.trackPath('../../etc/passwd')).toBeUndefined();
    expect(store.trackPath('constructor')).toBeUndefined();
  });

  it('moves the JSON index in once, in order, and keeps the file aside', () => {
    const dir = temp();
    const roots = [root(), root({ id: 'r2', path: 'D:\\More', addedAt: 20 })];
    const tracks = [track(), track({ rootId: 'r2' }), track()];
    const index: ILibraryIndex = { version: 1, roots, tracks };
    fs.writeFileSync(
      path.join(dir, 'library-index.json'),
      JSON.stringify(index),
    );
    const first = open(dir);
    expect(first.wasReset).toBe(false);
    expect(exportLibraryIndex(first.store)).toEqual(index);
    expect(fs.existsSync(path.join(dir, 'library-index.json'))).toBe(false);
    expect(fs.existsSync(path.join(dir, 'library-index.migrated.json'))).toBe(
      true,
    );
    first.store.close();
    opened.pop();
    // A second open does not import again, and loses nothing.
    const second = open(dir);
    expect(exportLibraryIndex(second.store)).toEqual(index);
  });

  it('says so when the JSON it was to move in could not be read', () => {
    const dir = temp();
    fs.writeFileSync(path.join(dir, 'library-index.json'), '{ not json');
    const { store, wasReset } = open(dir);
    expect(wasReset).toBe(true);
    expect(store.trackCount()).toBe(0);
  });

  it('keeps a loudness measurement while the file is the one measured', () => {
    const { store } = open(temp());
    const measured = track({
      normalization: { version: 2, truePeakDbtp: -1, integratedLufs: -10 },
    });
    store.upsertTracks([measured], 0);
    // A rescan carries no measurement; same bytes, so it stays.
    const { normalization: _dropped, ...rescanned } = measured;
    store.upsertTracks([rescanned], 1);
    expect(store.track(measured.id)?.normalization).toEqual(
      measured.normalization,
    );
    // The file changed: the old measurement no longer describes it.
    store.upsertTracks(
      [{ ...rescanned, sizeBytes: rescanned.sizeBytes + 1 }],
      2,
    );
    expect(store.track(measured.id)?.normalization).toBeUndefined();
  });

  it('keeps a known track in the place the library learned it', () => {
    const { store } = open(temp());
    const [a, b, c] = [track(), track(), track()];
    store.upsertTracks([a, b, c], 0);
    store.upsertTracks([{ ...a, title: 'Renamed' }], 0);
    expect(exportLibraryIndex(store).tracks.map((entry) => entry.id)).toEqual([
      a.id,
      b.id,
      c.id,
    ]);
  });

  it('sweeps only what a finished scan did not confirm', () => {
    const { store } = open(temp());
    store.addRoots([root(), root({ id: 'r2', path: 'D:\\Other' })]);
    const unchanged = track();
    const changed = track();
    const gone = track();
    const elsewhere = track({ rootId: 'r2' });
    store.upsertTracks([unchanged, changed, gone, elsewhere], 0);
    const mark = store.beginScan();
    expect(mark).toBe(1);
    store.confirmTracks([unchanged.id], mark);
    store.upsertTracks([{ ...changed, title: 'New tags' }], mark);
    // Published by discovery, never confirmed by the parse: vanished between.
    const provisional = track({ isPending: true });
    store.upsertTracks([provisional], 0);
    const found = track();
    store.upsertTracks([found], mark);
    store.sweepRoot('r1', mark);
    const ids = exportLibraryIndex(store).tracks.map((entry) => entry.id);
    expect(ids).toEqual([unchanged.id, changed.id, elsewhere.id, found.id]);
    expect(store.rootTrackCount('r1')).toBe(3);
    expect(store.beginScan()).toBe(2);
  });

  it('does not un-confirm a confirmed track when discovery publishes it again', () => {
    const { store } = open(temp());
    store.addRoots([root()]);
    const song = track();
    store.upsertTracks([song], 0);
    const mark = store.beginScan();
    store.upsertTracks([song], mark);
    store.upsertTracks([{ ...song, isPending: true }], 0);
    store.sweepRoot('r1', mark);
    expect(store.track(song.id)).toBeDefined();
  });

  it('removes a root with every song under it and nothing else', () => {
    const { store } = open(temp());
    store.addRoots([root(), root({ id: 'r2', path: 'D:\\Other' })]);
    const kept = track({ rootId: 'r2', genre: 'Rock' });
    store.upsertTracks([track({ genre: 'Pop' }), kept], 0);
    store.removeRoot('r1');
    expect(store.roots().map((entry) => entry.id)).toEqual(['r2']);
    expect(exportLibraryIndex(store).tracks).toEqual([kept]);
    const genres = store.database
      .prepare('SELECT genre_id FROM track_genres')
      .all()
      .map((row) => row.genre_id);
    expect(genres).toEqual(['rock']);
  });

  it('files a track under each genre it names, once, and Unknown under none', () => {
    const { store } = open(temp());
    const many = track({ genre: 'Hip-Hop; hip hop;Rap' });
    const none = track();
    store.upsertTracks([many, none], 0);
    const rows = store.database
      .prepare(
        'SELECT track_id, genre_id, genre_name FROM track_genres ORDER BY track_id, genre_id',
      )
      .all();
    expect(rows).toEqual([
      { track_id: many.id, genre_id: 'hip hop', genre_name: 'Hip-Hop' },
      { track_id: many.id, genre_id: 'rap', genre_name: 'Rap' },
      { track_id: none.id, genre_id: '?unknown', genre_name: '' },
    ]);
  });

  it('stores a measurement only for an audio track still holding those bytes', () => {
    const { store } = open(temp());
    const song = track();
    const film = track({ kind: 'video' });
    store.upsertTracks([song, film], 0);
    const analysis = {
      version: 2 as const,
      truePeakDbtp: -2,
      integratedLufs: -12,
    };
    const updated = store.setNormalization(song.id, analysis, {
      sizeBytes: 5,
      mtimeMs: 6,
    });
    expect(updated).toEqual({
      ...song,
      sizeBytes: 5,
      mtimeMs: 6,
      normalization: analysis,
    });
    expect(
      store.setNormalization(film.id, analysis, { sizeBytes: 1, mtimeMs: 1 }),
    ).toBeUndefined();
    expect(
      store.setNormalization('nope', analysis, { sizeBytes: 1, mtimeMs: 1 }),
    ).toBeUndefined();
  });

  it('lets the scan read what it knows while main is still writing', () => {
    const dir = temp();
    const { store } = open(dir);
    const song = track();
    store.upsertTracks([song], 0);
    const reader = openLibraryReader(dir);
    try {
      expect(reader.trackByPath(song.path)).toEqual(song);
      const later = track();
      store.upsertTracks([later], 0);
      expect(reader.trackByPath(later.path)?.id).toBe(later.id);
      expect(reader.trackByPath('C:\\nowhere.mp3')).toBeUndefined();
    } finally {
      reader.close();
    }
  });

  it('starts again empty, and says so, when the file on disk is damaged', () => {
    const dir = temp();
    fs.writeFileSync(
      libraryStorePath(dir),
      'this is not a database, just text',
    );
    const { store, wasReset } = open(dir);
    expect(wasReset).toBe(true);
    expect(store.trackCount()).toBe(0);
    expect(fs.existsSync(`${libraryStorePath(dir)}.bak`)).toBe(true);
  });

  it('bumps its version on every write, so the window knows to ask again', () => {
    const { store } = open(temp());
    const before = store.version();
    store.upsertTracks([track()], 0);
    store.addRoots([root()]);
    store.setRoot('r1', { trackCount: 1 });
    expect(store.version()).toBe(before + 3);
  });
});
