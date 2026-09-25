/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The store's answers against the window's own rules, on the same tracks.
 *
 * Every grouping, order and search the Library draws was a TypeScript
 * function over the whole library; they are SQL now (`libraryQueryPlan.ts`).
 * These run both on one generated library and hold them to each other. An
 * order is compared by its keys, not its ids: two names that fold the same
 * may stand either way round (see `sortKey`), and nothing else may differ.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { groupIntoGenres, sortGenres } from '../../../common/library/genres';
import {
  albumKey,
  artistKey,
  folderChildren,
  groupIntoAlbums,
  groupIntoArtists,
  groupIntoFolders,
  normalizeForSearch,
  rootFolders,
  searchTracks,
  sortAlbums,
  sortArtists,
  sortFolders,
  sortTracks,
  trackFolderPath,
} from '../../../common/library/grouping';
import type {
  ILibraryListQuery,
  ILibraryPage,
  TLibraryListItem,
  TLibraryRequest,
} from '../../../common/library/query';
import type {
  ILibraryTrack,
  TLibrarySort,
  TLibrarySortDirection,
} from '../../../common/library/types';
import { createLibraryQueries } from '../../../main/library/libraryQuery';
import type { ILibraryStore } from '../../../main/library/libraryStore';
import { openLibraryStore } from '../../../main/library/libraryStoreOpen';

/** A fixed pseudo-random draw, so a failure reproduces. */
const lcg = (seed: number) => {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
};

const pick = <T>(random: () => number, values: readonly T[]): T =>
  values[Math.floor(random() * values.length)];

const ARTISTS = [
  "N'Sync",
  '*NSYNC',
  'Nsync',
  'Queen',
  'queen',
  'Björk',
  'Bjork',
  'Miles Davis',
  'Leo Dan',
  '',
];
const ALBUMS = [
  'Celebrity',
  'celebrity',
  'Kind of Blue',
  'Début',
  'Debut',
  'News of the World',
  'Leones',
  '',
];
const GENRES = ['Pop', 'pop', 'Hip-Hop', 'Rock; Pop', 'Jazz', '', 'Trova'];
const FOLDERS = [
  'C:\\Music\\Pop\\NSYNC\\Celebrity',
  'C:\\Music\\Pop\\NSYNC',
  'C:\\Music\\Rock\\Queen',
  'C:\\Music\\Jazz',
  'C:\\Music\\Pop\\Björk\\Début',
  'D:\\More\\Live',
];
const WORDS = [
  'Leo',
  'Dance',
  'Girlfriend',
  'Gone',
  'Bye Bye Bye',
  'Blue',
  'leones',
  'Élan',
  'elan',
  'Zebra',
  'Pop',
];

const generate = (count: number): ILibraryTrack[] => {
  const random = lcg(7);
  return Array.from({ length: count }, (_, at) => {
    const folder = pick(random, FOLDERS);
    const artist = pick(random, ARTISTS);
    const album = pick(random, ALBUMS);
    const genre = pick(random, GENRES);
    const track: ILibraryTrack = {
      id: `id${String(at).padStart(4, '0')}`,
      rootId: folder.startsWith('D:') ? 'r2' : 'r1',
      path: `${folder}\\${String(at).padStart(3, '0')} ${pick(random, WORDS)}.mp3`,
      kind: random() < 0.08 ? 'video' : 'audio',
      isPlayable: random() > 0.05,
      title: `${pick(random, WORDS)} ${at}`,
      sizeBytes: 1000 + at,
      mtimeMs: 1700000000000 + at,
      addedAt: Math.floor(random() * 50),
    };
    if (artist !== '') {
      track.artist = artist;
    }
    if (random() < 0.2) {
      track.albumArtist = pick(random, ARTISTS.filter(Boolean));
    }
    if (album !== '') {
      track.album = album;
    }
    if (genre !== '') {
      track.genre = genre;
    }
    // Unique within the library, so "the first track of an album" never
    // depends on how two identical disc/track numbers tie.
    track.discNo = 1 + (at % 2);
    track.trackNo = at;
    if (random() < 0.5) {
      track.year = 1990 + Math.floor(random() * 20);
    }
    if (random() < 0.5) {
      track.artId = `art${at}`;
    }
    if (random() < 0.3) {
      track.durationMs = 100000 + at;
    }
    if (random() < 0.1) {
      track.isPending = true;
    }
    return track;
  });
};

