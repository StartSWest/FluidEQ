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

import fs from 'fs';
import { parseBuffer } from 'music-metadata';
import { ILibraryTrack } from '../../common/library/types';
import {
  libraryBaseName,
  libraryFileExtension,
} from '../../common/library/files';

export type ILibraryFileFacts = Partial<
  Pick<
    ILibraryTrack,
    | 'title'
    | 'artist'
    | 'albumArtist'
    | 'album'
    | 'trackNo'
    | 'discNo'
    | 'year'
    | 'genre'
    | 'durationMs'
    | 'bitrate'
    | 'sampleRate'
    | 'channels'
    | 'codec'
  >
> & {
  picture?: { data: Uint8Array; format: string };
};

const NUL = String.fromCharCode(0);

/**
 * Removes an embedded NUL from a tag string.
 *
 * ID3v2.4 legitimately delimits multi-valued text frames with U+0000, and
 * measured against music-metadata 11.14.0, at least one common field (TALB,
 * TIT2 under ID3v2.3) passes it straight through undecoded rather than
 * splitting on it. albumKey() in common/library/grouping.ts joins album and
 * artist with that exact character to build its map key and does not
 * sanitise its inputs — a raw NUL reaching it would let
 * {album:"A", artist:"B\0C"} collide with {album:"A\0B", artist:"C"} and
 * silently merge two unrelated albums.
 */
const sanitizeText = (value: string | undefined): string | undefined =>
  value === undefined ? undefined : value.split(NUL).join('');

/**
 * Keeps a number only if `Number.isFinite` agrees.
 *
 * `format.duration` can come back `NaN` for a header with no computable
 * length, and measured against a WAV whose `fmt ` chunk declares a
 * block-align of zero, `Infinity` (the divide-by-zero survives because
 * music-metadata only guards the zero-sample-rate case, not this one).
 * `JSON.stringify` turns `NaN` into `null`, and `parseLibraryIndex` in
 * libraryIndex.ts rejects `null` for every optional numeric field it knows —
 * one non-finite number anywhere in the index declares the whole file
 * corrupt and resets it to empty on the next launch.
 */
const finiteOrUndefined = (
  value: number | null | undefined,
): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

/**
 * Reads the tags and stream facts off a single media file.
 *
 * Never throws: a scan walks thousands of files, and one that will not parse
 * must not end it. The read is not streamed — `fs.promises.readFile` loads
 * the whole file before handing it to `parseBuffer` — because this project
 * has a documented crash from `fetch` plus `pipeline` in Node's HTTP parser,
 * and nothing a music library holds is large enough for streaming to pay for
 * the risk.
 */
export const readLibraryTags = async (
  filePath: string,
): Promise<ILibraryFileFacts> => {
  try {
    const buffer = await fs.promises.readFile(filePath);
    const { common, format } = await parseBuffer(buffer, { path: filePath });
    const picture = common.picture?.[0];
    return {
      title: sanitizeText(common.title),
      artist: sanitizeText(common.artist),
      albumArtist: sanitizeText(common.albumartist),
      album: sanitizeText(common.album),
      trackNo: finiteOrUndefined(common.track.no),
      discNo: finiteOrUndefined(common.disk.no),
      year: finiteOrUndefined(common.year),
      genre: sanitizeText(common.genre?.[0]),
      durationMs: finiteOrUndefined(
        format.duration !== undefined
          ? Math.round(format.duration * 1000)
          : undefined,
      ),
      bitrate: finiteOrUndefined(format.bitrate),
      sampleRate: finiteOrUndefined(format.sampleRate),
      channels: finiteOrUndefined(format.numberOfChannels),
      codec: sanitizeText(format.codec),
      picture: picture
        ? { data: picture.data, format: picture.format }
        : undefined,
    };
  } catch (error) {
    // A file that will not parse is the single most useful line in a bug
    // report about a missing album.
    // eslint-disable-next-line no-console -- this project's one sanctioned console sink; see libraryIndex.ts
    console.error(`Could not read tags from ${filePath}`, error);
    return {};
  }
};

/** Conventional cover-art file names, in the order a folder is searched. */
export const FOLDER_ART_NAMES = [
  'cover',
  'folder',
  'front',
  'album',
  'artwork',
] as const;

const FOLDER_ART_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];

/**
 * Finds a cover image beside a track, for files whose tags carry none.
 *
 * Walks `FOLDER_ART_NAMES` in order and returns the first directory entry
 * that matches — order of the names decides, not order of the listing. A
 * directory listing's order is the filesystem's business and differs between
 * machines, so a folder with both `folder.jpg` and `cover.jpg` must not pick
 * a different one depending on which computer scans it.
 */
export const findFolderArt = (
  entries: readonly string[],
): string | undefined => {
  const matchForName = (name: string): string | undefined =>
    entries.find(
      (entry) =>
        libraryBaseName(entry) === name &&
        FOLDER_ART_EXTENSIONS.includes(libraryFileExtension(entry)),
    );
  const matches = FOLDER_ART_NAMES.map(matchForName);
  return matches.find((match): match is string => match !== undefined);
};
