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

import { isPlaceholderName } from '../../../common/library/tagFix';
import type { ITrackTagSheet } from '../../../common/library/tagFields';

/**
 * A song's album and album artist as grouping reads them: "<Desconocido>"
 * names no album, so a song still carrying it after its folder was fixed
 * joins that folder's album instead of standing as an album of its own.
 */
const albumOf = (sheet: ITrackTagSheet): string => {
  const album = sheet.fields.album ?? '';
  return isPlaceholderName(album) ? '' : album;
};

const albumArtistOf = (sheet: ITrackTagSheet): string => {
  const artist = sheet.fields.albumArtist ?? '';
  return isPlaceholderName(artist) ? '' : artist;
};

export interface ISheetGroup {
  key: string;
  /** "Marea Alta — Luna de Papel"; absent for a single album. */
  label?: string;
  sheets: ITrackTagSheet[];
}

/** A folder's songs grouped by album, each group in the editor's order. */
export const groupsOf = (
  ordered: readonly ITrackTagSheet[],
  isFolder: boolean,
): ISheetGroup[] => {
  if (!isFolder) {
    return [{ key: 'all', sheets: [...ordered] }];
  }
  const albumKey = (sheet: ITrackTagSheet) =>
    `${albumArtistOf(sheet).toLocaleLowerCase()}\u001f${albumOf(sheet).toLocaleLowerCase()}`;
  // The albums each folder holds: an untagged song in a folder of one album
  // is that album's, or Fix could never fill it from the album's majority.
  const albumsByFolder = new Map<string, Set<string>>();
  ordered.forEach((sheet) => {
    if (albumOf(sheet) !== '') {
      const held = albumsByFolder.get(sheet.folder) ?? new Set<string>();
      held.add(albumKey(sheet));
      albumsByFolder.set(sheet.folder, held);
    }
  });
  const groups = new Map<string, ISheetGroup>();
  ordered.forEach((sheet) => {
    // One album however its artist is spelled: grouped by the album's name
    // (and its album artist where it has one), case aside; a song with no
    // album joins its folder's one album, or stands with its folder.
    const folderAlbums = albumsByFolder.get(sheet.folder);
    let key = albumKey(sheet);
    if (albumOf(sheet) === '') {
      key =
        folderAlbums?.size === 1
          ? [...folderAlbums][0]
          : `folder\u001f${sheet.folder}`;
    }
    const group = groups.get(key) ?? { key, sheets: [] };
    group.sheets.push(sheet);
    groups.set(key, group);
  });
  // Named after a song that carries the album, whichever song came first.
  return [...groups.values()].map((group) => {
    const named =
      group.sheets.find((sheet) => albumOf(sheet) !== '') ?? group.sheets[0];
    const label =
      [
        albumArtistOf(named) ||
          (isPlaceholderName(named.fields.artist ?? '')
            ? ''
            : named.fields.artist),
        albumOf(named),
      ]
        .filter(Boolean)
        // A folder of untagged songs is named by its own folder, not its path.
        .join(' — ') ||
      named.folder.split(/[\\/]/).pop() ||
      named.folder;
    return { ...group, label };
  });
};