const TRACKS = generate(360);
const ROOTS = [
  { id: 'r1', path: 'C:\\Music', addedAt: 1, trackCount: 0, karaokeSkipped: 0 },
  { id: 'r2', path: 'D:\\More', addedAt: 2, trackCount: 0, karaokeSkipped: 0 },
];

let store: ILibraryStore;
let ask: (request: TLibraryRequest) => unknown;

beforeAll(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-query-'));
  ({ store } = openLibraryStore(dir));
  store.addRoots(ROOTS);
  store.upsertTracks(TRACKS, 0);
  ({ answer: ask } = createLibraryQueries(store));
});

afterAll(() => store.close());

/** The whole list, a page at a time, and the page's own total checked. */
const all = (query: ILibraryListQuery, pageSize = 37): TLibraryListItem[] => {
  const first = ask({
    type: 'page',
    query,
    offset: 0,
    limit: pageSize,
  }) as ILibraryPage;
  const items = [...first.items];
  for (let offset = pageSize; offset < first.total; offset += pageSize) {
    const next = ask({
      type: 'page',
      query,
      offset,
      limit: pageSize,
    }) as ILibraryPage;
    expect(next.total).toBe(first.total);
    items.push(...next.items);
  }
  expect(items.length).toBe(first.total);
  return items;
};

const trackIdsOf = (items: TLibraryListItem[]): string[] =>
  items.flatMap((item) => (item.kind === 'track' ? [item.track.id] : []));

const byId = new Map(TRACKS.map((track) => [track.id, track]));

const SORTS: TLibrarySort[] = [
  'title',
  'artist',
  'album',
  'year',
  'added',
  'track',
];
const DIRECTIONS: TLibrarySortDirection[] = ['asc', 'desc'];

/** A track's sort key under one sort, as `sortTracks` compares it. */
const trackKey = (track: ILibraryTrack, sort: TLibrarySort): string => {
  const fold = (value: string | undefined) => normalizeForSearch(value ?? '');
  switch (sort) {
    case 'artist':
      return `${fold(track.artist)}|${fold(track.title)}`;
    case 'album':
      return `${fold(track.album)}|${fold(track.title)}`;
    case 'year':
      return String(track.year ?? 0);
    case 'added':
      return String(track.addedAt);
    case 'track':
      return `${fold(track.album)}|${track.discNo ?? 1}|${track.trackNo ?? 0}`;
    default:
      return fold(track.title);
  }
};

/**
 * `sortTracks` as the store reads it (`sortKey`): every name compared
 * folded, so two that fold the same are one name and the next key decides.
 * `sortTracks` itself told "Queen" from "queen" at `localeCompare`'s full
 * strength and never reached the title between them.
 */
const folded = (value: string | undefined) => normalizeForSearch(value ?? '');
const compareText = (left: string, right: string): number => {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
};
const referenceSortTracks = (
  tracks: readonly ILibraryTrack[],
  sort: TLibrarySort,
  direction: TLibrarySortDirection,
): ILibraryTrack[] => {
  const byTitle = (left: ILibraryTrack, right: ILibraryTrack) =>
    compareText(folded(left.title), folded(right.title));
  const compare = (left: ILibraryTrack, right: ILibraryTrack): number => {
    if (sort === 'artist') {
      return (
        compareText(folded(left.artist), folded(right.artist)) ||
        byTitle(left, right)
      );
    }
    if (sort === 'album') {
      return (
        compareText(folded(left.album), folded(right.album)) ||
        byTitle(left, right)
      );
    }
    if (sort === 'track') {
      return (
        compareText(folded(left.album), folded(right.album)) ||
        (left.discNo ?? 1) - (right.discNo ?? 1) ||
        (left.trackNo ?? 0) - (right.trackNo ?? 0) ||
        byTitle(left, right)
      );
    }
    return sortTracks([left, right], sort)[0] === left ? -1 : 1;
  };
  const sorted =
    sort === 'artist' || sort === 'album' || sort === 'track'
      ? [...tracks].sort(compare)
      : sortTracks(tracks, sort);
  return direction === 'desc' ? sorted.reverse() : sorted;
};

