/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * An album is its own songs once each, whichever folders hold more files of
 * them — on a small library laid out the way Ivan's "Why?" is
 * (2026-11-26): fourteen files in the record's folder, two of them again in
 * "!MY MUSIC", a folder of songs from everywhere, learned before the record.
 * Each rule stands beside a case it must leave alone.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { albumKey } from '../../../common/library/grouping';
import type {
  ILibraryListQuery,
  ILibraryPage,
  ILibraryTotals,
  TLibraryListItem,
  TLibraryRequest,
} from '../../../common/library/query';
import type { ILibraryTrack } from '../../../common/library/types';
import { createLibraryQueries } from '../../../main/library/libraryQuery';
import type { ILibraryStore } from '../../../main/library/libraryStore';
import {
  libraryStorePath,
  openLibraryStore,
} from '../../../main/library/libraryStoreOpen';

const ROOT = 'D:\\Music';
const MIXED = `${ROOT}\\!MY MUSIC`;
const RECORD = `${ROOT}\\[Pop]\\! Jacob Whitesides\\Why`;
const OTHER = `${ROOT}\\[Pop]\\Somebody\\Other`;

let made = 0;
const song = (
  folder: string,
  title: string,
  extra: Partial<ILibraryTrack> = {},
): ILibraryTrack => {
  made += 1;
  return {
    id: `t${String(made).padStart(3, '0')}`,
    rootId: 'r1',
    path: `${folder}\\${String(made).padStart(2, '0')} ${title}.mp3`,
    kind: 'audio',
    isPlayable: true,
    title,
    sizeBytes: 1000 + made,
    mtimeMs: 1700000000000,
    addedAt: made,
    ...extra,
  };
};

const why = (
  folder: string,
  title: string,
  trackNo: number,
  durationMs: number,
): ILibraryTrack =>
  song(folder, title, {
    artist: 'Jacob Whitesides',
    album: 'Why?',
    trackNo,
    durationMs,
  });

/**
 * Learned in this order, as the scan met them: "!MY MUSIC" sorts first, so
 * its two copies are the album's earliest songs.
 */
const buildLibrary = () => {
  made = 0;
  const copyFocus = why(MIXED, 'Focus', 1, 228153);
  const copyHeartbeat = why(MIXED, 'Heartbeat', 2, 151589);
  const strangers = [
    song(MIXED, 'Bloodstream', { artist: 'Ed Sheeran', album: 'x' }),
    song(MIXED, 'Cry Me a River', { artist: 'Justin Timberlake' }),
    song(MIXED, 'Bills, Bills, Bills', { album: '30 Stars' }),
    song(MIXED, 'Di Mi Nombre', { artist: 'Rosalía', album: 'El Mal Querer' }),
    song(MIXED, 'Beautiful To Me', { artist: 'Olly Murs', album: 'Never' }),
  ];
  // A take of a song the record has, of another length: a song of its own.
  const liveTake = why(MIXED, 'Levitate', 3, 301000);
  const focus = why(RECORD, 'Focus', 1, 228153);
  // Re-tagged with a cover: a bigger file, the same recording.
  const heartbeat = why(RECORD, 'Heartbeat', 2, 151589);
  heartbeat.sizeBytes += 250_000;
  const levitate = why(RECORD, 'Levitate', 3, 199000);
  const openBook = why(RECORD, 'Open Book', 13, 210000);
  // In the record's folder without being on it: the folder's, never the
  // album's, and it gives the record's folder a share under one.
  const bonus = song(RECORD, 'Why? (Acoustic)', {
    artist: 'Jacob Whitesides',
    album: 'Why? Bonus',
    durationMs: 180000,
  });
  // Untagged files sharing one key are a bucket, not a record: never copies.
  const looseA = song(OTHER, 'Untitled', { durationMs: 100000 });
  const looseB = song(MIXED, 'Untitled', { durationMs: 100000 });
  return {
    tracks: [
      copyFocus,
      copyHeartbeat,
      ...strangers,
      liveTake,
      focus,
      heartbeat,
      levitate,
      openBook,
      bonus,
      looseA,
      looseB,
    ],
    copyFocus,
    copyHeartbeat,
    strangers,
    liveTake,
    focus,
    heartbeat,
    levitate,
    openBook,
    bonus,
    looseA,
    looseB,
  };
};

const ALBUM = albumKey({ album: 'Why?', artist: 'Jacob Whitesides' });

const opened: ILibraryStore[] = [];
const freshDir = () =>
  fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-copies-'));

const openWith = (dir: string, tracks: readonly ILibraryTrack[]) => {
  const { store } = openLibraryStore(dir);
  opened.push(store);
  store.addRoots([
    { id: 'r1', path: ROOT, addedAt: 1, trackCount: 0, karaokeSkipped: 0 },
  ]);
  store.upsertTracks(tracks, 0);
  return store;
};

