/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { INoiseProfile } from '../dsp/noiseProfile';

export interface ILibraryIndex {
  version: 1;
  roots: ILibraryRoot[];
  tracks: ILibraryTrack[];
}

export interface ILibraryRoot {
  id: string;
  path: string;
  addedAt: number;
  lastScanAt?: number;
  /** Set when the folder was missing at the last scan — an unplugged drive. */
  isOffline?: boolean;
  trackCount: number;
  /** Karaoke songs skipped here, so the UI can say where they went. */
  karaokeSkipped: number;
}

/**
 * Where a file's audible programme begins and ends, in milliseconds from its
 * first sample.
 *
 * Not the same as 0 and the duration: a track can carry seconds of digital
 * silence at either end, and a crossfade scheduled against the container ends
 * up overlapping the padding rather than the music. Measured in
 * `programmeEdges.ts`.
 */
export interface ILibraryProgrammeEdges {
  leadInMs: number;
  endMs: number;
}

/**
 * Whole-file measurements taken in one decode pass.
 *
 * Versioned independently from the library index so a future improvement to
 * either meter invalidates only these cached numbers, not the user's roots or
 * metadata. LUFS is ITU-R BS.1770 integrated programme loudness; dBTP includes
 * inter-sample peaks.
 */
export interface ILibraryNormalizationAnalysis {
  version: 2;
  truePeakDbtp: number;
  integratedLufs: number;
  /**
   * Absent on entries cached before the edges were measured. Not a version
   * bump: the loudness numbers beside them are still correct, and throwing
   * away an analyzed library to learn where its silence is would cost every
   * user a re-measure of every track they own.
   */
  edges?: ILibraryProgrammeEdges;
  /**
   * The measured noise floor, absent on entries cached before Denoise existed.
   *
   * Not a version bump, for exactly the reason `edges` was not: the loudness
   * numbers beside it are still correct, and re-measuring an analyzed library
   * to learn where its hiss is would cost every user a decode of every track
   * they own. Fetched lazily, only when the stage that needs it is on.
   */
  noise?: INoiseProfile;
}

/** Cheap disk identity used to validate a cached whole-file measurement. */

export interface ILibraryTrack {
  id: string; // stable hash of the absolute path
  rootId: string;
  path: string; // outwards only; never accepted back
  kind: 'audio' | 'video';
  /** False for containers Chromium has no demuxer for — mkv, avi, wmv. */
  isPlayable: boolean;
  title: string; // tag, else a cleaned filename
  artist?: string;
  albumArtist?: string;
  album?: string;
  trackNo?: number;
  discNo?: number;
  year?: number;
  genre?: string;
  durationMs?: number;
  bitrate?: number;
  sampleRate?: number;
  channels?: number;
  codec?: string;
  /** Thumbnail id in the art cache; absent means draw a generated tile. */
  artId?: string;
  /**
   * True once this file has actually been checked for embedded or folder art.
   *
   * Older packaged scans could read every tag but attempted to decode covers
   * inside Electron's Node-only utility process, where `nativeImage` does not
   * exist. Those tracks have no `artId` and no way to distinguish that failure
   * from a genuinely artless file. Leaving this optional lets the next scan
   * re-read only such ambiguous tracks once; afterwards `true` means an absent
   * `artId` is a real result and ordinary incremental rescans stay cheap.
   */
  artworkChecked?: boolean;
  sizeBytes: number;
  mtimeMs: number;
  addedAt: number;
  /** Tags could not be read; the row still exists and still plays. */
  hasMetadataError?: boolean;
  /** Cached whole-track analysis; invalidated when size or mtime changes. */
  normalization?: ILibraryNormalizationAnalysis;
  /** This file has been found by a directory walk but its tags have not been
   * read yet -- `title` is a cleaned file name rather than a tag, `album` (if
   * set at all) is a folder-name guess rather than a fact, and every other
   * tag field is genuinely unknown, not blank. Cleared the moment a scan's
   * second phase resolves this same id, whether or not it finds real tags --
   * never set back to `true` once cleared, since that would mean an already
   * -read file forgot what it learned. */
  isPending?: boolean;
}

export type TLibraryBrowseMode =
  'album' | 'artist' | 'genre' | 'song' | 'folder' | 'video' | 'playlist';
export type TLibraryViewMode = 'list' | 'grid' | 'coverflow';
export type TLibrarySort =
  | 'title'
  | 'artist'
  | 'album'
  | 'year'
  | 'added'
  // The order the record itself puts them in — disc, then track number, off
  // the tags. The one order an album is actually meant to be heard in, and
  // until it was a sort of its own the only way to get it was not to sort.
  | 'track';
export type TLibrarySortDirection = 'asc' | 'desc';

export interface ILibraryScanProgress {
  rootId: string;
  /** A real total once discovery finishes — the walk and the parse are two
   * separate phases, not interleaved; see `libraryScanDiscovery.ts`'s module
   * comment. `parsed` climbs against this fixed number, never against one
   * still moving underneath it. */
  seen: number;
  parsed: number;
  karaokeSkipped: number;
  /** The file being read, for the progress line. Base name only. */
  current?: string;
  isDone: boolean;
}