describe('the song shelf', () => {
  it.each(
    SORTS.flatMap((sort) =>
      DIRECTIONS.map((direction) => [sort, direction] as const),
    ),
  )(
    'orders by %s %s as sortTracks does, names compared folded',
    (sort, direction) => {
      const ids = trackIdsOf(
        all({ shelf: 'tracks', scope: {}, sort, direction }),
      );
      const expected = referenceSortTracks(TRACKS, sort, direction);
      expect(
        ids.map((id) => trackKey(byId.get(id) as ILibraryTrack, sort)),
      ).toEqual(expected.map((track) => trackKey(track, sort)));
    },
  );

  it('ranks a search exactly as searchTracks does', () => {
    ['leo', 'nsync', 'blue', 'ELAN', "n'sync", 'pop', 'zz'].forEach(
      (search) => {
        const ids = trackIdsOf(
          all({ shelf: 'tracks', scope: {}, search, direction: 'asc' }),
        );
        expect(ids).toEqual(
          searchTracks(TRACKS, search).map((track) => track.id),
        );
      },
    );
  });

  it('narrows to the folder the reader stands in, and only it', () => {
    const beneath = 'C:/Music/Pop';
    const ids = trackIdsOf(
      all({ shelf: 'tracks', scope: { beneath }, direction: 'asc' }),
    );
    expect(ids).toEqual(
      TRACKS.filter((track) => {
        const folder = trackFolderPath(track.path);
        return folder === beneath || folder.startsWith(`${beneath}/`);
      }).map((track) => track.id),
    );
  });

  it('puts what matches in the folder first, then everything else, and says where the one stops', () => {
    const query: ILibraryListQuery = {
      shelf: 'tracks',
      scope: { beneath: 'C:/Music/Pop' },
      search: 'leo',
      near: 'C:/Music/Pop',
      direction: 'asc',
    };
    const first = ask({
      type: 'page',
      query,
      offset: 0,
      limit: 500,
    }) as ILibraryPage;
    const ranked = searchTracks(TRACKS, 'leo');
    const inside = ranked.filter((track) =>
      trackFolderPath(track.path).startsWith('C:/Music/Pop'),
    );
    const outside = ranked.filter((track) => !inside.includes(track));
    expect(trackIdsOf(first.items)).toEqual(
      [...inside, ...outside].map((track) => track.id),
    );
    expect(first.nearCount).toBe(inside.length);
    expect(
      first.items
        .slice(0, inside.length)
        .every((item) => item.kind === 'track' && item.near),
    ).toBe(true);
  });

  it('draws a folder heading over each run, counted into the rows', () => {
    const query: ILibraryListQuery = {
      shelf: 'tracks',
      scope: {},
      sort: 'title',
      direction: 'asc',
      folderHeadings: true,
    };
    const rows = all(query, 11);
    const sorted = trackIdsOf(rows).map((id) => byId.get(id) as ILibraryTrack);
    const expected: string[] = [];
    sorted.forEach((track, at) => {
      const folder = trackFolderPath(track.path);
      if (at === 0 || trackFolderPath(sorted[at - 1].path) !== folder) {
        expected.push(`# ${folder}`);
      }
      expected.push(track.id);
    });
    const label = (item: (typeof rows)[number]) => {
      if (item.kind === 'heading') {
        return `# ${item.folder}`;
      }
      return item.kind === 'track' ? item.track.id : '?';
    };
    expect(rows.map(label)).toEqual(expected);
    // A track's position is its row, headings included.
    const probe = sorted[40];
    expect(ask({ type: 'position', query, id: probe.id })).toBe(
      expected.indexOf(probe.id),
    );
  });
});

type TGroupItem = Exclude<
  TLibraryListItem,
  { kind: 'track' } | { kind: 'heading' }