afterEach(() => {
  opened.splice(0).forEach((store) => store.close());
});

const asker = (store: ILibraryStore) => {
  const { answer } = createLibraryQueries(store);
  return (request: TLibraryRequest) => answer(request);
};

const listOf = (
  ask: (request: TLibraryRequest) => unknown,
  query: ILibraryListQuery,
): TLibraryListItem[] =>
  (ask({ type: 'page', query, offset: 0, limit: 500 }) as ILibraryPage).items;

const albumPage = (ask: (request: TLibraryRequest) => unknown) =>
  listOf(ask, {
    shelf: 'tracks',
    scope: { album: ALBUM },
    natural: 'disc',
    direction: 'asc',
  }).flatMap((item) => (item.kind === 'track' ? [item.track.id] : []));

describe('an album with copies of its songs in a folder of everything', () => {
  it('lists each of its songs once, the file in its own folder standing for it', () => {
    const library = buildLibrary();
    const ask = asker(openWith(freshDir(), library.tracks));
    expect(albumPage(ask)).toEqual([
      library.focus.id,
      library.heartbeat.id,
      // Track 3 twice: a live take of another length is a song of its own,
      // and the take learned first stands first.
      library.liveTake.id,
      library.levitate.id,
      library.openBook.id,
    ]);
  });

  it('counts, sums and places the album without its copies', () => {
    const library = buildLibrary();
    const ask = asker(openWith(freshDir(), library.tracks));
    const own = [
      library.focus,
      library.heartbeat,
      library.liveTake,
      library.levitate,
      library.openBook,
    ];
    const [album] = listOf(ask, {
      shelf: 'albums',
      scope: { album: ALBUM },
      direction: 'asc',
    });
    expect(album?.kind === 'album' && album.trackCount).toBe(own.length);
    const totals = ask({
      type: 'totals',
      query: { shelf: 'tracks', scope: { album: ALBUM }, direction: 'asc' },
    }) as ILibraryTotals;
    expect(totals).toEqual({
      count: own.length,
      durationMs: own.reduce((sum, track) => sum + (track.durationMs ?? 0), 0),
    });
    // The live take keeps "!MY MUSIC" among the album's folders: it is a
    // song of its own on the record. Its copies alone would not.
    const folders = listOf(ask, {
      shelf: 'folders',
      scope: { album: ALBUM },
      direction: 'asc',
    }).map((item) => (item.kind === 'folder' ? item.id : ''));
    expect(folders.sort()).toEqual(
      ['D:/Music/!MY MUSIC', 'D:/Music/[Pop]/! Jacob Whitesides/Why'].sort(),
    );
  });

  it('keeps the copies where the files are: their folder and the Songs shelf', () => {
    const library = buildLibrary();
    const ask = asker(openWith(freshDir(), library.tracks));
    const inMixed = listOf(ask, {
      shelf: 'tracks',
      scope: { folder: 'D:/Music/!MY MUSIC' },
      natural: 'path',
      direction: 'asc',
    }).map((item) => (item.kind === 'track' ? item.track.id : ''));
    expect(inMixed).toContain(library.copyFocus.id);
    expect(inMixed).toContain(library.copyHeartbeat.id);
    const everything = ask({
      type: 'totals',
      query: { shelf: 'tracks', scope: {}, direction: 'asc' },
    }) as ILibraryTotals;
    expect(everything.count).toBe(library.tracks.length);
  });

  it('lets the first learned copy stand when two folders hold the album alike', () => {
    made = 200;
    const first = why(OTHER, 'Focus', 1, 228153);
    const second = why(RECORD, 'Focus', 1, 228153);
    const ask = asker(openWith(freshDir(), [first, second]));
    expect(albumPage(ask)).toEqual([first.id]);
  });

  it('never takes two songs under one watermark title for copies, however close their lengths', () => {
    made = 500;
    const chart = (length: number) =>
      song(MIXED, 'EJE RECORDS [53639408]', {
        artist: 'Selena Gomez',
        album: 'Rare',
        durationMs: length,
      });
    const rare = chart(220630);
    const lookAtHerNow = chart(220761);
    const ask = asker(openWith(freshDir(), [rare, lookAtHerNow]));
    const albumOfThem = albumKey({ album: 'Rare', artist: 'Selena Gomez' });
    const ids = listOf(ask, {
      shelf: 'tracks',
      scope: { album: albumOfThem },
      natural: 'disc',
      direction: 'asc',
    }).map((item) => (item.kind === 'track' ? item.track.id : ''));
    expect(ids).toEqual([rare.id, lookAtHerNow.id]);
  });

  it('lists a second file in the record folder itself once, and the folder both', () => {
    made = 400;
    const focus = why(RECORD, 'Focus', 1, 228153);
    const again = why(RECORD, 'Focus', 1, 228153);
    const ask = asker(openWith(freshDir(), [focus, again]));
    expect(albumPage(ask)).toEqual([focus.id]);
    const inFolder = listOf(ask, {
      shelf: 'tracks',
      scope: { folder: 'D:/Music/[Pop]/! Jacob Whitesides/Why' },
      natural: 'path',
      direction: 'asc',
    }).map((item) => (item.kind === 'track' ? item.track.id : ''));
    expect(inFolder).toEqual([focus.id, again.id]);
  });

  it('moves which copy stands when other records fill its folder', () => {
    made = 300;
    const first = why(OTHER, 'Focus', 1, 228153);
    const second = why(RECORD, 'Focus', 1, 228153);
    const store = openWith(freshDir(), [first, second]);
    const ask = asker(store);
    const standing = () => albumPage(ask);
    expect(standing()).toEqual([first.id]);
    // Songs of another record only: the album itself is not written to.
    store.upsertTracks(
      [song(OTHER, 'Stranger', { artist: 'Somebody', album: 'Else' })],
      0,
    );
    expect(standing()).toEqual([second.id]);
  });

  it('lets a copy stand for its song once the file in the record folder is gone', () => {
    const library = buildLibrary();
    const store = openWith(freshDir(), library.tracks);
    const ask = asker(store);
    const mark = store.beginScan();
    store.confirmTracks(
      library.tracks
        .filter((track) => track.id !== library.focus.id)
        .map((track) => track.id),
      mark,
    );
    store.sweepRoot('r1', mark);
    const own = albumPage(ask);
    expect(own).toContain(library.copyFocus.id);
    expect(own).not.toContain(library.copyHeartbeat.id);
  });

  it('takes no mark along when a copy loses its album tag', () => {
    const library = buildLibrary();
    const store = openWith(freshDir(), library.tracks);
    const ask = asker(store);
    const { album: dropped, ...untagged } = library.copyFocus;
    expect(dropped).toBe('Why?');
    store.upsertTracks([untagged], 0);
    const bucket = albumKey({ artist: 'Jacob Whitesides' });
    const ids = listOf(ask, {
      shelf: 'tracks',
      scope: { album: bucket },
      natural: 'disc',
      direction: 'asc',
    }).map((item) => (item.kind === 'track' ? item.track.id : ''));
    expect(ids).toEqual([library.copyFocus.id]);
  });

  it('does not treat untagged files of one title as copies of each other', () => {
    const library = buildLibrary();
    const ask = asker(openWith(freshDir(), library.tracks));
    const bucket = albumKey({});
    const ids = listOf(ask, {
      shelf: 'tracks',
      scope: { album: bucket },
      natural: 'disc',
      direction: 'asc',
    }).map((item) => (item.kind === 'track' ? item.track.id : ''));
    expect(ids).toContain(library.looseA.id);
    expect(ids).toContain(library.looseB.id);
  });
});

