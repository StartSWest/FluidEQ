/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { cleanup, render, screen } from '@testing-library/react';
import { albumKey, trackFolderPath } from 'common/library/grouping';
import type {
  ILibraryListQuery,
  ILibraryPage,
  ILibraryTotals,
  TLibraryListItem,
  TLibraryRequest,
} from 'common/library/query';
import type { ILibraryTrack } from 'common/library/types';
import { createLibraryQueries } from 'main/library/libraryQuery';
import type { ILibraryStore } from 'main/library/libraryStore';
import { openLibraryStore } from 'main/library/libraryStoreOpen';
import LibraryDetail from 'renderer/library/LibraryDetail';

/**
 * An album's page lists that album and nothing else (Ivan, 2026-11-26: "why
 * if I am displaying the album Why? from Jacob it needs to show more songs
 * in yellow below?"). It used to ask for every file in any folder one of its
 * songs sat in, so an album filed among loose downloads listed them all
 * under its own songs, in yellow, and counted them in its header while the
 * status line counted the album alone: 48 songs over 16.
 *
 * The page runs here against a real on-disk Library, every list and total
 * it asks for answered by the store, so what is checked is what the window
 * would draw from the same files.
 */

let mockAsk: (request: TLibraryRequest) => unknown = () => undefined;

/** Every row of a list at once — the store's answer, never a page out. */
const mockListOf = (query: ILibraryListQuery | undefined) => {
  const page =
    query === undefined
      ? undefined
      : (mockAsk({
          type: 'page',
          query,
          offset: 0,
          limit: 10_000,
        }) as ILibraryPage);
  const items: TLibraryListItem[] = page?.items ?? [];
  return {
    query,
    count: items.length,
    nearCount: page?.nearCount ?? 0,
    markedCount: page?.markedCount ?? 0,
    isLoaded: query !== undefined,
    hasAnswer: query !== undefined,
    at: (index: number) => items[index],
    want: () => undefined,
    indexOf: (id: string) =>
      items.findIndex((item) => item.kind === 'track' && item.track.id === id),
  };
};

jest.mock('renderer/library/useLibraryList', () => ({
  useLibraryList: (query: ILibraryListQuery | undefined) => mockListOf(query),
}));
jest.mock('renderer/library/useLibraryAnswer', () => ({
  useLibraryAnswer: (request: TLibraryRequest | undefined) =>
    request === undefined ? undefined : mockAsk(request),
}));
jest.mock('renderer/library/PlaylistContext', () => ({
  usePlaylists: () => ({ playlists: [], isFavorite: () => false }),
}));
jest.mock('renderer/library/LibraryDetailHeader', () => ({
  __esModule: true,
  default: ({ title, counts }: { title: string; counts: string }) => (
    <div data-testid="record-header">
      <span data-testid="record-title">{title}</span>
      <span data-testid="record-facts">{counts}</span>
    </div>
  ),
}));
jest.mock('renderer/library/LibraryListView', () => ({
  __esModule: true,
  default: ({ list }: { list: ReturnType<typeof mockListOf> }) => (
    <ol data-testid="record-songs">
      {Array.from({ length: list.count }, (_, index) => {
        const item = list.at(index);
        return item?.kind === 'track' ? (
          <li key={item.track.id}>{item.track.title}</li>
        ) : null;
      })}
    </ol>
  ),
}));

const DOWNLOADS = 'D:\\Music\\Downloads';
const ALBUM_FOLDER = 'D:\\Music\\Jacob Whitesides';
const ELSEWHERE = 'D:\\Music\\Ed Sheeran\\X';

let seq = 0;
const song = (
  folder: string,
  title: string,
  tags: Partial<ILibraryTrack> = {},
): ILibraryTrack => {
  seq += 1;
  return {
    id: `t${seq}`,
    rootId: 'r1',
    path: `${folder}\\${title}.mp3`,
    kind: 'audio',
    isPlayable: true,
    title,
    sizeBytes: 1000 + seq,
    mtimeMs: 1_700_000_000_000 + seq,
    addedAt: seq,
    durationMs: 200_000,
    ...tags,
  };
};

const onWhy = (trackNo: number, title: string, folder: string) =>
  song(folder, title, {
    artist: 'Jacob Whitesides',
    album: 'Why?',
    year: 2016,
    trackNo,
    durationMs: 210_000,
  });