>;

const groupFields = (items: TLibraryListItem[]): Omit<TGroupItem, 'near'>[] =>
  items.map((item) => {
    if (item.kind === 'track' || item.kind === 'heading') {
      throw new Error('a group was expected');
    }
    const { near: _near, ...rest } = item;
    return rest;
  });

describe('the album shelf', () => {
  it('is groupIntoAlbums, field for field', () => {
    const items = all({
      shelf: 'albums',
      scope: {},
      sort: 'title',
      direction: 'asc',
    });
    const albums = groupIntoAlbums(TRACKS);
    const expected = new Map(
      albums.map((album) => [
        album.id,
        {
          kind: 'album',
          id: album.id,
          title: album.title,
          artist: album.artist,
          ...(album.year === undefined ? {} : { year: album.year }),
          ...(album.artId === undefined ? {} : { artId: album.artId }),
          trackCount: album.trackIds.length,
          durationMs: album.durationMs,
          addedAt: album.addedAt,
          isPending: album.isPending,
        },
      ]),
    );
    const got = groupFields(items);
    expect(got.length).toBe(albums.length);
    got.forEach((item) => expect(item).toEqual(expected.get(item.id)));
  });

  it.each(['title', 'artist', 'year', 'added'] as TLibrarySort[])(
    'orders by %s as sortAlbums does',
    (sort) => {
      DIRECTIONS.forEach((direction) => {
        const items = all({ shelf: 'albums', scope: {}, sort, direction });
        const key = (album: {
          title: string;
          artist: string;
          year?: number;
          addedAt: number;
        }) => {
          if (sort === 'artist') {
            return `${normalizeForSearch(album.artist)}|${normalizeForSearch(album.title)}`;
          }
          if (sort === 'year') {
            return String(album.year ?? 0);
          }
          if (sort === 'added') {
            return String(album.addedAt);
          }
          return normalizeForSearch(album.title);
        };
        // Folded names are one name (`sortKey`), so the artist order is the
        // artist, then the title, compared folded.
        const expected =
          sort === 'artist'
            ? (() => {
                const sorted = [...groupIntoAlbums(TRACKS)].sort(
                  (left, right) =>
                    compareText(folded(left.artist), folded(right.artist)) ||
                    compareText(folded(left.title), folded(right.title)),
                );
                return direction === 'desc' ? sorted.reverse() : sorted;
              })()
            : sortAlbums(groupIntoAlbums(TRACKS), sort, direction);
        expect(items.map((item) => key(item as never))).toEqual(
          expected.map(key),
        );
      });
    },
  );

  it('lists every album with a match, whole', () => {
    const items = all({
      shelf: 'albums',
      scope: {},
      search: 'nsync',
      direction: 'asc',
    });
    const hit = new Set(searchTracks(TRACKS, 'nsync').map(albumKey));
    const whole = groupIntoAlbums(
      TRACKS.filter((track) => hit.has(albumKey(track))),
    );
    expect(new Set(items.map((item) => (item as { id: string }).id))).toEqual(
      new Set(whole.map((album) => album.id)),
    );
    items.forEach((item) => {
      const album = whole.find(
        (entry) => entry.id === (item as { id: string }).id,
      );
      expect((item as { trackCount: number }).trackCount).toBe(
        album?.trackIds.length,
      );
    });
  });
});

