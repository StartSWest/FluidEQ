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
  sizeBytes: number;
  mtimeMs: number;
  addedAt: number;
  /** Tags could not be read; the row still exists and still plays. */
  hasMetadataError?: boolean;
}

export type TLibraryBrowseMode = 'album' | 'artist' | 'song';
export type TLibraryViewMode = 'list' | 'grid' | 'coverflow';
export type TLibrarySort = 'title' | 'artist' | 'album' | 'year' | 'added';

export interface ILibraryScanProgress {
  rootId: string;
  /** Files walked so far. Not a total — the walk and the parse interleave. */
  seen: number;
  parsed: number;
  karaokeSkipped: number;
  /** The file being read, for the progress line. Base name only. */
  current?: string;
  isDone: boolean;
}
