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
  type TLibraryBrowseMode,
  type TLibrarySort,
  type TLibrarySortDirection,
  type TLibraryViewMode,
} from '../../common/library/types';

// What the Library workspace remembers between sessions — the browse mode,
// the view, the sort and its direction, what was open in each mode, the Up
// next pane's width — each read back checked against what it may be, and
// the path of a file dropped onto the window.

/**
 * The card width below which the queue floats over the shelf instead of taking
 * a column beside it — `$bp-xl`, the standard step.
 *
 * The card now holds the rail as well (236px, 56 folded below `$bp-lg`), so
 * at 1280 a 300px queue leaves the shelf about 740px: the details table with
 * every column a song needs. Narrower, the queue would take it below 600,
 * where Album and most of Artist go — it is worth a fifth of a wide card and
 * not a third of a narrow one.
 */
export const UP_NEXT_FLOAT_WIDTH = 1280;

/** The queue's width before anybody drags its edge: the design's 300px. */
export const UP_NEXT_DEFAULT_WIDTH = 300;

/** The Up Next panel's width, dragged from its own edge. */
export const UP_NEXT_WIDTH_KEY = 'fluideq.library.upNextWidth';

/**
 * Up Next folded (`on`) or open (`off`), as the reader last left it: a
 * Library built again - after another tab played, at the next launch -
 * comes back in it, with no slide (Ivan, 2026-11-15). Absent until the
 * panel has first been shown, so a first launch keeps "folded while empty".
 */
export const UP_NEXT_COLLAPSED_KEY = 'fluideq.library.upNextCollapsed';

/**
 * The shelf rail's width, dragged at its edge (Ivan, 2026-11-15: "we need a
 * resizable splitter here", of a folder tree whose names were cut). The
 * design's 236px first; narrower than 180 the counts crowd the names, wider
 * than 420 the shelf it stands beside loses its table's columns.
 */
export const RAIL_WIDTH_KEY = 'fluideq.library.railWidth';

/**
 * The shelf rail pinned beside the shelf or folded to its glyphs
 * (`useRailPinned`), as every page's rail can be (Ivan, 2026-11-19: "the
 * library should be collapsible the same way").
 */
export const RAIL_PINNED_KEY = 'fluideq.library.railPinned';

export const RAIL_DEFAULT_WIDTH = 236;

export const RAIL_MIN = 180;

export const RAIL_MAX = 420;

export const UP_NEXT_MIN = 190;

export const UP_NEXT_MAX = 420;

export const BROWSE_MODE_KEY = 'fluideq.library.browseMode';

export const VIEW_MODE_KEY = 'fluideq.library.viewMode';

export const SORT_KEY = 'fluideq.library.sort';

export const SORT_DIRECTION_KEY = 'fluideq.library.sortDirection';

export const OPEN_ALBUM_KEY = 'fluideq.library.openAlbum';

export const OPEN_ARTIST_KEY = 'fluideq.library.openArtist';

export const OPEN_GENRE_KEY = 'fluideq.library.openGenre';

export const OPEN_FOLDER_KEY = 'fluideq.library.openFolder';

export const OPEN_PLAYLIST_KEY = 'fluideq.library.openPlaylist';

export const BROWSE_MODES: readonly TLibraryBrowseMode[] = [
  'album',
  'artist',
  'genre',
  'song',
  'folder',
  'video',
  'playlist',
];

export const VIEW_MODES: readonly TLibraryViewMode[] = [
  'list',
  'grid',
  'coverflow',
];

export const SORT_DIRECTIONS: readonly TLibrarySortDirection[] = [
  'asc',
  'desc',
];

// Every value `TLibrarySort` has, because this list is what a stored sort is
// validated against — a name missing here is a sort that cannot survive a
// restart, silently falling back to Title.
export const SORTS: readonly TLibrarySort[] = [
  'title',
  'artist',
  'album',
  'year',
  'added',
  'track',
  'plays',
  'length',
];

/**
 * Which way the Folders shelf was read — the tree, or every folder at once —
 * from when it had two readings behind its chip. The tree is the only one
 * since the rail took it over (2026-11-14), so the stored choice is removed
 * the first time a Library opens: a `false` left behind would otherwise sit
 * in the profile for ever, naming a reading nothing draws.
 */
const LEGACY_FOLDER_READING_KEY = 'fluideq.library.folderTree';

export const forgetFolderReading = (): void => {
  try {
    window.localStorage.removeItem(LEGACY_FOLDER_READING_KEY);
  } catch {
    // Storage refused: there is nothing stored to forget either.
  }
};

/**
 * A stored mode, validated against the values that actually exist.
 *
 * Same refusal `App.tsx`'s `readWorkspaceTab` applies to a stored tab name: a
 * user-editable value can hold a name an older build wrote that this one no
 * longer has, and trusting it verbatim would put the toolbar in a mode
 * nothing renders.
 */
export const readPersistedMode = <T extends string>(
  key: string,
  validValues: readonly T[],
  fallback: T,
): T => {
  try {
    const stored = window.localStorage.getItem(key);
    return validValues.find((value) => value === stored) ?? fallback;
  } catch {
    return fallback;
  }
};

export const writePersistedMode = (key: string, value: string): void => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Not worth failing a mode change over.
  }
};

/** For the drill-in ids, which have no fixed set to validate against — an
 * album key is derived from tags and can be any string. An empty stored value
 * reads back as nothing rather than as an id of `''`. */
export const readPersistedText = (key: string): string | undefined => {
  try {
    return window.localStorage.getItem(key) || undefined;
  } catch {
    return undefined;
  }
};

export const writePersistedText = (
  key: string,
  value: string | undefined,
): void => {
  try {
    if (value === undefined) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, value);
  } catch {
    // Same as above: not worth failing navigation over.
  }
};

/**
 * A dropped file's absolute path, resolved the way `KaraokeWorkspace` does.
 *
 * `webUtils.getPathForFile` is the only source of it — `File.path` was
 * removed from Electron. A folder dropped from the OS arrives as a `File`
 * too, with no readable content, so this is exactly as far as the renderer
 * goes: it hands the raw path across and main decides what is a directory.
 */
export const droppedFilePath = (file: File): string => {
  try {
    return window.electron?.ipcRenderer.getPathForFile?.(file) ?? '';
  } catch {
    return '';
  }
};