describe('the artist and genre shelves', () => {
  it('is groupIntoArtists, and sortArtists orders it', () => {
    const artists = groupIntoArtists(TRACKS);
    const items = groupFields(
      all({ shelf: 'artists', scope: {}, sort: 'title', direction: 'asc' }),
    );
    expect(items.length).toBe(artists.length);
    items.forEach((item) => {
      const artist = artists.find((entry) => entry.id === item.id);
      expect(item).toEqual({
        kind: 'artist',
        id: artist?.id,
        name: artist?.name,
        albumCount: artist?.albumCount,
        trackCount: artist?.trackCount,
        addedAt: artist?.addedAt,
        isPending: artist?.isPending,
        ...(artist?.artId === undefined ? {} : { artId: artist.artId }),
      });
    });
    (['added', 'year', 'title'] as TLibrarySort[]).forEach((sort) => {
      const key = (entry: {
        name: string;
        addedAt: number;
        trackCount: number;
      }) => {
        if (sort === 'added') {
          return String(entry.addedAt);
        }
        if (sort === 'year') {
          return String(entry.trackCount);
        }
        return normalizeForSearch(entry.name);
      };
      expect(
        all({ shelf: 'artists', scope: {}, sort, direction: 'asc' }).map(
          (item) => key(item as never),
        ),
      ).toEqual(sortArtists(artists, sort).map(key));
    });
  });

  it('is groupIntoGenres, and sortGenres orders it', () => {
    const genres = groupIntoGenres(TRACKS);
    const items = groupFields(
      all({ shelf: 'genres', scope: {}, sort: 'title', direction: 'asc' }),
    );
    expect(items.length).toBe(genres.length);
    items.forEach((item) => {
      const genre = genres.find((entry) => entry.id === item.id);
      expect(item).toEqual({
        kind: 'genre',
        id: genre?.id,
        name: genre?.name,
        artistCount: genre?.artistCount,
        trackCount: genre?.trackCount,
        addedAt: genre?.addedAt,
        isPending: genre?.isPending,
        ...(genre?.artId === undefined ? {} : { artId: genre.artId }),
      });
    });
    expect(
      all({ shelf: 'genres', scope: {}, sort: 'title', direction: 'desc' }).map(
        (item) => normalizeForSearch((item as { name: string }).name),
      ),
    ).toEqual(
      sortGenres(genres, 'title', 'desc').map((genre) =>
        normalizeForSearch(genre.name),
      ),
    );
  });

  it('scopes an artist to the songs whose artistKey it is', () => {
    const artist = artistKey(TRACKS[3]);
    const ids = trackIdsOf(
      all({
        shelf: 'tracks',
        scope: { artist },
        natural: 'album',
        direction: 'asc',
      }),
    );
    expect(
      ids.map((id) => trackKey(byId.get(id) as ILibraryTrack, 'album')),
    ).toEqual(
      referenceSortTracks(
        TRACKS.filter((track) => artistKey(track) === artist),
        'album',
        'asc',
      ).map((track) => trackKey(track, 'album')),
    );
  });
});

describe('the folder shelves', () => {
  it('lists every folder at once as groupIntoFolders does', () => {
    const items = groupFields(
      all({ shelf: 'folders', scope: {}, sort: 'title', direction: 'asc' }),
    );
    const folders = sortFolders(groupIntoFolders(TRACKS), 'title');
    expect(items.map((item) => item.id)).toEqual(
      folders.map((folder) => folder.id),
    );
    items.forEach((item, at) =>
      expect(item).toEqual({
        kind: 'folder',
        ...folders[at],
        ...(folders[at].artId === undefined ? {} : {}),
      }),
    );
  });

  it('lists what is directly inside a folder as folderChildren does', () => {
    const items = groupFields(
      all({
        shelf: 'children',
        scope: {},
        parent: 'C:/Music',
        sort: 'title',
        direction: 'asc',
      }),
    );
    const expected = sortFolders(folderChildren(TRACKS, 'C:/Music'), 'title');
    expect(items).toEqual(
      expected.map((folder) => ({ kind: 'folder', ...folder })),
    );
  });

  it('lists the roots as rootFolders does', () => {
    const items = all({
      shelf: 'roots',
      scope: {},
      sort: 'added',
      direction: 'asc',
    });
    expect(items).toEqual(
      sortFolders(rootFolders(TRACKS, ROOTS), 'added').map((folder) => ({
        kind: 'folder',
        ...folder,
      })),
    );
  });
});

