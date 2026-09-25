/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the window asks the library, and what comes back — a page at a time.
 *
 * The window never holds the library (`libraryStore.ts`). It says what it is
 * showing — a shelf, the folder it stands in, a search, an order — and asks
 * for the rows on screen; main answers from the store. One description of a
 * list serves every question about it: a page, how long it is, where a song
 * sits in it, which letter starts where.
 */

import type {
  ILibraryRoot,
  ILibraryTrack,
  TLibrarySort,
  TLibrarySortDirection,
} from './types';

/** Which tracks a list is drawn from. Every part narrows; none widens. */
export interface ILibraryScope {
  /** The folder the reader is standing in: it and everything beneath it. */
  beneath?: string;
  /** One folder's own files, and not what is in the folders under it. */
  folder?: string;
  /** One album, by `albumKey`. */
  album?: string;
  /** One artist, by `artistKey`. */
  artist?: string;
  /** One genre, by `genreKey`. */
  genre?: string;
  /**
   * With `album`: the files sharing its folders without being on it too —
   * the loose singles and bonus discs an album panel lists after the record,
   * each flagged `folderOnly`.
   */
  withFolderMates?: boolean;
  /** Only these tracks (a playlist): the order they are given in is theirs. */
  ids?: readonly string[];
  kind?: 'audio' | 'video';
}

/**
 * A track list's order when no column is chosen and nothing is searched: the
 * order the library learned them in, by record then title, a record as it was
 * pressed (its folder-mates after, by title), by file path, or the order the
 * `ids` scope gave.
 */
export type TLibraryNaturalOrder =
  'library' | 'album' | 'disc' | 'path' | 'ids';

/**
 * What a list is made of.
 *
 * `albums`, `artists`, `genres` and `folders` group the tracks in scope;
 * `children` lists the folders directly inside `parent` and `roots` the
 * library's own roots, each summed over everything beneath it; `tracks` lists
 * the tracks themselves.
 */
export type TLibraryListShelf =
  'albums' | 'artists' | 'genres' | 'folders' | 'children' | 'roots' | 'tracks';

export interface ILibraryListQuery {
  shelf: TLibraryListShelf;
  scope: ILibraryScope;
  /**
   * Narrows to what matches — ranked, best first, unless an order is asked
   * for. A shelf of albums, artists, genres or folders lists every one with a
   * match in it, whole.
   */
  search?: string;
  /**
   * While searching: the folder the reader stands in. What matches beneath it
   * comes first, then everything else (`ILibraryPage.nearCount` says where
   * the one stops), and the search itself reaches the whole library.
   */
  near?: string;
  /** Absent: relevance while searching, otherwise the list's own order. */
  sort?: TLibrarySort;
  direction: TLibrarySortDirection;
  /** `tracks` only: a heading row wherever the folder changes. */
  folderHeadings?: boolean;
  /**
   * `tracks` only: what this matches comes first and is flagged `matched`;
   * nothing is removed. Why a record came up — the toolbar's search, lit
   * inside a panel it did not name.
   */
  mark?: string;
  /** `tracks` only; see `TLibraryNaturalOrder`. Default `library`. */
  natural?: TLibraryNaturalOrder;
  /**
   * `tracks` only: a search narrows the list and leaves its order alone.
   * The video shelf, which is laid out folder by folder and would be
   * scattered into a heading per video by a ranking.
   */
  unranked?: boolean;
  /** `children` only: the folder whose subfolders are listed. */
  parent?: string;
}

export interface ILibraryAlbumItem {
  kind: 'album';
  id: string;
  title: string;
  artist: string;
  year?: number;
  artId?: string;
  trackCount: number;
  durationMs: number;
  addedAt: number;
  isPending: boolean;
  near?: boolean;
}

export interface ILibraryArtistItem {
  kind: 'artist';
  id: string;
  name: string;
  albumCount: number;
  trackCount: number;
  artId?: string;
  addedAt: number;
  isPending: boolean;
  near?: boolean;
}

