/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * THE LIBRARY, ON DISK AND NOWHERE ELSE.
 *
 * It was a JSON file read whole into main at launch, sent whole to the window,
 * and held twice for the life of the process — fourteen thousand songs, ten
 * megabytes of text, rewritten in full every time one song's loudness was
 * measured. Ivan: "we cannot load all in the ram, no never" (2026-09-23).
 *
 * Now it is a SQLite database (`node:sqlite`, built into Electron's Node — no
 * native module to rebuild), and nothing reads it whole: every shelf, record,
 * search and lookup is a query that returns what is on screen
 * (`libraryQuery.ts`). SQLite keeps its own small page cache; the library
 * itself stays on disk.
 *
 * ONE WRITER. This module, in main. The scan worker opens the same file
 * read-only to ask what it already knows (`openLibraryReader`), which WAL
 * allows while main writes.
 *
 * Every write bumps `version`, the number the window is told on
 * `library-changed` so it re-asks for what it is showing.
 */

import {
  DatabaseSync,
  type SQLInputValue,
  type StatementSync,
} from 'node:sqlite';
import type {
  ILibraryNormalizationAnalysis,
  ILibraryRoot,
  ILibraryTrack,
} from '../../common/library/types';
import {
  collectGroupKeys,
  emptyGroupKeys,
  refreshGroups,
} from './libraryGroups';
import { TRACK_UPSERT } from './libraryStoreSchema';
import {
  rootFromRow,
  sortKey,
  TRACK_SELECT,
  trackFromRow,
  trackGenreRows,
  trackParameters,
  type TStoreRow,
} from './libraryStoreRows';

export interface ILibraryStore {
  /** Bumped by every write; what `library-changed` tells the window. */
  readonly version: () => number;
  readonly database: DatabaseSync;
  readonly roots: () => ILibraryRoot[];
  readonly root: (rootId: string) => ILibraryRoot | undefined;
  readonly addRoots: (roots: readonly ILibraryRoot[]) => void;
  readonly setRoot: (rootId: string, patch: Partial<ILibraryRoot>) => void;
  /** The root and every track under it. */
  readonly removeRoot: (rootId: string) => void;
  readonly track: (trackId: string) => ILibraryTrack | undefined;
  readonly trackByPath: (trackPath: string) => ILibraryTrack | undefined;
  readonly trackPath: (trackId: string) => string | undefined;
  readonly trackCount: () => number;
  readonly videoCount: () => number;
  /**
   * Writes tracks, new or known. A known one keeps its place in the order the
   * library learned it (ties in every sort) and a loudness measurement its
   * bytes still match. `scanMark` confirms them for the scan that wrote them;
   * zero leaves them unconfirmed (see `sweepRoot`).
   */
  readonly upsertTracks: (
    tracks: readonly ILibraryTrack[],
    scanMark: number,
  ) => void;
  /** Tracks a scan found unchanged: confirmed without being rewritten. */
  readonly confirmTracks: (
    trackIds: readonly string[],
    scanMark: number,
  ) => void;
  /** A new scan: the mark every file it finds is confirmed with. */
  readonly beginScan: () => number;
  /**
   * The end of a finished scan: every track of the root it did not confirm
   * is gone from the disk. Not called for a cancelled scan, which keeps what
   * it never reached.
   */
  readonly sweepRoot: (rootId: string, scanMark: number) => void;
  readonly rootTrackCount: (rootId: string) => number;
  /** A loudness measurement, stored only while the file is the one measured. */
  readonly setNormalization: (
    trackId: string,
    analysis: ILibraryNormalizationAnalysis,
    signature: { sizeBytes: number; mtimeMs: number },
  ) => ILibraryTrack | undefined;
  readonly close: () => void;
}

