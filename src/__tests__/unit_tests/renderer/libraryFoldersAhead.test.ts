/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * A folder's own folders and its songs drawn as one table, the folders first
 * (Ivan, 2026-11-15: "lets go with A"). The two halves stay two store lists;
 * the joined list has to hand every row, every position and every page ask
 * to the half that owns it, with the songs' positions moved down by the
 * folders ahead of them - a song read at its own index would open the wrong
 * row, and a page asked at the joined index would fetch the wrong page.
 */

import type {
  ILibraryFolderItem,
  ILibraryListQuery,
  ILibraryTrackItem,
  TLibraryListItem,
} from 'common/library/query';
import libraryFoldersAhead from 'renderer/library/libraryFoldersAhead';
import { libraryRows, librarySectionsOf } from 'renderer/library/libraryRows';
import type { ILibraryList } from 'renderer/library/useLibraryList';

const folder = (id: string): ILibraryFolderItem => ({
  kind: 'folder',
  id,
  name: id,
  trackCount: 1,
  addedAt: 0,
  isPending: false,
});

const song = (id: string): ILibraryTrackItem => ({
  kind: 'track',
  track: {
    id,
    rootId: 'root',
    path: `C:/Music/${id}.flac`,
    kind: 'audio',
    isPlayable: true,
    title: id,
    sizeBytes: 1,
    mtimeMs: 0,
    addedAt: 0,
  },
});

const idOf = (item: TLibraryListItem): string => {
  switch (item.kind) {
    case 'track':
      return item.track.id;
    case 'heading':
      return item.folder;
    default:
      return item.id;
  }
};

const SONGS_QUERY: ILibraryListQuery = {
  shelf: 'tracks',
  scope: { folder: 'C:/Music' },
  direction: 'asc',
};

interface IFakeList extends ILibraryList {
  want: jest.Mock<void, [number, number]>;
}

const listOf = (
  items: TLibraryListItem[],
  overrides: Partial<Omit<ILibraryList, 'want'>> = {},
): IFakeList => ({
  query: undefined,
  count: items.length,
  nearCount: 0,
  markedCount: 0,
  isLoaded: true,
  at: (index) => items[index],
  want: jest.fn<void, [number, number]>(),
  indexOf: (id) => items.findIndex((item) => idOf(item) === id),
  ...overrides,
});

const threeFolders = () => listOf(['a', 'b', 'c'].map(folder));
const fourSongs = (overrides: Partial<Omit<ILibraryList, 'want'>> = {}) =>
  listOf(['w', 'x', 'y', 'z'].map(song), {
    query: SONGS_QUERY,
    nearCount: 2,
    markedCount: 1,
    ...overrides,
  });

describe('a folder’s folders ahead of its songs', () => {
  it('reads the folders first, then the songs, in one run', () => {
    const joined = libraryFoldersAhead(threeFolders(), fourSongs());
    expect(joined.count).toBe(7);
    expect(joined.lead).toBe(3);
    const ids = Array.from({ length: joined.count }, (_, index) => {
      const item = joined.at(index);
      return item === undefined ? undefined : idOf(item);
    });
    expect(ids).toEqual(['a', 'b', 'c', 'w', 'x', 'y', 'z']);
    expect(joined.at(7)).toBeUndefined();
  });

  it('keeps the songs’ query and counts, which the store answers about', () => {
    const joined = libraryFoldersAhead(threeFolders(), fourSongs());
    expect(joined.query).toBe(SONGS_QUERY);
    expect(joined.nearCount).toBe(2);
    expect(joined.markedCount).toBe(1);
  });

  it('is loaded only once both halves have answered', () => {
    expect(libraryFoldersAhead(threeFolders(), fourSongs()).isLoaded).toBe(
      true,
    );
    expect(
      libraryFoldersAhead(threeFolders(), fourSongs({ isLoaded: false }))
        .isLoaded,
    ).toBe(false);
    expect(
      libraryFoldersAhead(listOf([], { isLoaded: false }), fourSongs())
        .isLoaded,
    ).toBe(false);
  });

  it('finds a song further down by the folders ahead of it', () => {
    const songs = fourSongs();
    const joined = libraryFoldersAhead(threeFolders(), songs);
    // The control: the songs' own list puts "x" at its own index.
    expect(songs.indexOf('x')).toBe(1);
    expect(joined.indexOf('x')).toBe(4);
    expect(joined.indexOf('b')).toBe(1);
    expect(joined.indexOf('nowhere')).toBe(-1);
  });

  it('asks each half only for its own rows, in its own positions', () => {
    const folders = threeFolders();
    const songs = fourSongs();
    const joined = libraryFoldersAhead(folders, songs);

    // Across the seam: the last two folders and the first two songs.
    joined.want(1, 5);
    expect(folders.want).toHaveBeenCalledWith(1, 3);
    expect(songs.want).toHaveBeenCalledWith(0, 2);

    folders.want.mockClear();
    songs.want.mockClear();
    // Folders alone: the songs are not asked for.
    joined.want(0, 2);
    expect(folders.want).toHaveBeenCalledWith(0, 2);
    expect(songs.want).not.toHaveBeenCalled();

    folders.want.mockClear();
    songs.want.mockClear();
    // Songs alone: the folders are not asked for.
    joined.want(4, 6);
    expect(folders.want).not.toHaveBeenCalled();
    expect(songs.want).toHaveBeenCalledWith(1, 3);
  });

  it('is the songs alone where the folder holds no folders', () => {
    const folders = listOf([]);
    const songs = fourSongs();
    const joined = libraryFoldersAhead(folders, songs);
    expect(joined.lead).toBe(0);
    expect(joined.indexOf('x')).toBe(1);
    joined.want(0, 2);
    expect(folders.want).not.toHaveBeenCalled();
    expect(songs.want).toHaveBeenCalledWith(0, 2);
  });
});

describe('the headings over the joined table', () => {
  it('name and count the folders and the songs', () => {
    const joined = libraryFoldersAhead(threeFolders(), fourSongs());
    expect(librarySectionsOf(joined)).toEqual([
      { before: 0, section: 'folders', count: 3 },
      { before: 3, section: 'songs', count: 4 },
    ]);
  });

  it('name the folders alone where there are no songs', () => {
    const joined = libraryFoldersAhead(threeFolders(), listOf([]));
    expect(librarySectionsOf(joined)).toEqual([
      { before: 0, section: 'folders', count: 3 },
    ]);
  });

  it('are none over a folder that holds songs and no folders', () => {
    // The control beside it: the same songs under folders draw headings.
    expect(
      librarySectionsOf(libraryFoldersAhead(threeFolders(), fourSongs())),
    ).toHaveLength(2);
    expect(
      librarySectionsOf(libraryFoldersAhead(listOf([]), fourSongs())),
    ).toEqual([]);
  });

  it('stand between the rows without hiding any of them', () => {
    const rows = libraryRows(libraryFoldersAhead(threeFolders(), fourSongs()));
    expect(rows.count).toBe(9);
    expect(rows.sections).toEqual([
      { row: 0, section: 'folders' },
      { row: 4, section: 'songs' },
    ]);
    expect(rows.at(0)).toEqual({
      kind: 'section',
      section: 'folders',
      count: 3,
    });
    expect(rows.indexOf(1)).toBe(0);
    expect(rows.at(4)).toEqual({ kind: 'section', section: 'songs', count: 4 });
    expect(rows.indexOf(4)).toBe(-1);
    // The first song: list index 3, drawn under both headings.
    expect(rows.indexOf(5)).toBe(3);
    expect(rows.rowOf(3)).toBe(5);
  });
});
