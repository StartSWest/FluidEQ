/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * EVERY ALBUM, ARTIST, GENRE AND FOLDER, SUMMED ONCE — WHEN IT CHANGES.
 *
 * A shelf of albums is a thousand summaries of fourteen thousand songs.
 * Summing them per page cost a quarter to half a second of main's time on
 * Ivan's library, every page, every time a scan moved; and main is also the
 * thread that runs the windows and the audio engines. So each summary is a
 * row of its own, rewritten inside the same transaction as the tracks it
 * sums, and only for the groups that write touched: a scan batch of 25 songs
 * re-sums at most 25 albums. A shelf page is then a read off an index.
 *
 * What a summary IS stays `groupIntoAlbums`, `groupIntoArtists`,
 * `groupIntoGenres` and `groupIntoFolders`: the first track's name and
 * spelling (album order for an album, the order the library learned them in
 * otherwise), the first year and cover that exist in that order, the count,
 * the length, the newest addition, and pending only while every member is.
 */

import type { DatabaseSync } from 'node:sqlite';

export const GROUP_SCHEMA = `
  CREATE TABLE IF NOT EXISTS album_groups (
    id TEXT PRIMARY KEY,
    list_title TEXT NOT NULL,
    artist_name TEXT NOT NULL,
    sort_name TEXT NOT NULL,
    sort_artist TEXT NOT NULL,
    year REAL,
    art_id TEXT,
    track_count INTEGER NOT NULL,
    duration_ms REAL NOT NULL,
    added_at REAL NOT NULL,
    all_pending INTEGER NOT NULL,
    first_seq INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS album_groups_name ON album_groups (sort_name, first_seq);
  CREATE TABLE IF NOT EXISTS artist_groups (
    id TEXT PRIMARY KEY,
    list_title TEXT NOT NULL,
    sort_name TEXT NOT NULL,
    album_count INTEGER NOT NULL,
    track_count INTEGER NOT NULL,
    art_id TEXT,
    added_at REAL NOT NULL,
    all_pending INTEGER NOT NULL,
    first_seq INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS artist_groups_name ON artist_groups (sort_name, first_seq);
  CREATE TABLE IF NOT EXISTS genre_groups (
    id TEXT PRIMARY KEY,
    list_title TEXT NOT NULL,
    sort_name TEXT NOT NULL,
    artist_count INTEGER NOT NULL,
    track_count INTEGER NOT NULL,
    art_id TEXT,
    added_at REAL NOT NULL,
    all_pending INTEGER NOT NULL,
    first_seq INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS folder_groups (
    id TEXT PRIMARY KEY,
    list_title TEXT NOT NULL,
    sort_name TEXT NOT NULL,
    track_count INTEGER NOT NULL,
    art_id TEXT,
    -- The seq of the first track with a cover, so a folder above several can
    -- take the cover the earliest of them found (\`summarise\`).
    art_seq INTEGER,
    added_at REAL NOT NULL,
    all_pending INTEGER NOT NULL,
    first_seq INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS folder_groups_name ON folder_groups (sort_name, first_seq);
`;

/** The keys a set of track rows is summed under. */
export interface IGroupKeys {
  albums: Set<string>;
  artists: Set<string>;
  genres: Set<string>;
  folders: Set<string>;
}

export const emptyGroupKeys = (): IGroupKeys => ({
  albums: new Set(),
  artists: new Set(),
  genres: new Set(),
  folders: new Set(),
});

/**
 * Every group these tracks are in right now — asked before a write (the
 * groups they leave) and after it (the groups they join).
 */
export const collectGroupKeys = (
  database: DatabaseSync,
  trackIds: readonly string[],
  into: IGroupKeys,
): void => {
  if (trackIds.length === 0) {
    return;
  }
  const ids = JSON.stringify(trackIds);
  const rows = database
    .prepare(
      `SELECT t.album_key, t.artist_key, t.folder FROM json_each(?) AS listed
       JOIN tracks t ON t.id = listed.value`,
    )
    .all(ids);
  rows.forEach((row) => {
    into.albums.add(String(row.album_key));
    into.artists.add(String(row.artist_key));
    into.folders.add(String(row.folder));
  });
  database
    .prepare(
      `SELECT DISTINCT g.genre_id FROM json_each(?) AS listed
       JOIN track_genres g ON g.track_id = listed.value`,
    )
    .all(ids)
    .forEach((row) => into.genres.add(String(row.genre_id)));
};

/** A number as text that sorts as the number does, negatives included. */
const sortableNumber = (column: string, fallback: number): string =>
  `printf('%020.6f', COALESCE(${column}, ${fallback}) + 1000000000)`;

const SEQ_KEY = "printf('%015d', t.seq)";

/** `compareTracksInAlbum`: disc, then number, then title, then learned. */
const ALBUM_KEY = `${sortableNumber('t.disc_no', 1)} || ${sortableNumber(
  't.track_no',
  0,
)} || t.sort_title || char(1) || ${SEQ_KEY}`;

interface IGroupTable {
  table: string;
  /** The members' key column, and any join that brings it. */
  key: string;
  join?: string;
  /** Sorts a group's members; the least is its "first" track. */
  orderKey: string;
  /** The first track's columns, as the table names them. */
  firstColumns: string;
  firstNames: string;
  /** Extra aggregates, and their table columns. */
  statColumns: string;
  statNames: string;
  hasYear: boolean;
  hasArtSeq: boolean;
}