describe('the other questions', () => {
  const query: ILibraryListQuery = {
    shelf: 'albums',
    scope: {},
    sort: 'title',
    direction: 'asc',
  };

  it('finds where a row sits, and every letter of the rail', () => {
    const items = all(query);
    const target = items[17] as { id: string };
    expect(ask({ type: 'position', query, id: target.id })).toBe(17);
    expect(ask({ type: 'position', query, id: 'nothing' })).toBe(-1);
    const letters = ask({ type: 'letters', query }) as Record<string, number>;
    Object.entries(letters).forEach(([letter, at]) => {
      const { title } = items[at] as { title: string };
      const first = normalizeForSearch(title).charAt(0).toUpperCase();
      expect(first >= 'A' && first <= 'Z' ? first : '#').toBe(letter);
    });
  });

  it('gives a window of ids, and tracks by id in the order asked, repeats included', () => {
    const songs: ILibraryListQuery = {
      shelf: 'tracks',
      scope: {},
      sort: 'title',
      direction: 'asc',
    };
    const everything = trackIdsOf(all(songs));
    expect(ask({ type: 'ids', query: songs, offset: 20, limit: 5 })).toEqual(
      everything.slice(20, 25),
    );
    const wanted = [TRACKS[9].id, 'missing', TRACKS[2].id, TRACKS[9].id];
    expect(
      (ask({ type: 'tracks', ids: wanted }) as ILibraryTrack[]).map(
        (track) => track.id,
      ),
    ).toEqual([TRACKS[9].id, TRACKS[2].id, TRACKS[9].id]);
    expect(ask({ type: 'duration', ids: [TRACKS[0].id, TRACKS[0].id] })).toBe(
      2 * (TRACKS[0].durationMs ?? 0),
    );
  });

  it('keeps a playlist in its own order, a song twice where it is there twice', () => {
    const ids = [TRACKS[5].id, TRACKS[1].id, TRACKS[5].id];
    expect(
      trackIdsOf(
        all({
          shelf: 'tracks',
          scope: { ids },
          natural: 'ids',
          direction: 'asc',
        }),
      ),
    ).toEqual(ids);
  });

  it('lists an album as pressed, its folder-mates after by title, and lights what the toolbar searched', () => {
    const album = albumKey(TRACKS[0]);
    const items = all({
      shelf: 'tracks',
      scope: { album, withFolderMates: true },
      natural: 'disc',
      direction: 'asc',
    });
    const own =
      groupIntoAlbums(TRACKS).find((entry) => entry.id === album)?.trackIds ??
      [];
    const folders = new Set(
      own.map((id) => trackFolderPath((byId.get(id) as ILibraryTrack).path)),
    );
    const mates = sortTracks(
      TRACKS.filter(
        (track) =>
          !own.includes(track.id) && folders.has(trackFolderPath(track.path)),
      ),
      'title',
    );
    expect(trackIdsOf(items)).toEqual([
      ...own,
      ...mates.map((track) => track.id),
    ]);
    expect(
      items.filter((item) => item.kind === 'track' && item.folderOnly).length,
    ).toBe(mates.length);

    const marked = all({
      shelf: 'tracks',
      scope: { album, withFolderMates: true },
      natural: 'disc',
      mark: 'leo',
      direction: 'asc',
    });
    const lit = marked.filter((item) => item.kind === 'track' && item.matched);
    expect(marked.slice(0, lit.length)).toEqual(lit);
  });

  it('continues with the seed genre, never the seed, anything excluded, video or unplayable', () => {
    const seed = TRACKS.find(
      (track) => track.genre === 'Jazz' && track.kind === 'audio',
    ) as ILibraryTrack;
    const exclude = TRACKS.filter((track) => track.genre === 'Jazz')
      .slice(0, 3)
      .map((track) => track.id);
    const picked = ask({
      type: 'continuation',
      seedId: seed.id,
      exclude,
      count: 5,
    }) as string[];
    expect(picked.length).toBeGreaterThan(0);
    picked.forEach((id) => {
      const track = byId.get(id) as ILibraryTrack;
      expect(id).not.toBe(seed.id);
      expect(exclude).not.toContain(id);
      expect(track.kind).toBe('audio');
      expect(track.isPlayable).toBe(true);
      expect(track.genre).toBe('Jazz');
    });
  });
});

