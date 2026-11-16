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
 * The album, folder and selection editor's state, and what it writes.
 *
 * Three layers, the later winning: what each file says, a value typed into
 * a shared field (it goes to every song), and a cell of the sheet (that song
 * only). Typing a shared value takes back the cells of that field, so "for
 * all" means for all.
 */

import {
  cleanTagValue,
  type ITagEdit,
  type ITagWriteRequest,
  type ITrackTagSheet,
  type TTagFieldKey,
  type TTagFields,
} from '../../../common/library/tagFields';
import {
  countValues,
  isFileNameTitle,
  isOneCase,
  titleCase,
  titleFromFileName,
} from '../../../common/library/tagText';
import type { IDraftCover } from './tagDrafts';

/** The fields shown above the sheet, for every song at once. */
export const SHARED_FIELDS: readonly TTagFieldKey[] = [
  'album',
  'albumArtist',
  'artist',
  'year',
  'genre',
  'trackTotal',
  'discNo',
  'publisher',
  'composer',
  'comment',
];

/** The sheet's editable columns, per song. */
export const SHEET_FIELDS: readonly TTagFieldKey[] = [
  'trackNo',
  'title',
  'artist',
  'year',
  'discNo',
];

export type TVersionChoice = 'keep' | 3 | 4;

export interface ISetState {
  /** Song ids in the sheet's order; drag reorders this. */
  order: string[];
  shared: TTagFields;
  /** Per song, the cells typed there. */
  cells: ReadonlyMap<string, TTagFields>;
  /** `null` removes every cover; absent leaves them. */
  cover?: IDraftCover | null;
  version: TVersionChoice;
}

export const initialSetState = (ids: readonly string[]): ISetState => ({
  order: [...ids],
  shared: {},
  cells: new Map(),
  version: 'keep',
});

/** What a song shows for a field: its cell, else the shared value, else the
 * file's own. */
export const effectiveValue = (
  state: ISetState,
  sheet: ITrackTagSheet,
  key: TTagFieldKey,
): string =>
  state.cells.get(sheet.trackId)?.[key] ??
  state.shared[key] ??
  sheet.fields[key] ??
  '';

export const withShared = (
  state: ISetState,
  key: TTagFieldKey,
  value: string | undefined,
): ISetState => {
  const shared = { ...state.shared };
  if (value === undefined) {
    delete shared[key];
  } else {
    shared[key] = value;
  }
  // "For all" means for all: the cells typed for this field go.
  const cells = new Map(state.cells);
  cells.forEach((fields, id) => {
    if (fields[key] !== undefined) {
      const next = { ...fields };
      delete next[key];
      cells.set(id, next);
    }
  });
  return { ...state, shared, cells };
};

export const withCell = (
  state: ISetState,
  sheet: ITrackTagSheet,
  key: TTagFieldKey,
  value: string,
): ISetState => {
  const cells = new Map(state.cells);
  const fields = { ...(cells.get(sheet.trackId) ?? {}) };
  if ((state.shared[key] ?? sheet.fields[key] ?? '') === value) {
    delete fields[key];
  } else {
    fields[key] = value;
  }
  cells.set(sheet.trackId, fields);
  return { ...state, cells };
};

/** The distinct values the songs hold for a field today, with counts. */
export const fieldValues = (
  sheets: readonly ITrackTagSheet[],
  key: TTagFieldKey,
) => countValues(sheets.map((sheet) => sheet.fields[key] ?? ''));

/** Per song, the fields that would change; songs with none left out. */
export const changedFields = (
  state: ISetState,
  sheets: readonly ITrackTagSheet[],
): Map<string, TTagFields> => {
  const changes = new Map<string, TTagFields>();
  const keys = new Set<TTagFieldKey>([
    ...(Object.keys(state.shared) as TTagFieldKey[]),
    ...[...state.cells.values()].flatMap(
      (fields) => Object.keys(fields) as TTagFieldKey[],
    ),
  ]);
  sheets.forEach((sheet) => {
    const fields: TTagFields = {};
    keys.forEach((key) => {
      const value = effectiveValue(state, sheet, key);
      if (value !== (sheet.fields[key] ?? '')) {
        fields[key] = value;
      }
    });
    if (Object.keys(fields).length > 0) {
      changes.set(sheet.trackId, fields);
    }
  });
  return changes;
};

/** True when every value about to be written is one main takes. */
export const isSetValid = (changes: ReadonlyMap<string, TTagFields>): boolean =>
  [...changes.values()].every((fields) =>
    (Object.keys(fields) as TTagFieldKey[]).every(
      (key) => cleanTagValue(key, fields[key] ?? '') !== undefined,
    ),
  );

