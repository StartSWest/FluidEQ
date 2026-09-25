/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * One list, as SQL: which rows, and in what order.
 *
 * Every question about a list — a page of it, its length, where one song sits
 * in it, where each letter starts — is asked of the same two things, so they
 * are built once here and wrapped by `libraryQuery.ts`: `body`, a SELECT of
 * the list's rows in no order, and `order`, the ORDER BY over its columns.
 *
 * THE RULES ARE THE WINDOW'S, TRANSCRIBED. What a search matches and how it
 * ranks is `searchScore` (title 100/80/40, artist and album artist 70/70/30,
 * album 60/60/20, exact/start/anywhere on the grouping fold); how a shelf
 * orders is `sortTracks`, `sortAlbums`, `sortArtists`, `sortGenres` and
 * `sortFolders`, `desc` reversing the whole of it; what an album, an artist, a
 * genre or a folder IS — its name, its count, its cover, whether it is still
 * pending — is `groupIntoAlbums` and its siblings. `libraryQuery.test.ts`
 * holds the two to each other on the same tracks.
 */

import type { SQLInputValue } from 'node:sqlite';
import { normalizeForGrouping } from '../../common/library/grouping';
import type { ILibraryListQuery } from '../../common/library/query';
import type { TLibrarySort } from '../../common/library/types';
import {
  beneathSql,
  binder,
  directed,
  scopeConditions,
  scoreSql,
  type TBind,
} from './libraryQuerySql';

export interface ILibraryQueryPlan {
  body: string;
  order: string;
  params: Record<string, SQLInputValue>;
  /** Folder headings are interleaved (`tracks` with `folderHeadings`). */
  headings: boolean;
  /** How many items, asked without building them (headings not counted). */
  count: string;
  /**
   * The body with only what ordering and numbering read — what a window over
   * the whole list runs on. The same as `body` where that is narrow already.
   */
  narrow: string;
}

/** `sortTracks`, over the body's columns. */
const trackSortTerms = (sort: TLibrarySort): string[] => {
  if (sort === 'artist') {
    return ['sort_artist', 'sort_title', 'seq'];
  }
  if (sort === 'album') {
    return ['sort_album', 'sort_title', 'seq'];
  }
  if (sort === 'year') {
    return ['COALESCE(year, 0)', 'seq'];
  }
  if (sort === 'added') {
    return ['added_at DESC', 'seq'];
  }
  if (sort === 'track') {
    return [
      'sort_album',
      'COALESCE(disc_no, 1)',
      'COALESCE(track_no, 0)',
      'sort_title',
      'seq',
    ];
  }
  return ['sort_title', 'seq'];
};

const NATURAL_TERMS: Record<string, string[]> = {
  library: ['seq'],
  album: ['sort_album', 'sort_title', 'seq'],
  // The record as pressed, and its folder-mates after it by title.
  disc: [
    'folder_only',
    'CASE WHEN folder_only = 0 THEN COALESCE(disc_no, 1) END',
    'CASE WHEN folder_only = 0 THEN COALESCE(track_no, 0) END',
    'sort_title',
    'seq',
  ],
  path: ['sort_path', 'seq'],
  ids: ['ids_order'],
};

const TRACK_COLUMNS = `
  t.seq, t.id, t.root_id, t.path, t.folder, t.kind, t.is_playable, t.title,
  t.artist, t.album_artist, t.album, t.track_no, t.disc_no, t.year, t.genre,
  t.duration_ms, t.bitrate, t.sample_rate, t.channels, t.codec, t.art_id,
  t.artwork_checked, t.size_bytes, t.mtime_ms, t.added_at,
  t.has_metadata_error, t.normalization, t.is_pending, t.sort_title,
  t.sort_artist, t.sort_album`;

const tracksPlan = (query: ILibraryListQuery): ILibraryQueryPlan => {
  const { params, bind } = binder();
  const needle = normalizeForGrouping(query.search ?? '');
  const markNeedle = normalizeForGrouping(query.mark ?? '');
  const searching = needle !== '';
  const near = searching ? query.near : undefined;
  const conditions = scopeConditions(query.scope, bind, near !== undefined);
  const score = searching ? scoreSql(bind(needle)) : '0';
  if (searching) {
    conditions.push(`${score} > 0`);
  }
  const { ids, album } = query.scope;
  const join =
    ids === undefined
      ? ''
      : `JOIN json_each(${bind(JSON.stringify(ids))}) AS listed ON listed.value = t.id`;
  const folderOnly =
    album !== undefined && query.scope.withFolderMates
      ? `(t.album_key <> ${bind(album)})`
      : '0';
  const body = `
    SELECT ${TRACK_COLUMNS},
      t.title AS list_title,
      ${score} AS score,
      ${near === undefined ? '0' : beneathSql('t.folder', near, bind)} AS near,
      ${markNeedle === '' ? '0' : `(${scoreSql(bind(markNeedle))} > 0)`} AS matched,
      ${folderOnly} AS folder_only,
      ${query.natural === 'path' ? 'sort_key(t.path)' : "''"} AS sort_path,
      ${ids === undefined ? '0' : 'CAST(listed.key AS INTEGER)'} AS ids_order
    FROM tracks t ${join}
    ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}`;
  const count = `SELECT COUNT(*) AS n FROM tracks t ${join}
    ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}`;
  // What numbering the whole list needs and nothing more: a window over
  // every song's full row (paths, loudness JSON) cost 390 ms on 14,077 songs
  // for one page of headings. The page's own rows are joined back after.
  const narrow = body.replace(
    `SELECT ${TRACK_COLUMNS},`,
    `SELECT t.seq, t.id, t.folder, t.sort_title, t.sort_artist, t.sort_album,
      t.year, t.added_at, t.disc_no, t.track_no,`,
  );
  const terms: string[] = [];
  if (near !== undefined) {
    terms.push('near DESC');
  }
  if (markNeedle !== '') {
    terms.push('matched DESC');
  }
  if (query.sort !== undefined) {
    terms.push(
      ...directed(trackSortTerms(query.sort), query.direction === 'desc'),
    );
  } else if (searching && query.unranked !== true) {
    terms.push('score DESC');
  }
  terms.push(...(NATURAL_TERMS[query.natural ?? 'library'] ?? ['seq']));
  return {
    body,
    order: terms.join(', '),
    params,
    headings: query.folderHeadings === true,
    count,
    narrow,
  };
};

