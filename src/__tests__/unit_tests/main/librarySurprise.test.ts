/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Surprise me, as the store answers it (`surprise` in
 * `libraryTrackQuestions.ts`), on a library small enough to know by heart:
 * a big genre, a genre of one song, untagged songs with and without an
 * artist, and the songs that must never come up — a video, a file this build
 * cannot play, a song on an unplugged drive.
 *
 * SQLite draws with its own `random()`, so each rule is held over many draws,
 * each beside a control the rule's absence would fail.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import type { TLibraryRequest } from '../../../common/library/query';
import type { ILibraryTrack } from '../../../common/library/types';
import { createLibraryQueries } from '../../../main/library/libraryQuery';
import type { ILibraryStore } from '../../../main/library/libraryStore';
import { openLibraryStore } from '../../../main/library/libraryStoreOpen';

let seq = 0;
const song = (
  id: string,
  genre: string | undefined,
  artist: string | undefined,
  extra: Partial<ILibraryTrack> = {},
): ILibraryTrack => {
  seq += 1;
  return {
    id,
    rootId: 'r1',
    path: `C:\\Music\\${id}.mp3`,
    kind: 'audio',
    isPlayable: true,
    title: id,
    sizeBytes: 1000 + seq,
    mtimeMs: 1700000000000 + seq,
    addedAt: seq,
    ...(genre === undefined ? {} : { genre }),
    ...(artist === undefined ? {} : { artist }),
    ...extra,
  };
};

const ROCK = ['rock1', 'rock2', 'rock3', 'rock4', 'rock5', 'rock6', 'rock7'];
const SALSA = ['salsa1', 'salsa2', 'salsa3', 'salsa4'];
const LOFI = ['lofi1', 'lofi2', 'lofi3'];
const MYSTERY = ['mystery1', 'mystery2'];
/** Never a surprise while anything else is left. */
const NEVER = ['video', 'broken', 'unplugged', 'nameless'];

const LIBRARY: ILibraryTrack[] = [
  ...ROCK.map((id) => song(id, 'Rock', 'The Hollow Pines')),
  ...SALSA.map((id) => song(id, 'Salsa', 'Orquesta Brisa')),
  ...LOFI.map((id) => song(id, 'Lo-fi', 'mellowtape')),
  // The genre of one song.
  song('jazz1', 'Jazz', 'Iris Vale Trio'),
  // Two genres: moving away from Rock must move away from this one too.
  song('both', 'Rock; Pop', 'Kestrel Run'),
  // Untagged, with an artist Keep playing can carry on from.
  ...MYSTERY.map((id) => song(id, undefined, 'Mystery Artist')),
  // Untagged and anonymous: nothing could follow it.
  song('nameless', undefined, undefined),
  song('video', 'Jazz', 'Iris Vale Trio', { kind: 'video' }),
  song('broken', 'Jazz', 'Iris Vale Trio', { isPlayable: false }),
  song('unplugged', 'Jazz', 'Iris Vale Trio', {
    rootId: 'r2',
    path: 'E:\\Music\\unplugged.mp3',
  }),
];
const byId = new Map(LIBRARY.map((track) => [track.id, track]));

const openStore = (
  tracks: readonly ILibraryTrack[],
): {
  store: ILibraryStore;
  ask: (request: TLibraryRequest) => unknown;
} => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-surprise-'));
  const { store } = openLibraryStore(dir);
  store.addRoots([
    {
      id: 'r1',
      path: 'C:\\Music',
      addedAt: 1,
      trackCount: 0,
      karaokeSkipped: 0,
    },
    {
      id: 'r2',
      path: 'E:\\Music',
      addedAt: 2,
      trackCount: 0,
      karaokeSkipped: 0,
      isOffline: true,
    },
  ]);
  store.upsertTracks(tracks, 0);
  const { answer } = createLibraryQueries(store);
  return { store, ask: answer };
};

let library: ReturnType<typeof openStore>;
beforeAll(() => {
  library = openStore(LIBRARY);
});
afterAll(() => library.store.close());

const surprise = (
  ask: (request: TLibraryRequest) => unknown,
  options: { playing?: string; awayFrom?: string[]; exclude?: string[] },
): string | null =>
  ask({
    type: 'surprise',
    ...(options.playing === undefined ? {} : { playing: options.playing }),
    awayFrom: options.awayFrom ?? [],
    exclude: options.exclude ?? [],
  }) as string | null;

const draws = (
  times: number,
  options: { playing?: string; awayFrom?: string[]; exclude?: string[] },
): string[] =>
  Array.from({ length: times }, () => {
    const picked = surprise(library.ask, options);
    if (picked === null) {
      throw new Error('the library has songs; a surprise must answer');
    }
    return picked;
  });

const genreOf = (id: string) => byId.get(id)?.genre ?? '';

