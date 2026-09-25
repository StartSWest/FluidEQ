/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A track as the library store keeps it, and back.
 *
 * Every key a shelf groups by, and every folded field a search compares or an
 * order sorts by, is worked out HERE, once, as the row is written — with the
 * very functions the window groups and searches with (`albumKey`,
 * `artistKey`, `trackGenreIds`, `normalizeForGrouping`, `trackFolderPath`).
 * Two copies of those rules, one in SQL and one in TypeScript, would drift the
 * way `artistKey` once drifted between the artist page and its queue; and the
 * keys stored here are the same strings the window remembers an open album or
 * artist by across a restart.
 */

import type { SQLInputValue, SQLOutputValue } from 'node:sqlite';
import {
  genreKey,
  genreNames,
  UNKNOWN_GENRE_ID,
} from '../../common/library/genres';
import {
  albumKey,
  artistKey,
  folderDisplayName,
  normalizeForGrouping,
  normalizeForSearch,
  trackFolderPath,
} from '../../common/library/grouping';
import type {
  ILibraryNormalizationAnalysis,
  ILibraryRoot,
  ILibraryTrack,
} from '../../common/library/types';

/** One stored row, as SQLite hands it back. */
export type TStoreRow = Record<string, SQLOutputValue>;

/**
 * The folded form a search compares: case, accents AND punctuation gone —
 * `normalizeForGrouping`, the fold `searchScore` has always applied to both
 * the query and every field.
 */
const fold = (value: string | undefined): string | null =>
  value === undefined ? null : normalizeForGrouping(value);

/**
 * The form an order sorts by: case and accents gone, punctuation kept.
 *
 * `localeCompare` ranked the shelves before; SQLite has no locale, and this
 * is the part of what it did that matters to a reader — "élan" beside "Elan",
 * not after "Zebra".
 *
 * TWO NAMES THAT FOLD THE SAME ARE ONE NAME, and the next key decides. That
 * is where this parts from `localeCompare`, on purpose: it told "Queen" from
 * "queen" and "Björk" from "Bjork" by case and accent, so sorting by artist
 * listed every "queen" song before every "Queen" song, each run by title — one
 * band's songs split in two by how a tagger typed its name. Here they are one
 * run by title, and only a full tie falls back to the order the library
 * learned them in.
 */
export const sortKey = (value: string | undefined): string =>
  normalizeForSearch(value ?? '');

const flag = (value: boolean | undefined): number | null => {
  if (value === undefined) {
    return null;
  }
  return value ? 1 : 0;
};

/** The named parameters one track writes, `$`-prefixed as SQLite binds them. */
export const trackParameters = (
  track: ILibraryTrack,
  scanMark: number,
): Record<string, SQLInputValue> => ({
  $id: track.id,
  $rootId: track.rootId,
  $path: track.path,
  $folder: trackFolderPath(track.path),
  $folderName: folderDisplayName(trackFolderPath(track.path)),
  $sortFolderName: sortKey(folderDisplayName(trackFolderPath(track.path))),
  $kind: track.kind,
  $isPlayable: track.isPlayable ? 1 : 0,
  $title: track.title,
  $artist: track.artist ?? null,
  $albumArtist: track.albumArtist ?? null,
  $album: track.album ?? null,
  $trackNo: track.trackNo ?? null,
  $discNo: track.discNo ?? null,
  $year: track.year ?? null,
  $genre: track.genre ?? null,
  $durationMs: track.durationMs ?? null,
  $bitrate: track.bitrate ?? null,
  $sampleRate: track.sampleRate ?? null,
  $channels: track.channels ?? null,
  $codec: track.codec ?? null,
  $artId: track.artId ?? null,
  $artworkChecked: flag(track.artworkChecked),
  $sizeBytes: track.sizeBytes,
  $mtimeMs: track.mtimeMs,
  $addedAt: track.addedAt,
  $hasMetadataError: flag(track.hasMetadataError),
  $isPending: flag(track.isPending),
  $normalization:
    track.normalization === undefined
      ? null
      : JSON.stringify(track.normalization),
  $albumKey: albumKey(track),
  $artistKey: artistKey(track),
  // The artist grouping's own name: album artist first, as every shelf reads.
  $groupArtist: normalizeForGrouping(track.albumArtist ?? track.artist ?? ''),
  $foldTitle: fold(track.title) ?? '',
  $foldArtist: fold(track.artist),
  $foldAlbumArtist: fold(track.albumArtist),
  $foldAlbum: fold(track.album),
  $sortTitle: sortKey(track.title),
  $sortArtist: sortKey(track.artist),
  $sortAlbum: sortKey(track.album),
  $sortShelfArtist: sortKey(track.albumArtist ?? track.artist),
  $scanMark: scanMark,
});