const countedSortTerms = (sort: TLibrarySort): string[] => {
  if (sort === 'added') {
    return ['added_at DESC', 'first_seq'];
  }
  if (sort === 'year') {
    // No year here; how much of the library it is, the next useful answer.
    return ['track_count DESC', 'first_seq'];
  }
  return ['sort_name', 'first_seq'];
};

/** A group shelf: its summary table, and how a track names its group. */
interface IGroupShelf {
  table: string;
  /** The track column holding the group's key, and any join that brings it. */
  memberKey: string;
  join?: string;
  sortTerms: (sort: TLibrarySort) => string[];
}

const GROUP_SHELVES: Record<
  'albums' | 'artists' | 'genres' | 'folders',
  IGroupShelf
> = {
  albums: {
    table: 'album_groups',
    memberKey: 't.album_key',
    sortTerms: (sort) => {
      if (sort === 'artist') {
        return ['sort_artist', 'sort_name', 'first_seq'];
      }
      if (sort === 'year') {
        return ['COALESCE(year, 0)', 'first_seq'];
      }
      if (sort === 'added') {
        return ['added_at DESC', 'first_seq'];
      }
      return ['sort_name', 'first_seq'];
    },
  },
  artists: {
    table: 'artist_groups',
    memberKey: 't.artist_key',
    sortTerms: countedSortTerms,
  },
  genres: {
    table: 'genre_groups',
    memberKey: 'g.genre_id',
    join: 'JOIN track_genres g ON g.track_id = t.id',
    sortTerms: countedSortTerms,
  },
  folders: {
    table: 'folder_groups',
    memberKey: 't.folder',
    sortTerms: countedSortTerms,
  },
};

/**
 * A shelf of groups: albums, artists, genres or every folder at once, read
 * from the summaries the store keeps (`libraryGroups.ts`).
 *
 * Standing in a folder lists the groups with a song beneath it — each whole,
 * as the album it is rather than the part of it filed there. Searching lists
 * every group with a match in it, whole (a compilation that came up for two
 * songs is still a compilation), best match first unless an order is asked
 * for, and the ones with a match beneath `near` ahead of the rest.
 */
const groupsPlan = (
  query: ILibraryListQuery,
  shelf: 'albums' | 'artists' | 'genres' | 'folders',
): ILibraryQueryPlan => {
  const shape = GROUP_SHELVES[shelf];
  const { params, bind } = binder();
  const needle = normalizeForGrouping(query.search ?? '');
  const searching = needle !== '';
  const near = searching ? query.near : undefined;
  const conditions = scopeConditions(query.scope, bind, near !== undefined);
  const members = `FROM tracks t ${shape.join ?? ''}
    ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}`;
  let body: string;
  if (searching) {
    const score = scoreSql(bind(needle));
    const nearFlag =
      near === undefined ? '0' : beneathSql('t.folder', near, bind);
    body = `
      WITH hits AS MATERIALIZED (
        SELECT ${shape.memberKey} AS hit_key, MAX(${score}) AS best,
          MAX(${nearFlag}) AS near_hit
        ${members} ${conditions.length ? 'AND' : 'WHERE'} ${score} > 0
        GROUP BY ${shape.memberKey}
      )
      SELECT s.*, h.best AS score, h.near_hit AS near
      FROM ${shape.table} s JOIN hits h ON h.hit_key = s.id`;
  } else if (conditions.length > 0) {
    body = `
      SELECT s.*, 0 AS score, 0 AS near FROM ${shape.table} s
      WHERE s.id IN (SELECT ${shape.memberKey} ${members})`;
  } else {
    body = `SELECT s.*, 0 AS score, 0 AS near FROM ${shape.table} s`;
  }
  const terms: string[] = [];
  if (near !== undefined) {
    terms.push('near DESC');
  }
  if (query.sort !== undefined) {
    terms.push(
      ...directed(shape.sortTerms(query.sort), query.direction === 'desc'),
    );
  } else if (searching) {
    terms.push('score DESC', 'first_seq');
  } else {
    terms.push('first_seq');
  }
  return {
    body,
    order: terms.join(', '),
    params,
    headings: false,
    count: `SELECT COUNT(*) AS n FROM (${body})`,
    narrow: body,
  };
};

