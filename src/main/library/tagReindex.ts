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
 * A song whose tags were just written, read again into the Library's store
 * on its own — the shelves show the change at once, and the next rescan
 * finds the file's size and time already known and leaves it alone.
 *
 * The same reader the scan uses (`readLibraryTags`), so a retagged song is
 * indexed exactly as a scanned one would be. Its loudness measurement is
 * kept: a tag write moves the audio and never changes it, and measuring a
 * whole album again because its titles were fixed would cost a decode of
 * every song for an identical answer.
 */

import fs from 'fs';
import path from 'path';
import type { ILibraryTrack } from '../../common/library/types';
import { libraryTitleFromFileName } from '../../common/library/files';
import { findFolderArt, readLibraryTags } from './libraryMetadata';
import type { ILibraryStore } from './libraryStore';

export type TStoreArtwork = (bytes: Uint8Array) => Promise<string | undefined>;

const folderArtId = async (
  filePath: string,
  storeArtwork: TStoreArtwork,
): Promise<string | undefined> => {
  const dir = path.dirname(filePath);
  try {
    const name = findFolderArt(await fs.promises.readdir(dir));
    if (name === undefined) {
      return undefined;
    }
    return await storeArtwork(await fs.promises.readFile(path.join(dir, name)));
  } catch {
    return undefined;
  }
};

/** Reads one known song's file again and writes it to the store. */
export const reindexTrack = async (
  store: ILibraryStore,
  trackId: string,
  storeArtwork: TStoreArtwork,
): Promise<ILibraryTrack | undefined> => {
  const existing = store.track(trackId);
  if (existing === undefined) {
    return undefined;
  }
  let stats: fs.Stats;
  try {
    stats = await fs.promises.stat(existing.path);
  } catch {
    return undefined;
  }
  const facts = await readLibraryTags(existing.path);
  const artId = facts.picture
    ? await storeArtwork(facts.picture.data)
    : await folderArtId(existing.path, storeArtwork);
  const title =
    facts.title !== undefined && facts.title.trim().length > 0
      ? facts.title
      : libraryTitleFromFileName(path.basename(existing.path));
  const track: ILibraryTrack = {
    ...existing,
    title,
    artist: facts.artist,
    albumArtist: facts.albumArtist,
    album: facts.album,
    trackNo: facts.trackNo,
    discNo: facts.discNo,
    year: facts.year,
    genre: facts.genre,
    durationMs: facts.durationMs ?? existing.durationMs,
    bitrate: facts.bitrate ?? existing.bitrate,
    sampleRate: facts.sampleRate ?? existing.sampleRate,
    channels: facts.channels ?? existing.channels,
    codec: facts.codec ?? existing.codec,
    artId,
    artworkChecked: true,
    sizeBytes: stats.size,
    mtimeMs: stats.mtimeMs,
    hasMetadataError: facts.readFailed,
    isPending: false,
  };
  // Confirmed by no scan: `scan_mark` keeps the highest mark it was given.
  store.upsertTracks([track], 0);
  return track;
};
