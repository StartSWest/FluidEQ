/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the Library asks the store for, from what the toolbar and the place
 * bar say: the shelf, where the reader stands, what is typed and the order.
 * Pure, so every rule below is a line of a test rather than a thing to click
 * through.
 */

import type {
  ILibraryListQuery,
  ILibraryScope,
} from '../../common/library/query';
import type {
  TLibraryBrowseMode,
  TLibrarySort,
  TLibrarySortDirection,
  TLibraryViewMode,
} from '../../common/library/types';

export interface IShelfState {
  browseMode: TLibraryBrowseMode;
  viewMode: TLibraryViewMode;
  /** The folder the reader stands in (the place bar), if any. */
  folderPath: string | undefined;
  search: string;
  /** Nothing while a search ranks the shelf by relevance. */
  sort: TLibrarySort | undefined;
  direction: TLibrarySortDirection;
  hasRoots: boolean;
  /** Cover Flow on the Folders shelf: the level the open folder stands on,
   * so the open one is among its neighbours. */
  folderLevel: string | undefined;
}

const ordered = (
  sort: TLibrarySort | undefined,
  direction: TLibrarySortDirection,
) => ({ direction, ...(sort === undefined ? {} : { sort }) });

/**
 * THE FOLDER THE READER STANDS IN IS WHERE THEY ARE, ON EVERY SHELF — and a
 * search from inside it reaches the whole library, that folder's matches
 * first (`near`) and everything else after under a heading of its own
 * (Ivan, 2026-09-23). Without a search the shelf is narrowed to it. On the
 * Folders shelf the folder is not a narrowing but the thing opened, so that
 * shelf is never narrowed by it.
 */
const whereOf = (
  state: IShelfState,
): { scope: ILibraryScope; search?: string; near?: string } => {
  const search = state.search.trim();
  if (search === '') {
    return {
      scope:
        state.folderPath !== undefined && state.browseMode !== 'folder'
          ? { beneath: state.folderPath }
          : {},
    };
  }
  return {
    scope: {},
    search: state.search,
    ...(state.folderPath === undefined ? {} : { near: state.folderPath }),
  };
};

/** The shelf on screen when nothing is drilled into; nothing for playlists,
 * which are the listener's own. */
export const shelfQueryFor = (
  state: IShelfState,
): ILibraryListQuery | undefined => {
  const where = whereOf(state);
  const order = ordered(state.sort, state.direction);
  switch (state.browseMode) {
    case 'album':
      return { shelf: 'albums', ...where, ...order };
    case 'artist':
      return { shelf: 'artists', ...where, ...order };
    case 'genre':
      return { shelf: 'genres', ...where, ...order };
    case 'song':
      // A heading over each folder's run in the table, where the folder a
      // file came from is the only structure a flat run of songs has left.
      // Tiles and covers carry no headings.
      return {
        shelf: 'tracks',
        ...where,
        ...order,
        ...(state.viewMode === 'list' ? { folderHeadings: true } : {}),
      };
    case 'video':
      // By folder, a heading over each, and a search that narrows without
      // scattering them out of their folders.
      return {
        shelf: 'tracks',
        ...where,
        scope: { ...where.scope, kind: 'video' },
        direction: state.direction,
        natural: 'path',
        folderHeadings: true,
        unranked: true,
      };
    case 'folder':
      // ONE READING: the tree, the roots first and a level at a time, as the
      // rail draws it. The flat list of every folder at once was a second
      // reading behind the chip until 2026-11-14, when the tree moved into
      // the rail and made it redundant. A search is still flat: what
      // somebody searching wants is where the matches are, every folder
      // holding one, wherever it sits.
      if (where.search !== undefined || !state.hasRoots) {
        return { shelf: 'folders', ...where, ...order };
      }
      if (state.viewMode === 'coverflow' && state.folderLevel !== undefined) {
        return {
          shelf: 'children',
          scope: {},
          parent: state.folderLevel,
          ...order,
        };
      }
      return { shelf: 'roots', scope: {}, ...order };
    default:
      return undefined;
  }
};

/**
 * The shelf's songs, in the shelf's order — what Next walks when nothing
 * with a list of its own is open. For a shelf of songs or videos, the shelf
 * itself; for a shelf of containers, the songs in them.
 */
export const shelfTracksQueryFor = (
  state: IShelfState,
  shelf: ILibraryListQuery | undefined,
): ILibraryListQuery | undefined => {
  if (shelf?.shelf === 'tracks') {
    return shelf;
  }
  if (state.browseMode === 'playlist') {
    return undefined;
  }
  return {
    shelf: 'tracks',
    ...whereOf(state),
    ...ordered(state.sort, state.direction),
  };
};