/**
 * The folders directly inside `parent`, each summed over everything beneath
 * it (`folderChildren`), from the folders' own summaries: a count is a sum,
 * a cover the one the earliest of them found, pending only while all are.
 */
const childSegment = (column: string, prefix: string): string => {
  const rest = `substr(${column}, length(${prefix}) + 1)`;
  return `CASE WHEN instr(${rest}, '/') > 0
    THEN substr(${rest}, 1, instr(${rest}, '/') - 1) ELSE ${rest} END`;
};

const childrenPlan = (query: ILibraryListQuery): ILibraryQueryPlan => {
  const { params, bind } = binder();
  const parent = query.parent ?? '';
  const needle = normalizeForGrouping(query.search ?? '');
  const prefix = bind(`${parent}/`);
  const end = bind(`${parent}0`);
  const terms =
    query.sort === undefined
      ? ['first_seq']
      : directed(countedSortTerms(query.sort), query.direction === 'desc');
  if (needle !== '') {
    return searchedChildrenPlan(
      query,
      params,
      bind,
      prefix,
      end,
      needle,
      terms,
    );
  }
  const segment = childSegment('f.id', prefix);
  const body = `
    WITH beneath AS MATERIALIZED (
      SELECT f.*, ${prefix} || ${segment} AS child, ${segment} AS child_name
      FROM folder_groups f WHERE f.id >= ${prefix} AND f.id < ${end}
    ),
    stats AS (
      SELECT child AS id, MAX(child_name) AS list_title,
        SUM(track_count) AS track_count, MAX(added_at) AS added_at,
        MIN(all_pending) AS all_pending, MIN(first_seq) AS first_seq
      FROM beneath GROUP BY child
    ),
    arts AS (
      SELECT child AS art_group, MIN(art_seq) AS art_key, art_id
      FROM beneath WHERE art_id IS NOT NULL GROUP BY child
    )
    SELECT s.*, sort_key(s.list_title) AS sort_name, a.art_id,
      0 AS score, 0 AS near
    FROM stats s LEFT JOIN arts a ON a.art_group = s.id`;
  return {
    body,
    order: terms.join(', '),
    params,
    headings: false,
    count: `SELECT COUNT(*) AS n FROM (${body})`,
    narrow: body,
  };
};

/**
 * The same, searching: only what matches is counted, as the tree has always
 * narrowed to the way to the matches — summed from the matching songs, since
 * no summary knows which of its songs a query names.
 */
const searchedChildrenPlan = (
  query: ILibraryListQuery,
  params: Record<string, SQLInputValue>,
  bind: TBind,
  prefix: string,
  end: string,
  needle: string,
  terms: string[],
): ILibraryQueryPlan => {
  const conditions = scopeConditions(
    { ...query.scope, beneath: undefined },
    bind,
    true,
  );
  conditions.push(`t.folder >= ${prefix} AND t.folder < ${end}`);
  conditions.push(`${scoreSql(bind(needle))} > 0`);
  const segment = childSegment('t.folder', prefix);
  const body = `
    WITH kept AS MATERIALIZED (
      SELECT t.seq, t.art_id, t.added_at, t.is_pending,
        ${prefix} || ${segment} AS child, ${segment} AS child_name
      FROM tracks t WHERE ${conditions.join(' AND ')}
    ),
    stats AS (
      SELECT child AS id, MAX(child_name) AS list_title,
        COUNT(*) AS track_count, MAX(added_at) AS added_at,
        MIN(COALESCE(is_pending, 0)) AS all_pending, MIN(seq) AS first_seq
      FROM kept GROUP BY child
    ),
    arts AS (
      SELECT child AS art_group, MIN(seq) AS art_key, art_id
      FROM kept WHERE art_id IS NOT NULL GROUP BY child
    )
    SELECT s.*, sort_key(s.list_title) AS sort_name, a.art_id,
      0 AS score, 0 AS near
    FROM stats s LEFT JOIN arts a ON a.art_group = s.id`;
  return {
    body,
    order: terms.join(', '),
    params,
    headings: false,
    count: `SELECT COUNT(*) AS n FROM (${body})`,
    narrow: body,
  };
};

/**
 * The plan for any list but the roots, which are few enough, and ordered by a
 * list of their own, to be summed one by one (`libraryQuery.ts`).
 */
export const planLibraryList = (
  query: ILibraryListQuery,
): ILibraryQueryPlan => {
  if (query.shelf === 'tracks') {
    return tracksPlan(query);
  }
  if (query.shelf === 'children') {
    return childrenPlan(query);
  }
  if (query.shelf === 'roots') {
    throw new Error('The roots are summed by listRoots, not planned.');
  }
  return groupsPlan(query, query.shelf);
};
