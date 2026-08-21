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
 * The folders a view shows, under whichever reading is on.
 *
 * One hook for the three views, because "which folders" is the same question
 * in a list, a grid and a fan of covers — only the drawing differs, and each
 * of them already knows how to draw an `ILibraryFolder`.
 *
 * FLAT is every directory holding a file, all at once, and it is what the
 * Folders chip has always meant. TREE is the roots somebody added, walked one
 * level at a time — see `folderTree` for why both are worth having.
 *
 * With no roots to walk it answers flat whatever the setting says. That is
 * the honest fallback rather than an empty screen: a view rendered without
 * the library's roots — a test, or a moment before the index arrives — knows
 * the folders its tracks are in and knows nothing about the tree above them.
 */

import { useMemo } from 'react';
import {
  ILibraryFolder,
  folderChildren,
  groupIntoFolders,
  rootFolders,
} from '../../common/library/grouping';
import type { ILibraryTrack } from '../../common/library/types';
import { useFolderTree } from './folderTree';

export const useFolderEntries = (
  tracks: readonly ILibraryTrack[],
  roots: readonly { path: string }[],
  parentPath?: string,
): ILibraryFolder[] => {
  const asTree = useFolderTree();
  return useMemo(() => {
    if (!asTree || roots.length === 0) {
      return groupIntoFolders(tracks);
    }
    // A level below the roots is only ever drawn by the drill-in, which knows
    // where it is; everywhere else the level is the top of the tree.
    return parentPath === undefined
      ? rootFolders(tracks, roots)
      : folderChildren(tracks, parentPath);
  }, [asTree, parentPath, roots, tracks]);
};

export default useFolderEntries;
