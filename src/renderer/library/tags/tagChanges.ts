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

import type {
  ITrackTagSheet,
  TTagFieldKey,
  TTagFields,
} from '../../../common/library/tagFields';
import type { ISetState } from './tagSetModel';

/** One value the album as a whole gets: from what, to what, for how many. */
export interface IAlbumChange {
  field: TTagFieldKey;
  /** What the changed songs hold now, each once. */
  before: string[];
  after: string;
  songs: number;
}

/** One song's own changes. */
export interface ISongChange {
  trackId: string;
  /** "3 · Luz de Invierno": its number and its title as it will be. */
  name: string;
  fields: Array<{ field: TTagFieldKey; before: string; after: string }>;
}

/**
 * What a Save would do, as the side panel lists it while the album editor
 * is open (Ivan, 2026-11-16: "instead of Up Next, show the panel of the
 * replacements that will be made, so there is no confusion").
 */
export interface IPendingChanges {
  album: IAlbumChange[];
  songs: ISongChange[];
  cover?: { kind: 'new' | 'removed'; songs: number };
  count: number;
}

/**
 * The editor's state read as a list: a field typed for every song is one
 * album line with the values it replaces; anything typed in a song's cells
 * is listed under that song. Only what differs from the files counts.
 */
export const pendingChangesOf = (
  state: ISetState,
  sheets: readonly ITrackTagSheet[],
  changes: ReadonlyMap<string, TTagFields>,
): IPendingChanges => {
  const sharedKeys = Object.keys(state.shared) as TTagFieldKey[];
  const album = sharedKeys.flatMap((field): IAlbumChange[] => {
    const touched = sheets.filter(
      (sheet) => changes.get(sheet.trackId)?.[field] !== undefined,
    );
    if (touched.length === 0) {
      return [];
    }
    return [
      {
        field,
        before: [...new Set(touched.map((sheet) => sheet.fields[field] ?? ''))],
        after: state.shared[field] ?? '',
        songs: touched.length,
      },
    ];
  });
  const songs = sheets.flatMap((sheet): ISongChange[] => {
    const own = state.cells.get(sheet.trackId) ?? {};
    const changed = changes.get(sheet.trackId) ?? {};
    const fields = (Object.keys(own) as TTagFieldKey[])
      .filter((field) => changed[field] !== undefined)
      .map((field) => ({
        field,
        before: sheet.fields[field] ?? '',
        after: changed[field] ?? '',
      }));
    if (fields.length === 0) {
      return [];
    }
    const number = changed.trackNo ?? sheet.fields.trackNo ?? '';
    const title = changed.title ?? sheet.fields.title ?? sheet.fileName;
    return [
      {
        trackId: sheet.trackId,
        name: number === '' ? title : `${number} · ${title}`,
        fields,
      },
    ];
  });
  let cover: IPendingChanges['cover'];
  if (state.cover === null) {
    cover = {
      kind: 'removed',
      songs: sheets.filter((sheet) => sheet.cover !== undefined).length,
    };
  } else if (state.cover !== undefined) {
    cover = { kind: 'new', songs: sheets.length };
  }
  return {
    album,
    songs,
    cover,
    count:
      album.length +
      songs.reduce((sum, song) => sum + song.fields.length, 0) +
      (cover ? 1 : 0),
  };
};
