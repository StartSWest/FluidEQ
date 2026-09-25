/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The questions about songs by id rather than about a list: the songs a
 * queue or a panel holds, what to keep playing after a seed, and how long a
 * run of them lasts. Every answer is the store's; nothing is kept here.
 */

import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import { UNKNOWN_GENRE_ID } from '../../common/library/genres';
import type { ILibraryTrack } from '../../common/library/types';
import { TRACK_SELECT, trackFromRow, type TStoreRow } from './libraryStoreRows';

const text = (value: unknown): string =>
  typeof value === 'string' ? value : '';

export interface ILibraryTrackQuestions {
  readonly tracks: (trackIds: readonly string[]) => ILibraryTrack[];
  readonly continuation: (
    seedId: string,
    exclude: readonly string[],
    count: number,
  ) => string[];
  readonly duration: (trackIds: readonly string[]) => number;
}

export const createTrackQuestions = (
  database: DatabaseSync,
): ILibraryTrackQuestions => {
  /** A statement that lets a parameter it has no use for go unbound: the two
   * continuation questions share one set, and each reads only some of it. */
  const prepare = (sql: string) => {
    const statement = database.prepare(sql);
    statement.setAllowUnknownNamedParameters(true);
    return statement;
  };

  const run = (sql: string, params: Record<string, SQLInputValue>) =>
    prepare(sql).all(params) as TStoreRow[];

  const one = (sql: string, params: Record<string, SQLInputValue>) =>
    prepare(sql).get(params) as TStoreRow | undefined;

  const tracks = (trackIds: readonly string[]): ILibraryTrack[] =>
    run(
      `SELECT ${TRACK_SELECT} FROM json_each($ids) AS listed
       JOIN tracks t ON t.id = listed.value ORDER BY listed.key`,
      { $ids: JSON.stringify(trackIds) },
    ).map(trackFromRow);

  /**
   * `pickContinuation`: the seed's real genres, or for an untagged seed its
   * artist; audio this build can play, not the seed, none of `exclude`; at
   * random. SQLite's own `random()` is the draw — the pool never leaves the
   * store.
   */
  const continuation = (
    seedId: string,
    exclude: readonly string[],
    count: number,
  ): string[] => {
    if (count <= 0) {
      return [];
    }
    const candidate = `t.id <> $seed AND t.kind = 'audio' AND t.is_playable = 1
      AND t.id NOT IN (SELECT value FROM json_each($exclude))`;
    const params = {
      $seed: seedId,
      $exclude: JSON.stringify(exclude),
      $count: count,
      $unknown: UNKNOWN_GENRE_ID,
    };
    const genres = run(
      `SELECT genre_id FROM track_genres WHERE track_id = $seed AND genre_id <> $unknown`,
      { $seed: seedId, $unknown: UNKNOWN_GENRE_ID },
    );
    if (genres.length > 0) {
      return run(
        `SELECT t.id FROM tracks t WHERE ${candidate}
           AND t.id IN (
             SELECT track_id FROM track_genres WHERE genre_id IN (
               SELECT genre_id FROM track_genres
               WHERE track_id = $seed AND genre_id <> $unknown))
         ORDER BY random() LIMIT $count`,
        params,
      ).map((row) => text(row.id));
    }
    return run(
      `SELECT t.id FROM tracks t
       JOIN tracks seed ON seed.id = $seed AND seed.artist_key <> ''
       WHERE ${candidate} AND t.artist_key = seed.artist_key
       ORDER BY random() LIMIT $count`,
      params,
    ).map((row) => text(row.id));
  };

  const duration = (trackIds: readonly string[]): number =>
    Number(
      one(
        `SELECT COALESCE(SUM(COALESCE(t.duration_ms, 0)), 0) AS total
         FROM json_each($ids) AS listed JOIN tracks t ON t.id = listed.value`,
        { $ids: JSON.stringify(trackIds) },
      )?.total ?? 0,
    );

  return { tracks, continuation, duration };
};
