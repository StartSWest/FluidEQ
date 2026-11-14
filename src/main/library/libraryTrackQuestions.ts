/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The questions about songs by id rather than about a list: the songs a
 * queue or a panel holds, what to keep playing after a seed, what to start
 * when somebody asks to be surprised, and how long a run of them lasts.
 * Every answer is the store's; nothing is kept here.
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
  readonly surprise: (
    playing: string | undefined,
    awayFrom: readonly string[],
    exclude: readonly string[],
  ) => string | null;
  readonly coverDeck: (count: number, exclude: readonly string[]) => string[];
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

  /**
   * A song to start somewhere new: Surprise me, in the Library (Ivan,
   * 2026-11-13: "a nice surprise play button ... when the user clicks
   * Surprise me again it changes to another random song from the library,
   * which may change the genre").
   *
   * A GENRE FIRST, THEN A SONG IN IT. A song drawn straight from the whole
   * library lands in whatever genre owns most of it, so on a library that is
   * half rock nearly every other press would be rock again; drawing the
   * genre first gives a genre of twenty songs the same chance as one of two
   * thousand, which is what makes a press feel like a surprise.
   *
   * ONLY A SONG UP NEXT CAN FOLLOW: one with a real genre, or for an untagged
   * one an artist — what Keep playing carries on from (`pickContinuation`).
   * Untagged songs with an artist share the unknown genre's turn. Audio this
   * build can play, on a drive that is plugged in: a surprise that cannot
   * sound is a press that did nothing.
   *
   * Each rung only when the one before has nothing: away from the genres of
   * `awayFrom` (the song playing and the last surprises); away from the
   * playing song's genres; any genre; any song not in `exclude`; any song
   * but the one playing; and last the one playing, so a library of one song
   * starts it again rather than answering a press with nothing. Null only
   * when nothing in the library can play. SQLite's own `random()` is the
   * draw — the pool never leaves the store.
   */
  const surprise = (
    playing: string | undefined,
    awayFrom: readonly string[],
    exclude: readonly string[],
  ): string | null => {
    const audio = `t.kind = 'audio' AND t.is_playable = 1
      AND t.root_id NOT IN (SELECT id FROM roots WHERE is_offline = 1)`;
    const playable = `${audio} AND t.id <> $playing`;
    const fresh = `t.id NOT IN (SELECT value FROM json_each($exclude))`;
    const seedable = `(g.genre_id <> $unknown OR t.artist_key <> '')`;
    const awayGenresOf = (list: string) => `AND NOT EXISTS (
      SELECT 1 FROM track_genres a WHERE a.track_id = t.id AND a.genre_id IN (
        SELECT genre_id FROM track_genres
        WHERE track_id IN (SELECT value FROM json_each(${list}))))`;
    const params = {
      $playing: playing ?? '',
      $exclude: JSON.stringify(exclude),
      $unknown: UNKNOWN_GENRE_ID,
      $away: JSON.stringify(awayFrom),
      $awayPlaying: JSON.stringify(playing === undefined ? [] : [playing]),
    };
    const byGenre = (away: string): string | undefined => {
      const where = `${playable} AND ${fresh} AND ${seedable} ${away}`;
      const genre = one(
        `SELECT g.genre_id AS genre FROM track_genres g
         JOIN tracks t ON t.id = g.track_id
         WHERE ${where} GROUP BY g.genre_id ORDER BY random() LIMIT 1`,
        params,
      );
      if (!genre) {
        return undefined;
      }
      const song = one(
        `SELECT t.id FROM track_genres g JOIN tracks t ON t.id = g.track_id
         WHERE g.genre_id = $genre AND ${where} ORDER BY random() LIMIT 1`,
        { ...params, $genre: text(genre.genre) },
      );
      return song ? text(song.id) : undefined;
    };
    const anySong = (where: string): string | undefined => {
      const song = one(
        `SELECT t.id FROM tracks t WHERE ${where} ORDER BY random() LIMIT 1`,
        params,
      );
      return song ? text(song.id) : undefined;
    };
    return (
      byGenre(awayGenresOf('$away')) ??
      byGenre(awayGenresOf('$awayPlaying')) ??
      byGenre('') ??
      anySong(`${playable} AND ${fresh}`) ??
      anySong(playable) ??
      anySong(audio) ??
      null
    );
  };

  /**
   * The covers Surprise me's draw spins past: different pictures at random,
   * from songs (a video's poster is not a record), none of `exclude`. Each
   * picture once however many songs share it, so an album of twenty tracks
   * is one card, not twenty — and a couple of dozen of them, never the
   * library's covers.
   */
  const coverDeck = (count: number, exclude: readonly string[]): string[] =>
    count <= 0
      ? []
      : run(
          `SELECT t.art_id AS art FROM tracks t
           WHERE t.kind = 'audio' AND t.art_id IS NOT NULL AND t.art_id <> ''
             AND t.art_id NOT IN (SELECT value FROM json_each($exclude))
           GROUP BY t.art_id ORDER BY random() LIMIT $count`,
          { $exclude: JSON.stringify(exclude), $count: count },
        ).map((row) => text(row.art));

  const duration = (trackIds: readonly string[]): number =>
    Number(
      one(
        `SELECT COALESCE(SUM(COALESCE(t.duration_ms, 0)), 0) AS total
         FROM json_each($ids) AS listed JOIN tracks t ON t.id = listed.value`,
        { $ids: JSON.stringify(trackIds) },
      )?.total ?? 0,
    );

  return { tracks, continuation, surprise, coverDeck, duration };
};