describe('Surprise me, from the store', () => {
  it('moves away from the playing song’s genre while another genre has a song', () => {
    const picked = draws(80, { playing: 'rock1', awayFrom: ['rock1'] });
    expect(picked.filter((id) => genreOf(id).includes('Rock'))).toEqual([]);
    // The control: with nothing to move away from, Rock comes up.
    expect(draws(80, {}).some((id) => genreOf(id).includes('Rock'))).toBe(true);
  });

  it('moves away from the last surprises’ genres as well', () => {
    const picked = draws(80, {
      playing: 'rock1',
      awayFrom: ['rock1', 'salsa1'],
    });
    expect(picked.filter((id) => /Rock|Salsa/.test(genreOf(id)))).toEqual([]);
    expect(new Set(picked.map(genreOf)).size).toBeGreaterThan(1);
  });

  it('draws a genre first, so a genre of one song gets its turn', () => {
    // Five genres can be drawn — Rock, Salsa, Lo-fi, Jazz, Pop — and the
    // untagged songs with an artist as a sixth. Drawn by genre, the one jazz
    // song comes up about one time in six (67 of 400); drawn from every song
    // alike it would be one in eighteen (22 of 400). 36 sits four standard
    // deviations under the first and three over the second.
    const picked = draws(400, {});
    const jazz = picked.filter((id) => id === 'jazz1').length;
    expect(jazz).toBeGreaterThan(36);
  });

  it('never hands back a video, an unplayable file, a song on an unplugged drive or one nothing could follow', () => {
    const picked = draws(300, {});
    expect(picked.filter((id) => NEVER.includes(id))).toEqual([]);
    expect(picked.filter((id) => MYSTERY.includes(id)).length).toBeGreaterThan(
      0,
    );
  });

  it('gives a genre-less song with an artist the unknown genre’s turn', () => {
    const tagged = ['rock1', 'salsa1', 'lofi1', 'jazz1', 'both'];
    const picked = draws(40, { playing: 'rock1', awayFrom: tagged });
    expect(picked.filter((id) => !MYSTERY.includes(id))).toEqual([]);
  });

  it('skips what was heard while anything else is left, and only then takes it back', () => {
    const playable = [...ROCK, ...SALSA, ...LOFI, 'jazz1', 'both', ...MYSTERY];
    const heard = playable.filter((id) => id !== 'salsa3');
    expect(draws(20, { playing: 'rock1', exclude: heard })).toEqual(
      Array(20).fill('salsa3'),
    );
    // Every song something could follow heard: one not heard comes before
    // any that was, even one nothing could follow.
    expect(draws(20, { playing: 'rock1', exclude: playable })).toEqual(
      Array(20).fill('nameless'),
    );
    // Everything heard: the store goes back over it rather than answer
    // nothing, and still never the song playing, a video, a broken file or
    // an unplugged drive.
    const again = draws(60, {
      playing: 'rock1',
      exclude: [...playable, 'nameless'],
    });
    expect(again).not.toContain('rock1');
    expect(
      again.filter((id) => ['video', 'broken', 'unplugged'].includes(id)),
    ).toEqual([]);
    expect(new Set(again).size).toBeGreaterThan(3);
  });

  it('deals the draw a deck of different covers, from songs, none excluded', () => {
    const deck = openStore([
      song('a1', 'Rock', 'A', { artId: 'aaa111' }),
      song('a2', 'Rock', 'A', { artId: 'aaa111' }),
      song('a3', 'Rock', 'A', { artId: 'aaa111' }),
      song('b1', 'Jazz', 'B', { artId: 'bbb222' }),
      song('c1', 'Pop', 'C', { artId: 'ccc333' }),
      song('film', 'Pop', 'C', { artId: 'ddd444', kind: 'video' }),
      song('bare', 'Pop', 'C'),
    ]);
    try {
      const all = deck.ask({ type: 'coverDeck', count: 10, exclude: [] });
      expect([...(all as string[])].sort()).toEqual([
        'aaa111',
        'bbb222',
        'ccc333',
      ]);
      expect(
        deck.ask({ type: 'coverDeck', count: 10, exclude: ['bbb222'] }),
      ).not.toContain('bbb222');
      expect(
        deck.ask({ type: 'coverDeck', count: 2, exclude: [] }),
      ).toHaveLength(2);
      expect(deck.ask({ type: 'coverDeck', count: 0, exclude: [] })).toEqual(
        [],
      );
    } finally {
      deck.store.close();
    }
  });

  it('never hands back the song playing while another song exists', () => {
    // Same genre, nothing heard: only the song playing stands between them.
    const pair = openStore([
      song('on', 'Rock', 'Solo'),
      song('other', 'Rock', 'Solo'),
    ]);
    try {
      const picked = Array.from({ length: 30 }, () =>
        surprise(pair.ask, { playing: 'on', awayFrom: ['on'] }),
      );
      expect(picked).toEqual(Array(30).fill('other'));
    } finally {
      pair.store.close();
    }
  });

  it('starts the one song again in a library of one, and answers nothing with nothing to play', () => {
    const alone = openStore([song('only', 'Rock', 'Solo')]);
    try {
      expect(surprise(alone.ask, { playing: 'only', awayFrom: ['only'] })).toBe(
        'only',
      );
    } finally {
      alone.store.close();
    }
    const silent = openStore([
      song('film', 'Rock', 'Solo', { kind: 'video' }),
      song('broken2', 'Rock', 'Solo', { isPlayable: false }),
    ]);
    try {
      expect(surprise(silent.ask, {})).toBeNull();
    } finally {
      silent.store.close();
    }
  });
});