const TABLES: Record<keyof IGroupKeys, IGroupTable> = {
  albums: {
    table: 'album_groups',
    key: 't.album_key',
    orderKey: ALBUM_KEY,
    firstColumns: `COALESCE(t.album, '') AS list_title,
      COALESCE(t.album_artist, t.artist, '') AS artist_name,
      t.sort_album AS sort_name, t.sort_shelf_artist AS sort_artist`,
    firstNames: 'list_title, artist_name, sort_name, sort_artist',
    statColumns: ', SUM(COALESCE(t.duration_ms, 0)) AS duration_ms',
    statNames: ', duration_ms',
    hasYear: true,
    hasArtSeq: false,
  },
  artists: {
    table: 'artist_groups',
    key: 't.artist_key',
    orderKey: SEQ_KEY,
    firstColumns: `COALESCE(t.album_artist, t.artist, '') AS list_title,
      t.sort_shelf_artist AS sort_name`,
    firstNames: 'list_title, sort_name',
    statColumns: ', COUNT(DISTINCT t.sort_album) AS album_count',
    statNames: ', album_count',
    hasYear: false,
    hasArtSeq: false,
  },
  genres: {
    table: 'genre_groups',
    key: 'g.genre_id',
    join: 'JOIN track_genres g ON g.track_id = t.id',
    orderKey: SEQ_KEY,
    firstColumns: 'g.genre_name AS list_title, g.sort_name AS sort_name',
    firstNames: 'list_title, sort_name',
    statColumns: ', COUNT(DISTINCT t.group_artist) AS artist_count',
    statNames: ', artist_count',
    hasYear: false,
    hasArtSeq: false,
  },
  folders: {
    table: 'folder_groups',
    key: 't.folder',
    orderKey: SEQ_KEY,
    firstColumns:
      't.folder_name AS list_title, t.sort_folder_name AS sort_name',
    firstNames: 'list_title, sort_name',
    statColumns: '',
    statNames: '',
    hasYear: false,
    hasArtSeq: true,
  },
};

/**
 * Re-sums the named groups of one kind from their members. A group with no
 * members left is simply gone.
 */
const refreshTable = (
  database: DatabaseSync,
  shape: IGroupTable,
  keys: ReadonlySet<string>,
): void => {
  if (keys.size === 0) {
    return;
  }
  const json = JSON.stringify([...keys]);
  database
    .prepare(
      `DELETE FROM ${shape.table} WHERE id IN (SELECT value FROM json_each(?))`,
    )
    .run(json);
  const from = `FROM tracks t ${shape.join ?? ''}
    WHERE ${shape.key} IN (SELECT value FROM json_each($keys))`;
  // One MIN() per SELECT, so the columns beside it are that row's — SQLite's
  // own rule for a bare column in an aggregate.
  database
    .prepare(
      `WITH stats AS (
        SELECT ${shape.key} AS id, COUNT(*) AS track_count,
          MAX(t.added_at) AS added_at,
          MIN(COALESCE(t.is_pending, 0)) AS all_pending,
          MIN(t.seq) AS first_seq ${shape.statColumns}
        ${from} GROUP BY ${shape.key}
      ),
      firsts AS (
        SELECT ${shape.key} AS first_id, MIN(${shape.orderKey}) AS first_key,
          ${shape.firstColumns}
        ${from} GROUP BY ${shape.key}
      ),
      ${
        shape.hasYear
          ? `years AS (
        SELECT ${shape.key} AS year_id, MIN(${shape.orderKey}) AS year_key, t.year
        ${from} AND t.year IS NOT NULL GROUP BY ${shape.key}
      ),`
          : ''
      }
      arts AS (
        SELECT ${shape.key} AS art_group, MIN(${shape.orderKey}) AS art_key,
          t.art_id, t.seq AS art_seq
        ${from} AND t.art_id IS NOT NULL GROUP BY ${shape.key}
      )
      INSERT INTO ${shape.table} (
        id, ${shape.firstNames}, ${shape.hasYear ? 'year,' : ''} art_id,
        ${shape.hasArtSeq ? 'art_seq,' : ''} track_count
        ${shape.statNames}, added_at, all_pending, first_seq
      )
      SELECT s.id, ${shape.firstNames
        .split(',')
        .map((name) => `f.${name.trim()}`)
        .join(', ')},
        ${shape.hasYear ? 'y.year,' : ''} a.art_id,
        ${shape.hasArtSeq ? 'a.art_seq,' : ''} s.track_count
        ${shape.statNames
          .split(',')
          .filter((name) => name.trim())
          .map((name) => `, s.${name.trim()}`)
          .join('')},
        s.added_at, s.all_pending, s.first_seq
      FROM stats s
      JOIN firsts f ON f.first_id = s.id
      ${shape.hasYear ? 'LEFT JOIN years y ON y.year_id = s.id' : ''}
      LEFT JOIN arts a ON a.art_group = s.id`,
    )
    .run({ $keys: json });
};

/** Re-sums every group named, of every kind. */
export const refreshGroups = (
  database: DatabaseSync,
  keys: IGroupKeys,
): void => {
  (Object.keys(TABLES) as (keyof IGroupKeys)[]).forEach((kind) => {
    refreshTable(database, TABLES[kind], keys[kind]);
  });
};

/** Every group, from nothing: the first open of a store, or its repair. */
export const rebuildGroups = (database: DatabaseSync): void => {
  const keys = emptyGroupKeys();
  database
    .prepare('SELECT DISTINCT album_key, artist_key, folder FROM tracks')
    .all()
    .forEach((row) => {
      keys.albums.add(String(row.album_key));
      keys.artists.add(String(row.artist_key));
      keys.folders.add(String(row.folder));
    });
  database
    .prepare('SELECT DISTINCT genre_id FROM track_genres')
    .all()
    .forEach((row) => keys.genres.add(String(row.genre_id)));
  (Object.keys(TABLES) as (keyof IGroupKeys)[]).forEach((kind) => {
    database.exec(`DELETE FROM ${TABLES[kind].table}`);
  });
  refreshGroups(database, keys);
};
