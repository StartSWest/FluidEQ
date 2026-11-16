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

import {
  type IFixLine,
  type IFixRules,
  proposeFixes,
} from '../../../common/library/tagFix';
import type {
  ITagFolderFacts,
  ITrackTagSheet,
  TTagFieldKey,
} from '../../../common/library/tagFields';
import { type ISetState, withCell, withShared } from './tagSetModel';
import { cueOf } from './useTagFolders';

/**
 * Fix tags inside the album editor: what the rules propose for one album,
 * typed into the editor as if by hand, so it is looked over, changed and
 * saved like any edit — and put back field by field, or discarded whole.
 */

/** What Fix proposes for one album's songs, its folder's CUE sheet read. */
export const proposalsFor = (
  sheets: readonly ITrackTagSheet[],
  rules: IFixRules,
  facts: ReadonlyMap<string, ITagFolderFacts>,
): IFixLine[] =>
  proposeFixes(
    sheets.map((sheet) => ({
      trackId: sheet.trackId,
      fileName: sheet.fileName,
      folder: sheet.folder,
      fields: sheet.fields,
    })),
    rules,
    cueOf(sheets, facts),
  );

/**
 * The editor with one album's proposals typed in. On an editor holding just
 * this album, an album field whose proposals leave every song with the same
 * value goes in the album's own field above the songs — "Luna de Papel"
 * filled on the one song that lacked it reads as the album's name, not as
 * a cell nobody sees. Titles, numbers, a single song's artist, and every
 * value of an album among several in a folder go in their songs' cells.
 */
export const withFixes = (
  state: ISetState,
  sheets: readonly ITrackTagSheet[],
  lines: readonly IFixLine[],
  isWholeEditor: boolean,
): ISetState => {
  const byId = new Map(sheets.map((sheet) => [sheet.trackId, sheet]));
  const fields = new Set(lines.map((line) => line.field));
  const sharedValue = (field: TTagFieldKey): string | undefined => {
    if (!isWholeEditor || field === 'title' || field === 'trackNo') {
      return undefined;
    }
    const proposed = new Map<string, string>();
    lines
      .filter((line) => line.field === field)
      .forEach((line) =>
        line.trackIds.forEach((id) => proposed.set(id, line.after)),
      );
    const values = new Set(
      sheets.map(
        (sheet) => proposed.get(sheet.trackId) ?? sheet.fields[field] ?? '',
      ),
    );
    const [only] = [...values];
    return values.size === 1 && only !== '' ? only : undefined;
  };
  const shared = new Map<TTagFieldKey, string>();
  fields.forEach((field) => {
    const value = sharedValue(field);
    if (value !== undefined) {
      shared.set(field, value);
    }
  });
  // Album values first: a field set for all clears that field's cells.
  const withAlbum = [...shared.entries()].reduce(
    (acc, [field, value]) => withShared(acc, field, value),
    state,
  );
  return lines
    .filter((line) => !shared.has(line.field))
    .reduce(
      (acc, line) =>
        line.trackIds.reduce((inner, id) => {
          const sheet = byId.get(id);
          return sheet ? withCell(inner, sheet, line.field, line.after) : inner;
        }, acc),
      withAlbum,
    );
};