/**
 * The genres one track is filed under, each with the spelling it wrote.
 *
 * `trackGenreIds`'s rule — split on `;` and NUL, one id per distinct key,
 * Unknown for a track with none — with the name kept beside each id, because
 * a genre shelf is titled by the first spelling the library met.
 */
export const trackGenreRows = (
  track: ILibraryTrack,
): { genreId: string; genreName: string }[] => {
  const names = genreNames(track);
  if (names.length === 0) {
    return [{ genreId: UNKNOWN_GENRE_ID, genreName: '' }];
  }
  const seen = new Set<string>();
  return names.flatMap((name) => {
    const genreId = genreKey(name);
    if (seen.has(genreId)) {
      return [];
    }
    seen.add(genreId);
    return [{ genreId, genreName: name }];
  });
};

const text = (value: SQLOutputValue): string | undefined =>
  typeof value === 'string' ? value : undefined;

const num = (value: SQLOutputValue): number | undefined =>
  typeof value === 'number' ? value : undefined;

const bool = (value: SQLOutputValue): boolean | undefined =>
  typeof value === 'number' ? value !== 0 : undefined;

const normalizationOf = (
  value: SQLOutputValue,
): ILibraryNormalizationAnalysis | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  try {
    return JSON.parse(value) as ILibraryNormalizationAnalysis;
  } catch {
    return undefined;
  }
};

/**
 * A stored row as the track the rest of the app knows.
 *
 * An absent optional stays absent rather than coming back as `null` or
 * `false`: `artworkChecked !== true`, `isPending === true` and every `?? 1`
 * on a disc number read the difference.
 */
export const trackFromRow = (row: TStoreRow): ILibraryTrack => {
  const track: ILibraryTrack = {
    id: String(row.id),
    rootId: String(row.root_id),
    path: String(row.path),
    kind: row.kind === 'video' ? 'video' : 'audio',
    isPlayable: row.is_playable === 1,
    title: String(row.title),
    sizeBytes: Number(row.size_bytes),
    mtimeMs: Number(row.mtime_ms),
    addedAt: Number(row.added_at),
  };
  const optional: Partial<ILibraryTrack> = {
    artist: text(row.artist),
    albumArtist: text(row.album_artist),
    album: text(row.album),
    trackNo: num(row.track_no),
    discNo: num(row.disc_no),
    year: num(row.year),
    genre: text(row.genre),
    durationMs: num(row.duration_ms),
    bitrate: num(row.bitrate),
    sampleRate: num(row.sample_rate),
    channels: num(row.channels),
    codec: text(row.codec),
    artId: text(row.art_id),
    artworkChecked: bool(row.artwork_checked),
    hasMetadataError: bool(row.has_metadata_error),
    normalization: normalizationOf(row.normalization),
    isPending: bool(row.is_pending),
  };
  (Object.keys(optional) as (keyof ILibraryTrack)[]).forEach((key) => {
    const value = optional[key];
    if (value !== undefined) {
      Object.assign(track, { [key]: value });
    }
  });
  return track;
};

export const rootFromRow = (row: TStoreRow): ILibraryRoot => {
  const root: ILibraryRoot = {
    id: String(row.id),
    path: String(row.path),
    addedAt: Number(row.added_at),
    trackCount: Number(row.track_count),
    karaokeSkipped: Number(row.karaoke_skipped),
  };
  if (typeof row.last_scan_at === 'number') {
    root.lastScanAt = row.last_scan_at;
  }
  if (typeof row.is_offline === 'number') {
    root.isOffline = row.is_offline !== 0;
  }
  return root;
};

/** The columns a track row is read back through — every stored field. */
export const TRACK_SELECT = `
  t.id, t.root_id, t.path, t.kind, t.is_playable, t.title, t.artist,
  t.album_artist, t.album, t.track_no, t.disc_no, t.year, t.genre,
  t.duration_ms, t.bitrate, t.sample_rate, t.channels, t.codec, t.art_id,
  t.artwork_checked, t.size_bytes, t.mtime_ms, t.added_at,
  t.has_metadata_error, t.normalization, t.is_pending`;