export interface ILibraryGenreItem {
  kind: 'genre';
  id: string;
  /** The first spelling the library met; empty for the Unknown bucket. */
  name: string;
  artistCount: number;
  trackCount: number;
  artId?: string;
  addedAt: number;
  isPending: boolean;
  near?: boolean;
}

export interface ILibraryFolderItem {
  kind: 'folder';
  /** The directory, forward slashes, as tracks' folders are compared. */
  id: string;
  name: string;
  trackCount: number;
  artId?: string;
  addedAt: number;
  isPending: boolean;
  near?: boolean;
}

export interface ILibraryTrackItem {
  kind: 'track';
  track: ILibraryTrack;
  /** Beneath the `near` folder of a search. */
  near?: boolean;
  /** Matched by the query's `mark`. */
  matched?: boolean;
  /** In one of an album's folders without being on it (`withFolderMates`). */
  folderOnly?: boolean;
}

/** A folder's name over the run of its tracks (`folderHeadings`). */
export interface ILibraryHeadingItem {
  kind: 'heading';
  folder: string;
}

export type TLibraryListItem =
  | ILibraryAlbumItem
  | ILibraryArtistItem
  | ILibraryGenreItem
  | ILibraryFolderItem
  | ILibraryTrackItem
  | ILibraryHeadingItem;

export interface ILibraryPage {
  /** The rows in the whole list, headings included. */
  total: number;
  /** How many rows, from the top, are the `near` folder's own matches. */
  nearCount: number;
  /** How many songs the query's `mark` lit, all of them at the top. */
  markedCount: number;
  offset: number;
  items: TLibraryListItem[];
  /** The store version this page was read at (`library-changed`). */
  version: number;
}

/**
 * Everything the window asks, one shape per question. One channel carries
 * them all, so a new question is a new member here rather than a new wire.
 */
export type TLibraryRequest =
  | {
      type: 'page';
      query: ILibraryListQuery;
      offset: number;
      limit: number;
    }
  /** Where a row sits: a track by id, or a group by its own id. */
  | { type: 'position'; query: ILibraryListQuery; id: string }
  /** The first row under each letter of the jump rail (`#`, A–Z). */
  | { type: 'letters'; query: ILibraryListQuery }
  /** Track ids, in list order, from `offset` — a queue's window, a range. */
  | { type: 'ids'; query: ILibraryListQuery; offset: number; limit: number }
  /** The tracks with these ids, in this order; unknown ones left out. */
  | { type: 'tracks'; ids: readonly string[] }
  /**
   * Songs to keep playing after `seedId`: the same genre, or for an untagged
   * seed the same artist, none of `exclude`, shuffled.
   */
  | {
      type: 'continuation';
      seedId: string;
      exclude: readonly string[];
      count: number;
    }
  /** Summed durations of these ids, for "how long is left". */
  | { type: 'duration'; ids: readonly string[] }
  /** The row of every folder heading in a list that has them. */
  | { type: 'headings'; query: ILibraryListQuery }
  /**
   * How many of the list's songs come after `afterId` and are not in
   * `exclude`: what a queue already holding `exclude` has still to come
   * from this list.
   */
  | {
      type: 'rest';
      query: ILibraryListQuery;
      afterId: string;
      exclude: readonly string[];
    };

/**
 * What the window holds of the library at all times: its folders and how
 * many songs it has. Everything else is asked for when it is drawn.
 */
export interface ILibrarySummary {
  /** The store's version; a page read at another is stale. */
  version: number;
  roots: ILibraryRoot[];
  /** Songs and videos together. */
  trackCount: number;
  videoCount: number;
  /**
   * The library could not be read at launch and started again empty — said
   * out loud, because nothing else would explain where the songs went.
   */
  wasReset: boolean;
}

/** What each question answers (`TLibraryRequest`), by its `type`. */
export interface ILibraryAnswers {
  page: ILibraryPage;
  /** The row, or -1 when the list does not hold it. */
  position: number;
  /** Each letter's first row; a letter with no row is absent. */
  letters: Record<string, number>;
  ids: string[];
  tracks: ILibraryTrack[];
  continuation: string[];
  duration: number;
  headings: number[];
  /** -1 when the list does not hold `afterId`. */
  rest: number;
}
