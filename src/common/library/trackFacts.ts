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

/**
 * What the Library's Details pane says about a song beyond what the scan
 * keeps: read from the file itself, in main, when the pane asks, by the
 * song's id and never a path (`library-track-facts`).
 */
export interface ILibraryTrackFacts {
  /** The container as the parser names it: "FLAC", "MPEG", "MP4". */
  container?: string;
  /** The codec in full: "FLAC", "MPEG 1 Layer 3", "AAC". */
  codec?: string;
  lossless?: boolean;
  /** Bits per sample, for the formats that have a fixed depth. */
  bitsPerSample?: number;
  /** Bits per second. */
  bitrate?: number;
  sampleRate?: number;
  channels?: number;
  /** The file's size on disk now, which a rescan may not have read yet. */
  sizeBytes?: number;
  /** The file could not be read: gone, locked, or no tags parse. */
  readFailed?: boolean;
}

/** Longest text a fact may carry across the wire. */
export const MAX_FACT_TEXT = 120;