/** Runs `write` in one transaction: all of it lands, or none of it. */
export const inTransaction = (
  database: DatabaseSync,
  write: () => void,
): void => {
  database.exec('BEGIN IMMEDIATE');
  try {
    write();
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
};

export const createStore = (database: DatabaseSync): ILibraryStore => {
  // The sort key a query needs for a name it works out itself — a folder
  // one level down, a file path — rather than one stored on the row. The same
  // fold the stored `sort_*` columns hold (`sortKey`).
  database.function('sort_key', { deterministic: true }, (value) =>
    sortKey(typeof value === 'string' ? value : ''),
  );
  let version = 0;
  const statements = new Map<string, StatementSync>();
  const statement = (sql: string): StatementSync => {
    const existing = statements.get(sql);
    if (existing) {
      return existing;
    }
    const prepared = database.prepare(sql);
    statements.set(sql, prepared);
    return prepared;
  };
  const changed = (): void => {
    version += 1;
  };

  const writeGenres = (track: ILibraryTrack): void => {
    statement('DELETE FROM track_genres WHERE track_id = ?').run(track.id);
    const insert = statement(
      'INSERT OR IGNORE INTO track_genres (track_id, genre_id, genre_name, sort_name) VALUES (?, ?, ?, ?)',
    );
    trackGenreRows(track).forEach(({ genreId, genreName }) => {
      insert.run(track.id, genreId, genreName, sortKey(genreName));
    });
  };

  const upsertTracks = (
    tracks: readonly ILibraryTrack[],
    scanMark: number,
  ): void => {
    if (tracks.length === 0) {
      return;
    }
    inTransaction(database, () => {
      const ids = tracks.map((entry) => entry.id);
      // The groups these songs leave (a retagged album), then the ones they
      // join, re-summed in the same transaction as the songs themselves.
      const touched = emptyGroupKeys();
      collectGroupKeys(database, ids, touched);
      const upsert = statement(TRACK_UPSERT);
      tracks.forEach((track) => {
        upsert.run(trackParameters(track, scanMark));
        writeGenres(track);
      });
      collectGroupKeys(database, ids, touched);
      refreshGroups(database, touched);
    });
    changed();
  };

  /**
   * Deletes the tracks `where` names, and re-sums the groups they leave.
   * Answers how many went, so a sweep that found nothing tells nobody.
   */
  const deleteTracks = (where: string, ...values: SQLInputValue[]): number => {
    const touched = emptyGroupKeys();
    collectGroupKeys(
      database,
      (
        database
          .prepare(`SELECT id FROM tracks WHERE ${where}`)
          .all(...values) as TStoreRow[]
      ).map((row) => String(row.id)),
      touched,
    );
    database
      .prepare(
        `DELETE FROM track_genres WHERE track_id IN (SELECT id FROM tracks WHERE ${where})`,
      )
      .run(...values);
    const { changes } = database
      .prepare(`DELETE FROM tracks WHERE ${where}`)
      .run(...values);
    refreshGroups(database, touched);
    return Number(changes);
  };

  const track = (trackId: string): ILibraryTrack | undefined => {
    const row = statement(
      `SELECT ${TRACK_SELECT} FROM tracks t WHERE t.id = ?`,
    ).get(trackId) as TStoreRow | undefined;
    return row ? trackFromRow(row) : undefined;
  };

  return {
    version: () => version,
    database,
    roots: () =>
      (
        statement('SELECT * FROM roots ORDER BY position').all() as TStoreRow[]
      ).map(rootFromRow),
    root: (rootId) => {
      const row = statement('SELECT * FROM roots WHERE id = ?').get(rootId) as
        TStoreRow | undefined;
      return row ? rootFromRow(row) : undefined;
    },
    addRoots: (roots) => {
      if (roots.length === 0) {
        return;
      }
      inTransaction(database, () => {
        const insert = statement(`
          INSERT OR IGNORE INTO roots (
            id, path, added_at, last_scan_at, is_offline, track_count,
            karaoke_skipped, position
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?,
            (SELECT COALESCE(MAX(position), -1) + 1 FROM roots)
          )`);
        roots.forEach((root) => {
          insert.run(
            root.id,
            root.path,
            root.addedAt,
            root.lastScanAt ?? null,
            root.isOffline === undefined ? null : Number(root.isOffline),
            root.trackCount,
            root.karaokeSkipped,
          );
        });
      });
      changed();
    },
    setRoot: (rootId, patch) => {
      const columns: [string, number | string | null][] = [];
      if (patch.path !== undefined) {
        columns.push(['path', patch.path]);
      }
      if (patch.lastScanAt !== undefined) {
        columns.push(['last_scan_at', patch.lastScanAt]);
      }
      if (patch.isOffline !== undefined) {
        columns.push(['is_offline', Number(patch.isOffline)]);
      }
      if (patch.trackCount !== undefined) {
        columns.push(['track_count', patch.trackCount]);
      }
      if (patch.karaokeSkipped !== undefined) {
        columns.push(['karaoke_skipped', patch.karaokeSkipped]);
      }
      if (columns.length === 0) {
        return;
      }
      database
        .prepare(
          `UPDATE roots SET ${columns
            .map(([column]) => `${column} = ?`)
            .join(', ')} WHERE id = ?`,
        )
        .run(...columns.map(([, value]) => value), rootId);
      changed();
    },
    removeRoot: (rootId) => {
      inTransaction(database, () => {
        deleteTracks('root_id = ?', rootId);
        statement('DELETE FROM roots WHERE id = ?').run(rootId);
      });
      changed();
    },
    track,
    trackByPath: (trackPath) => {
      const row = statement(
        `SELECT ${TRACK_SELECT} FROM tracks t WHERE t.path = ?`,
      ).get(trackPath) as TStoreRow | undefined;
      return row ? trackFromRow(row) : undefined;
    },
    trackPath: (trackId) => {
      const row = statement('SELECT path FROM tracks WHERE id = ?').get(
        trackId,
      ) as TStoreRow | undefined;
      return typeof row?.path === 'string' ? row.path : undefined;
    },
    trackCount: () =>
      Number(
        (statement('SELECT COUNT(*) AS n FROM tracks').get() as TStoreRow).n,
      ),
    videoCount: () =>
      Number(
        (
          statement(
            "SELECT COUNT(*) AS n FROM tracks WHERE kind = 'video'",
          ).get() as TStoreRow
        ).n,
      ),
    upsertTracks,
    confirmTracks: (trackIds, scanMark) => {
      if (trackIds.length === 0) {
        return;
      }
      inTransaction(database, () => {
        const confirm = statement(
          'UPDATE tracks SET scan_mark = ? WHERE id = ?',
        );
        trackIds.forEach((trackId) => confirm.run(scanMark, trackId));
      });
    },
    // ONE COUNTER FOR THE WHOLE LIBRARY, not one per root. A confirmation
    // keeps the higher of two marks (`TRACK_UPSERT`), and with a counter per
    // root a song that changed root carried its old root's higher number into
    // the new one and was swept as unconfirmed.
    beginScan: () => {
      statement(
        `INSERT INTO meta (key, value) VALUES ('scan_mark', '1')
         ON CONFLICT (key) DO UPDATE SET value = CAST(value AS INTEGER) + 1`,
      ).run();
      const row = statement(
        "SELECT value FROM meta WHERE key = 'scan_mark'",
      ).get() as TStoreRow | undefined;
      return Number(row?.value ?? 0);
    },
    sweepRoot: (rootId, scanMark) => {
      let swept = 0;
      inTransaction(database, () => {
        swept = deleteTracks(
          'root_id = ? AND scan_mark <> ?',
          rootId,
          scanMark,
        );
      });
      if (swept > 0) {
        changed();
      }
    },
    rootTrackCount: (rootId) =>
      Number(
        (
          statement('SELECT COUNT(*) AS n FROM tracks WHERE root_id = ?').get(
            rootId,
          ) as TStoreRow
        ).n,
      ),
    setNormalization: (trackId, analysis, signature) => {
      const result = statement(
        `UPDATE tracks SET size_bytes = ?, mtime_ms = ?, normalization = ?
         WHERE id = ? AND kind = 'audio'`,
      ).run(
        signature.sizeBytes,
        signature.mtimeMs,
        JSON.stringify(analysis),
        trackId,
      );
      if (Number(result.changes) === 0) {
        return undefined;
      }
      changed();
      return track(trackId);
    },
    close: () => {
      database.close();
    },
  };
};