describe('the questions a queue and a panel ask', () => {
  it('continues an untagged seed with its own artist, the seed and the excluded left out', () => {
    // The branch a genre-less seed takes shares its parameters with the genre
    // branch and reads only some of them; an unbound one used to throw here.
    const seed = TRACKS.find(
      (track) =>
        track.genre === undefined &&
        track.kind === 'audio' &&
        artistKey(track) !== '' &&
        TRACKS.filter(
          (other) =>
            other.id !== track.id &&
            other.kind === 'audio' &&
            other.isPlayable &&
            artistKey(other) === artistKey(track),
        ).length > 2,
    ) as ILibraryTrack;
    const mates = TRACKS.filter(
      (track) =>
        track.id !== seed.id &&
        track.kind === 'audio' &&
        track.isPlayable &&
        artistKey(track) === artistKey(seed),
    );
    const exclude = [mates[0].id];
    const picked = ask({
      type: 'continuation',
      seedId: seed.id,
      exclude,
      count: 50,
    }) as string[];
    expect(picked.length).toBe(mates.length - 1);
    picked.forEach((id) => {
      const track = byId.get(id) as ILibraryTrack;
      expect(id).not.toBe(seed.id);
      expect(exclude).not.toContain(id);
      expect(artistKey(track)).toBe(artistKey(seed));
    });
  });

  it('counts what a list still has after a song, less what the queue already holds', () => {
    const query: ILibraryListQuery = {
      shelf: 'tracks',
      scope: {},
      sort: 'title',
      direction: 'asc',
      folderHeadings: true,
    };
    const ids = ask({
      type: 'ids',
      query,
      offset: 0,
      limit: 100000,
    }) as string[];
    const after = ids[40];
    const held = [ids[41], ids[3], 'not-a-song'];
    const expected = ids.slice(41).filter((id) => !held.includes(id)).length;
    expect(ask({ type: 'rest', query, afterId: after, exclude: held })).toBe(
      expected,
    );
    expect(
      ask({ type: 'rest', query, afterId: 'not-a-song', exclude: [] }),
    ).toBe(-1);
  });

  it('says where every folder heading stands, the rows a page draws them at', () => {
    const query: ILibraryListQuery = {
      shelf: 'tracks',
      scope: { kind: 'video' },
      natural: 'path',
      folderHeadings: true,
      direction: 'asc',
    };
    const rows = all(query);
    const drawn = rows.flatMap((item, at) =>
      item.kind === 'heading' ? [at] : [],
    );
    expect(drawn.length).toBeGreaterThan(1);
    expect(ask({ type: 'headings', query })).toEqual(drawn);
    expect(
      ask({ type: 'headings', query: { ...query, folderHeadings: false } }),
    ).toEqual([]);
  });

  it('counts the songs a mark lit, all of them at the head of the list', () => {
    const album = albumKey(TRACKS[0]);
    const query: ILibraryListQuery = {
      shelf: 'tracks',
      scope: { album, withFolderMates: true },
      natural: 'disc',
      mark: 'leo',
      direction: 'asc',
    };
    const page = ask({
      type: 'page',
      query,
      offset: 0,
      limit: 500,
    }) as ILibraryPage;
    const lit = page.items.filter(
      (item) => item.kind === 'track' && item.matched,
    ).length;
    expect(page.markedCount).toBe(lit);
    expect(lit).toBeGreaterThan(0);
    const plain = ask({
      type: 'page',
      query: { ...query, mark: undefined },
      offset: 0,
      limit: 1,
    }) as ILibraryPage;
    expect(plain.markedCount).toBe(0);
  });

  it('narrows an unranked search without reordering it', () => {
    const query: ILibraryListQuery = {
      shelf: 'tracks',
      scope: {},
      natural: 'path',
      direction: 'asc',
    };
    const everything = trackIdsOf(all(query));
    const narrowed = trackIdsOf(
      all({ ...query, search: 'leo', unranked: true }),
    );
    const matching = new Set(trackIdsOf(all({ ...query, search: 'leo' })));
    expect(narrowed.length).toBe(matching.size);
    expect(narrowed).toEqual(everything.filter((id) => matching.has(id)));
  });
});
