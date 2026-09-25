/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** The store's tables, and the one statement every song is written with. */

export const STORE_FILENAME = 'library.sqlite';

/**
 * Written once the JSON index has been moved in (`openLibraryStore`); a store
 * without it has not been, and is. Raise it with a change to the tables below
 * that an existing file needs moving to.
 */
export const SCHEMA_VERSION = 1;

export const SCHEMA = `
  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS roots (
    id TEXT PRIMARY KEY,
    path TEXT NOT NULL,
    added_at REAL NOT NULL,
    last_scan_at REAL,
    is_offline INTEGER,
    track_count INTEGER NOT NULL,
    karaoke_skipped INTEGER NOT NULL,
    position INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS tracks (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    id TEXT NOT NULL UNIQUE,
    root_id TEXT NOT NULL,
    path TEXT NOT NULL,
    folder TEXT NOT NULL,
    folder_name TEXT NOT NULL,
    sort_folder_name TEXT NOT NULL,
    kind TEXT NOT NULL,
    is_playable INTEGER NOT NULL,
    title TEXT NOT NULL,
    artist TEXT,
    album_artist TEXT,
    album TEXT,
    track_no REAL,
    disc_no REAL,
    year REAL,
    genre TEXT,
    duration_ms REAL,
    bitrate REAL,
    sample_rate REAL,
    channels REAL,
    codec TEXT,
    art_id TEXT,
    artwork_checked INTEGER,
    size_bytes REAL NOT NULL,
    mtime_ms REAL NOT NULL,
    added_at REAL NOT NULL,
    has_metadata_error INTEGER,
    is_pending INTEGER,
    normalization TEXT,
    album_key TEXT NOT NULL,
    artist_key TEXT NOT NULL,
    group_artist TEXT NOT NULL,
    fold_title TEXT NOT NULL,
    fold_artist TEXT,
    fold_album_artist TEXT,
    fold_album TEXT,
    sort_title TEXT NOT NULL,
    sort_artist TEXT NOT NULL,
    sort_album TEXT NOT NULL,
    sort_shelf_artist TEXT NOT NULL,
    scan_mark INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS tracks_root ON tracks (root_id);
  CREATE INDEX IF NOT EXISTS tracks_path ON tracks (path);
  CREATE INDEX IF NOT EXISTS tracks_folder ON tracks (folder);
  CREATE INDEX IF NOT EXISTS tracks_album ON tracks (album_key);
  CREATE INDEX IF NOT EXISTS tracks_artist ON tracks (artist_key);
  CREATE INDEX IF NOT EXISTS tracks_kind ON tracks (kind);
  -- The song shelf's orders, so a page is read off an index rather than
  -- every song sorted to find it.
  CREATE INDEX IF NOT EXISTS tracks_by_title ON tracks (sort_title, seq);
  CREATE INDEX IF NOT EXISTS tracks_by_artist ON tracks (sort_artist, sort_title, seq);
  CREATE INDEX IF NOT EXISTS tracks_by_album ON tracks (sort_album, sort_title, seq);
  CREATE INDEX IF NOT EXISTS tracks_by_added ON tracks (added_at, seq);
  CREATE TABLE IF NOT EXISTS track_genres (
    track_id TEXT NOT NULL,
    genre_id TEXT NOT NULL,
    genre_name TEXT NOT NULL,
    sort_name TEXT NOT NULL,
    PRIMARY KEY (track_id, genre_id)
  );
  CREATE INDEX IF NOT EXISTS track_genres_genre ON track_genres (genre_id);
`;

export const TRACK_UPSERT = `
  INSERT INTO tracks (
    id, root_id, path, folder, folder_name, sort_folder_name, kind, is_playable, title, artist, album_artist,
    album, track_no, disc_no, year, genre, duration_ms, bitrate, sample_rate,
    channels, codec, art_id, artwork_checked, size_bytes, mtime_ms, added_at,
    has_metadata_error, is_pending, normalization, album_key, artist_key,
    group_artist, fold_title, fold_artist, fold_album_artist, fold_album,
    sort_title, sort_artist, sort_album, sort_shelf_artist, scan_mark
  ) VALUES (
    $id, $rootId, $path, $folder, $folderName, $sortFolderName, $kind, $isPlayable, $title, $artist,
    $albumArtist, $album, $trackNo, $discNo, $year, $genre, $durationMs,
    $bitrate, $sampleRate, $channels, $codec, $artId, $artworkChecked,
    $sizeBytes, $mtimeMs, $addedAt, $hasMetadataError, $isPending,
    $normalization, $albumKey, $artistKey, $groupArtist, $foldTitle,
    $foldArtist, $foldAlbumArtist, $foldAlbum, $sortTitle, $sortArtist,
    $sortAlbum, $sortShelfArtist, $scanMark
  )
  ON CONFLICT (id) DO UPDATE SET
    root_id = excluded.root_id,
    path = excluded.path,
    folder = excluded.folder,
    folder_name = excluded.folder_name,
    sort_folder_name = excluded.sort_folder_name,
    kind = excluded.kind,
    is_playable = excluded.is_playable,
    title = excluded.title,
    artist = excluded.artist,
    album_artist = excluded.album_artist,
    album = excluded.album,
    track_no = excluded.track_no,
    disc_no = excluded.disc_no,
    year = excluded.year,
    genre = excluded.genre,
    duration_ms = excluded.duration_ms,
    bitrate = excluded.bitrate,
    sample_rate = excluded.sample_rate,
    channels = excluded.channels,
    codec = excluded.codec,
    art_id = excluded.art_id,
    artwork_checked = excluded.artwork_checked,
    size_bytes = excluded.size_bytes,
    mtime_ms = excluded.mtime_ms,
    -- The day a song joined is the first one: a path renamed only in case
    -- keeps its id and is read afresh, and must not count as new.
    added_at = MIN(tracks.added_at, excluded.added_at),
    has_metadata_error = excluded.has_metadata_error,
    is_pending = excluded.is_pending,
    -- A measurement that finished while an older scan was still walking is
    -- kept: the scan carries none, and the file is byte-for-byte the one it
    -- was measured on. A changed file must be measured again.
    normalization = COALESCE(
      excluded.normalization,
      CASE
        WHEN tracks.size_bytes = excluded.size_bytes
          AND tracks.mtime_ms = excluded.mtime_ms
        THEN tracks.normalization
      END
    ),
    album_key = excluded.album_key,
    artist_key = excluded.artist_key,
    group_artist = excluded.group_artist,
    fold_title = excluded.fold_title,
    fold_artist = excluded.fold_artist,
    fold_album_artist = excluded.fold_album_artist,
    fold_album = excluded.fold_album,
    sort_title = excluded.sort_title,
    sort_artist = excluded.sort_artist,
    sort_album = excluded.sort_album,
    sort_shelf_artist = excluded.sort_shelf_artist,
    -- A row published before it is confirmed (discovery's provisional rows,
    -- a dropped file) must not un-confirm one a scan already confirmed.
    scan_mark = MAX(tracks.scan_mark, excluded.scan_mark)
`;
