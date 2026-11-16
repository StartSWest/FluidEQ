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

import { type RefObject, useCallback } from 'react';
import type { ILibraryList } from '../useLibraryList';
import { useTagEditorIfAny } from './TagEditorContext';

/** Songs either side of the one opened that ‹ › can walk to: a screenful
 * of an album many times over, and a bounded ask on a shelf of thousands. */
const WALK_REACH = 500;

/**
 * What a song list's "Edit tags" does: one song opens the side panel,
 * walking the songs around it in the list's own order; several open the
 * editor page on that selection. `undefined` where no editor stands above
 * (a harness of the list alone), so the menu leaves the item out.
 */
export const useListTagEditing = (
  listRef: RefObject<ILibraryList | undefined>,
): ((trackIds: readonly string[]) => void) | undefined => {
  const editor = useTagEditorIfAny();
  const edit = useCallback(
    (trackIds: readonly string[]) => {
      if (editor === undefined || trackIds.length === 0) {
        return;
      }
      const [first] = trackIds;
      if (trackIds.length > 1) {
        editor.openSet('selection', trackIds, '');
        return;
      }
      const { current } = listRef;
      if (current?.query === undefined) {
        editor.openSong([first], first);
        return;
      }
      const at = current.indexOf(first);
      const songAt = Math.max(0, at - (current.lead ?? 0));
      window.electron.ipcRenderer
        .queryLibrary({
          type: 'ids',
          query: current.query,
          offset: Math.max(0, songAt - WALK_REACH),
          limit: WALK_REACH * 2,
        })
        .then((ids) => {
          editor.openSong(ids.includes(first) ? ids : [first], first);
          return undefined;
        })
        .catch(() => editor.openSong([first], first));
    },
    [editor, listRef],
  );
  return editor === undefined ? undefined : edit;
};

/** What a song list's "Fix tags automatically" does: the proposals for the
 * songs chosen, one or many. */
export const useListTagFixing = ():
  ((trackIds: readonly string[]) => void) | undefined => {
  const editor = useTagEditorIfAny();
  const fix = useCallback(
    (trackIds: readonly string[]) => {
      if (editor !== undefined && trackIds.length > 0) {
        editor.openFix('selection', trackIds, '');
      }
    },
    [editor],
  );
  return editor === undefined ? undefined : fix;
};