export interface ISetSummary {
  changeCount: number;
  fileCount: number;
}

export const summarise = (
  state: ISetState,
  sheets: readonly ITrackTagSheet[],
  changes: ReadonlyMap<string, TTagFields>,
): ISetSummary => {
  const files = new Set(changes.keys());
  let changeCount = [...changes.values()].reduce(
    (sum, fields) => sum + Object.keys(fields).length,
    0,
  );
  if (state.cover !== undefined) {
    changeCount += 1;
    sheets.forEach((sheet) => files.add(sheet.trackId));
  }
  if (state.version !== 'keep') {
    const moving = sheets.filter(
      (sheet) =>
        sheet.canChooseId3v2Version && sheet.id3v2Version !== state.version,
    );
    if (moving.length > 0) {
      changeCount += 1;
      moving.forEach((sheet) => files.add(sheet.trackId));
    }
  }
  return { changeCount, fileCount: files.size };
};

/** The whole editor as one write: every song that changes, the cover sent
 * once. */
export const requestOfSet = (
  state: ISetState,
  sheets: readonly ITrackTagSheet[],
  playingTrackId: string | undefined,
): ITagWriteRequest => {
  const changes = changedFields(state, sheets);
  const edits: ITagEdit[] = [];
  sheets.forEach((sheet) => {
    const fields = changes.get(sheet.trackId);
    const moveVersion =
      state.version !== 'keep' &&
      sheet.canChooseId3v2Version &&
      sheet.id3v2Version !== state.version;
    let coverId: string | undefined;
    if (state.cover === null) {
      coverId = '';
    } else if (state.cover !== undefined) {
      coverId = state.cover.id;
    }
    if (fields === undefined && coverId === undefined && !moveVersion) {
      return;
    }
    edits.push({
      trackId: sheet.trackId,
      fields,
      coverId,
      id3v2Version:
        moveVersion && state.version !== 'keep' ? state.version : undefined,
    });
  });
  return {
    edits,
    covers: state.cover
      ? {
          [state.cover.id]: {
            bytes: state.cover.bytes,
            mime: state.cover.mime,
          },
        }
      : {},
    heldTrackIds:
      playingTrackId !== undefined &&
      edits.some((edit) => edit.trackId === playingTrackId)
        ? [playingTrackId]
        : [],
  };
};

/** Renumber by order: each song its place, counted within its group. */
export const renumbered = (
  state: ISetState,
  rows: readonly ITrackTagSheet[][],
): ISetState =>
  rows.reduce(
    (acc, group) =>
      group.reduce(
        (inner, sheet, index) =>
          withCell(inner, sheet, 'trackNo', String(index + 1)),
        acc,
      ),
    state,
  );

/** Titles from file names, for the songs whose title is empty or is its
 * file name; a track number is taken too where the song has none. */
export const titledFromFileNames = (
  state: ISetState,
  sheets: readonly ITrackTagSheet[],
): ISetState =>
  sheets.reduce((acc, sheet) => {
    const title = effectiveValue(acc, sheet, 'title');
    if (title !== '' && !isFileNameTitle(title, sheet.fileName)) {
      return acc;
    }
    const read = titleFromFileName(sheet.fileName);
    if (read === undefined || read.title === '') {
      return acc;
    }
    let next = withCell(acc, sheet, 'title', read.title);
    if (
      read.trackNo !== undefined &&
      effectiveValue(next, sheet, 'trackNo') === ''
    ) {
      next = withCell(next, sheet, 'trackNo', read.trackNo);
    }
    return next;
  }, state);

/** Fix capitals: titles written all in one case get title case; a title
 * cased by hand is left as it is. */
export const capitalsFixed = (
  state: ISetState,
  sheets: readonly ITrackTagSheet[],
): ISetState =>
  sheets.reduce((acc, sheet) => {
    const title = effectiveValue(acc, sheet, 'title');
    return isOneCase(title)
      ? withCell(acc, sheet, 'title', titleCase(title))
      : acc;
  }, state);

/** Find & replace in titles, as typed, every occurrence. */
export const titlesReplaced = (
  state: ISetState,
  sheets: readonly ITrackTagSheet[],
  find: string,
  replace: string,
): ISetState =>
  find === ''
    ? state
    : sheets.reduce((acc, sheet) => {
        const title = effectiveValue(acc, sheet, 'title');
        return title.includes(find)
          ? withCell(acc, sheet, 'title', title.split(find).join(replace))
          : acc;
      }, state);