/**
 * "Why?" split across two folders, the way Ivan's copy is: two songs in a
 * folder of its own, four in a folder of loose downloads — songs on other
 * albums, songs with no album, a song with no tags at all — and an
 * unrelated album somewhere else.
 */
const WHY = [
  onWhy(4, 'Lovesick', DOWNLOADS),
  onWhy(1, 'Why?', ALBUM_FOLDER),
  onWhy(3, 'Black and Blue', DOWNLOADS),
  onWhy(2, 'You Told Me So', ALBUM_FOLDER),
  onWhy(6, 'Focus (Rufus Dipper Remix)', DOWNLOADS),
  onWhy(5, 'Open Book', DOWNLOADS),
];
const LOOSE = [
  song(DOWNLOADS, 'Beautiful To Me', {
    artist: 'Olly Murs',
    album: 'Never Been Better (Deluxe)',
  }),
  song(DOWNLOADS, 'Cry Me a River', {
    artist: 'Justin Timberlake',
    album: 'Essentials',
  }),
  song(DOWNLOADS, 'Bills, Bills, Bills', { artist: '30 Stars' }),
  song(DOWNLOADS, '04 - She Will Be Loved', { genre: 'Classical' }),
];
const OTHER_ALBUM = [
  song(ELSEWHERE, 'Bloodstream', { artist: 'Ed Sheeran', album: 'X' }),
];
const TRACKS = [...WHY, ...LOOSE, ...OTHER_ALBUM];
const WHY_IN_ORDER = [
  'Why?',
  'You Told Me So',
  'Black and Blue',
  'Lovesick',
  'Open Book',
  'Focus (Rufus Dipper Remix)',
];
const WHY_KEY = albumKey(WHY[0]);

let store: ILibraryStore;

beforeAll(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-album-page-'));
  ({ store } = openLibraryStore(dir));
  store.addRoots([
    {
      id: 'r1',
      path: 'D:\\Music',
      addedAt: 1,
      trackCount: 0,
      karaokeSkipped: 0,
    },
  ]);
  store.upsertTracks(TRACKS, 0);
  mockAsk = createLibraryQueries(store).answer;
});

afterAll(() => store.close());
afterEach(cleanup);

const songsShown = () =>
  Array.from(
    screen.getByTestId('record-songs').querySelectorAll('li'),
    (row) => row.textContent,
  );

describe("an album's page", () => {
  it('lists its own songs as pressed, and not the loose files sharing its folders', () => {
    // The control: the loose files are there, in the album's own folder,
    // and on its folder's page — what used to be pulled in is in the store.
    const folderPage = mockAsk({
      type: 'totals',
      query: {
        shelf: 'tracks',
        scope: { folder: trackFolderPath(LOOSE[0].path) },
        direction: 'asc',
      },
    }) as ILibraryTotals;
    expect(folderPage.count).toBe(4 + LOOSE.length);

    render(
      <LibraryDetail
        albumId={WHY_KEY}
        onBack={() => undefined}
        onPlayTrack={() => undefined}
      />,
    );
    expect(screen.getByTestId('record-title')).toHaveTextContent('Why?');
    expect(songsShown()).toEqual(WHY_IN_ORDER);
  });

  it('counts and times what it lists, as the status line does', () => {
    render(
      <LibraryDetail
        albumId={WHY_KEY}
        onBack={() => undefined}
        onPlayTrack={() => undefined}
      />,
    );
    // The status line's own question for an open album
    // (`useLibraryWorkspaceNavigation`'s record query).
    const statusLine = mockAsk({
      type: 'totals',
      query: {
        shelf: 'tracks',
        scope: { album: WHY_KEY },
        natural: 'disc',
        direction: 'asc',
      },
    }) as ILibraryTotals;
    expect(statusLine).toEqual({ count: WHY.length, durationMs: 6 * 210_000 });
    // "2016 · 6 songs · 21 min · MP3": six songs of 3 min 30 s.
    expect(screen.getByTestId('record-facts')).toHaveTextContent(
      /^2016 · 6 songs · 21 min/,
    );
    expect(songsShown()).toHaveLength(statusLine.count);
  });
});
