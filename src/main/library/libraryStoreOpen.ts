/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Opening the store: the file, its first-time move from the JSON index, a
 * damaged file set aside, and the scan worker's read-only view of it.
 */

import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import type { ILibraryTrack } from '../../common/library/types';
import { GROUP_SCHEMA, rebuildGroups } from './libraryGroups';
import { libraryIndexPath, loadLibraryIndex } from './libraryIndex';
import { createStore, type ILibraryStore, inTransaction } from './libraryStore';
import { SCHEMA, SCHEMA_VERSION, STORE_FILENAME } from './libraryStoreSchema';
import { TRACK_SELECT, trackFromRow, type TStoreRow } from './libraryStoreRows';

export interface IOpenedLibraryStore {
  store: ILibraryStore;
  /** The library could not be read and was started again empty. */
  wasReset: boolean;
}

export const libraryStorePath = (userDataDir: string): string =>
  path.join(userDataDir, STORE_FILENAME);

const configure = (database: DatabaseSync): void => {
  // WAL: the scan worker reads while main writes, and neither waits on the
  // other. NORMAL is WAL's own recommended durability: a power cut can lose
  // the last moment of a scan, which the next scan puts back; it cannot
  // corrupt the file.
  database.exec('PRAGMA journal_mode = WAL');
  database.exec('PRAGMA synchronous = NORMAL');
  database.exec('PRAGMA foreign_keys = OFF');
};

const schemaVersionOf = (database: DatabaseSync): number | undefined => {
  const row = database
    .prepare("SELECT value FROM meta WHERE key = 'schema'")
    .get() as TStoreRow | undefined;
  return row === undefined ? undefined : Number(row.value);
};

/**
 * The JSON index this replaced, read once and moved in.
 *
 * All of it in one transaction, and the file renamed aside afterwards rather
 * than deleted — `library-index.migrated.json` is the one copy of the library
 * that existed before the store, kept for a person to recover by hand. A store
 * that later fails to open does not go back to it: it starts empty and says
 * so (`wasReset`), and a rescan puts the songs back as they are now.
 */
const importJsonIndex = (
  store: ILibraryStore,
  database: DatabaseSync,
  userDataDir: string,
): boolean => {
  const loaded = loadLibraryIndex(userDataDir);
  store.addRoots(loaded.index.roots);
  // Mark zero: nothing is confirmed until a scan says so, which is the same
  // as every track the JSON held — the launch rescan confirms or sweeps them.
  store.upsertTracks(loaded.index.tracks, 0);
  database
    .prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('schema', ?)")
    .run(String(SCHEMA_VERSION));
  // The upsert above summed every group it touched, which is all of them.
  database
    .prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('groups', '1')")
    .run();
  const jsonPath = libraryIndexPath(userDataDir);
  if (fs.existsSync(jsonPath)) {
    fs.renameSync(jsonPath, jsonPath.replace(/\.json$/, '.migrated.json'));
  }
  return loaded.wasReset;
};

/**
 * Opens and prepares the file, and proves it can be read: a count walks the
 * table, so a damaged file fails here rather than in the middle of a scan.
 * Closed again on the way out of a failure — Windows will not rename a file
 * a handle is still open on, and the caller's next move is to set it aside.
 */
const openDatabase = (file: string): DatabaseSync => {
  const database = new DatabaseSync(file);
  try {
    configure(database);
    database.exec(SCHEMA);
    database.exec(GROUP_SCHEMA);
    database.prepare('SELECT COUNT(*) FROM tracks').get();
    return database;
  } catch (error) {
    database.close();
    throw error;
  }
};

/**
 * Opens the store, creating it — and moving the old JSON index into it — the
 * first time.
 *
 * A file SQLite cannot read is renamed aside (`.bak`, the most recent one
 * kept) and the library starts again empty with `wasReset`, which the window
 * says out loud: a rescan puts the songs back, and nothing else would explain
 * where they went.
 */
/**
 * The file, set aside and started again when SQLite cannot read it — or, when
 * not even a fresh one can be made (a folder the app may not write, a full
 * disk), a library held in memory for this session. The app starts either
 * way: this runs before the window exists, and a throw here was an app that
 * would not open at all. The in-memory library is empty and says so
 * (`wasReset`); a rescan fills it for the session.
 */
const openFile = (
  userDataDir: string,
): { database: DatabaseSync; wasReset: boolean; isInMemory: boolean } => {
  const file = libraryStorePath(userDataDir);
  try {
    fs.mkdirSync(userDataDir, { recursive: true });
    return { database: openDatabase(file), wasReset: false, isInMemory: false };
  } catch (error) {
    // eslint-disable-next-line no-console -- this project's one sanctioned console sink; see libraryIndex.ts
    console.error(`Could not open the library store at ${file}`, error);
  }
  try {
    ['', '-wal', '-shm'].forEach((suffix) => {
      if (fs.existsSync(`${file}${suffix}`)) {
        fs.renameSync(`${file}${suffix}`, `${file}${suffix}.bak`);
      }
    });
    return { database: openDatabase(file), wasReset: true, isInMemory: false };
  } catch (error) {
    // eslint-disable-next-line no-console -- this project's one sanctioned console sink; see libraryIndex.ts
    console.error(
      `Could not make a new library store at ${file}; this session's library is held in memory`,
      error,
    );
    return {
      database: openDatabase(':memory:'),
      wasReset: true,
      isInMemory: true,
    };
  }
};

export const openLibraryStore = (userDataDir: string): IOpenedLibraryStore => {
  const opened = openFile(userDataDir);
  const { database } = opened;
  let { wasReset } = opened;
  const store = createStore(database);
  // Never into a library held in memory: the JSON index is renamed aside once
  // it has been moved, and a store gone by the next launch would take the
  // only copy of it with it.
  if (!opened.isInMemory && schemaVersionOf(database) === undefined) {
    wasReset = importJsonIndex(store, database, userDataDir) || wasReset;
  }
  // The shelves' summaries, built whole once for a store that has none — a
  // file an earlier build wrote, or one whose summaries were lost. Every write
  // after this keeps them current (`libraryGroups.ts`).
  const groups = database
    .prepare("SELECT value FROM meta WHERE key = 'groups'")
    .get() as TStoreRow | undefined;
  if (groups === undefined) {
    inTransaction(database, () => {
      rebuildGroups(database);
      database
        .prepare(
          "INSERT OR REPLACE INTO meta (key, value) VALUES ('groups', '1')",
        )
        .run();
    });
  }
  return { store, wasReset };
};

/**
 * A read-only connection to the same file, for the scan worker: it asks what
 * a path already holds, one file at a time, instead of being handed a copy of
 * every track the root has.
 */
export const openLibraryReader = (
  userDataDir: string,
): {
  trackByPath: (trackPath: string) => ILibraryTrack | undefined;
  close: () => void;
} => {
  const database = new DatabaseSync(libraryStorePath(userDataDir), {
    readOnly: true,
  });
  const byPath = database.prepare(
    `SELECT ${TRACK_SELECT} FROM tracks t WHERE t.path = ?`,
  );
  return {
    trackByPath: (trackPath) => {
      const row = byPath.get(trackPath) as TStoreRow | undefined;
      return row ? trackFromRow(row) : undefined;
    },
    close: () => database.close(),
  };
};