describe('a library stored by the build before copies were known', () => {
  it('is moved once: copies marked, summaries recounted, plays kept', () => {
    const library = buildLibrary();
    const dir = freshDir();
    const store = openWith(dir, library.tracks);
    expect(store.notePlayed(library.copyFocus.id, 5)).toBe(true);
    store.close();
    opened.splice(0);
    // What build 3 left on disk: no column, and the album counted with its
    // copies.
    const raw = new DatabaseSync(libraryStorePath(dir));
    raw.exec('ALTER TABLE tracks DROP COLUMN album_copy');
    raw.exec("UPDATE meta SET value = '3' WHERE key = 'schema'");
    raw
      .prepare('UPDATE album_groups SET track_count = 7 WHERE id = ?')
      .run(ALBUM);
    raw.close();

    const { store: reopened } = openLibraryStore(dir);
    opened.push(reopened);
    const ask = asker(reopened);
    const [album] = listOf(ask, {
      shelf: 'albums',
      scope: { album: ALBUM },
      direction: 'asc',
    });
    expect(album?.kind === 'album' && album.trackCount).toBe(5);
    expect(albumPage(ask)).not.toContain(library.copyFocus.id);
    const played = listOf(ask, {
      shelf: 'tracks',
      scope: { ids: [library.copyFocus.id] },
      natural: 'ids',
      direction: 'asc',
    })[0];
    expect(played?.kind === 'track' && played.track.playCount).toBe(1);
    expect(reopened.trackCount()).toBe(library.tracks.length);
  });
});
