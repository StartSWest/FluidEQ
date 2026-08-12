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

export interface IKaraokeSessionFileReference {
  /** Present for a file selected during this app session. */
  localPath?: string;
  /** Present for a file restored by the main process. */
  token?: string;
  relativePath: string;
}

export interface IKaraokeSessionSnapshot {
  version: 1;
  files: IKaraokeSessionFileReference[];
  playlistOrder: string[];
  selectedPlaylistId?: string;
  playheadMs: number;
}

export interface IKaraokeRestoredFile {
  token: string;
  name: string;
  relativePath: string;
  type: string;
  lastModified: number;
  role: 'audio' | 'lyrics';
  /** Lyrics are small and arrive eagerly; audio remains lazy. */
  text?: string;
}

export interface IKaraokeRestoredSession {
  files: IKaraokeRestoredFile[];
  playlistOrder: string[];
  selectedPlaylistId?: string;
  playheadMs: number;
}

export interface IKaraokeRestoredFileBytes {
  data: Uint8Array;
  lastModified: number;
  type: string;
}
