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
 * The details table's columns (the "A + C" design, Ivan 2026-11-14): `#` and
 * Title always, then the ones the reader chose from the header's chooser —
 * Artist, Album, Format, Plays and Time to begin with, as the mockup draws
 * them, Year and Genre on offer — remembered between sessions.
 */

import { useCallback, useSyncExternalStore } from 'react';
import type { TLibrarySort } from '../../common/library/types';

export const OPTIONAL_COLUMNS = [
  'artist',
  'album',
  'year',
  'genre',
  'format',
  'plays',
  'time',
] as const;

export type TLibraryColumn = (typeof OPTIONAL_COLUMNS)[number];

/** What a fresh table shows: the mockup's columns. */
const DEFAULT_COLUMNS: readonly TLibraryColumn[] = [
  'artist',
  'album',
  'format',
  'plays',
  'time',
];

export const COLUMN_LABEL_KEYS = {
  artist: 'library.column.artist',
  album: 'library.column.album',
  year: 'library.column.year',
  genre: 'library.column.genre',
  format: 'library.column.format',
  plays: 'library.column.plays',
  time: 'library.column.length',
} as const;

/** The order a header press asks for; a column without one is a label. */
export const COLUMN_SORTS: Partial<Record<TLibraryColumn, TLibrarySort>> = {
  artist: 'artist',
  album: 'album',
  year: 'year',
  plays: 'plays',
  time: 'length',
};

/** Numbers line up on their right edge, as a reader compares them. */
export const NUMERIC_COLUMNS: ReadonlySet<TLibraryColumn> = new Set([
  'year',
  'plays',
  'time',
]);

/**
 * Each column's track, as shares of the table the way the mockup's table
 * lays them out at full width — Title a quarter, Artist and Album a fifth
 * each, Format, Plays and Time the rest — with floors under the narrow ones.
 * The floors are their headings in every language, measured in the window
 * (11px bold capitals): Time's longest is Italian's DURATA at 51px, Year's
 * French's ANNÉE at 43, Format's FORMATO at 61, each with the sort arrow
 * and the cell's padding (4px before a number, 12 after). Plays runs to
 * 119px in Russian; it takes a floor that holds the shorter languages, and
 * a narrow table cuts the longest with an ellipsis, the whole word on its
 * tooltip, as a file manager's headings do.
 */
const TRACKS: Record<TLibraryColumn, string> = {
  artist: 'minmax(0, 1.8fr)',
  album: 'minmax(0, 2fr)',
  year: 'minmax(72px, 0.8fr)',
  genre: 'minmax(0, 1.2fr)',
  format: 'minmax(80px, 1.6fr)',
  plays: 'minmax(84px, 1fr)',
  time: 'minmax(80px, 0.8fr)',
};

/** `#`, Title, the chosen columns in their fixed order, the chooser. */
export const columnTemplate = (columns: readonly TLibraryColumn[]): string =>
  [
    '44px',
    'minmax(0, 2.5fr)',
    ...columns.map((column) => TRACKS[column]),
    '34px',
  ].join(' ');

/** The least a column can be read in, for deciding what fits. */
const MIN_WIDTHS: Record<TLibraryColumn, number> = {
  artist: 120,
  album: 120,
  year: 72,
  genre: 100,
  format: 80,
  plays: 84,
  time: 80,
};

/** `#`, a title that can still be read, and the chooser. */
const FIXED_WIDTH = 44 + 180 + 34;

/** Which chosen column steps aside first on a narrow table. Time never. */
const STEP_ASIDE: readonly TLibraryColumn[] = [
  'genre',
  'year',
  'plays',
  'format',
  'album',
  'artist',
];

/**
 * The chosen columns a table this wide can show: the least needed step aside
 * one at a time until the rest fit, rather than every column squeezed to two
 * letters. They come back when there is room; the choice itself is kept.
 * Nothing is taken away before the table has been measured.
 */
export const fitColumns = (
  columns: readonly TLibraryColumn[],
  width: number,
): readonly TLibraryColumn[] => {
  if (width <= 0) {
    return columns;
  }
  const neededFor = (shown: readonly TLibraryColumn[]) =>
    FIXED_WIDTH + shown.reduce((sum, name) => sum + MIN_WIDTHS[name], 0);
  return STEP_ASIDE.reduce<readonly TLibraryColumn[]>(
    (shown, column) =>
      neededFor(shown) <= width
        ? shown
        : shown.filter((name) => name !== column),
    columns,
  );
};

const STORAGE_KEY = 'fluideq.library.columns';

const read = (): readonly TLibraryColumn[] => {
  try {
    const stored: unknown = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? 'null',
    );
    if (!Array.isArray(stored)) {
      return DEFAULT_COLUMNS;
    }
    // Known names only, in the table's own order: a value an older or newer
    // build wrote can neither add a column nothing draws nor reorder them.
    return OPTIONAL_COLUMNS.filter((column) => stored.includes(column));
  } catch {
    return DEFAULT_COLUMNS;
  }
};

let columns = read();
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * The columns every details table shows, and a way to show or hide one. One
 * choice for the whole Library: a column chosen on Songs is there when an
 * album opens, as it is in a file manager.
 */
export const useLibraryColumns = (): {
  columns: readonly TLibraryColumn[];
  toggleColumn: (column: TLibraryColumn) => void;
} => {
  const shown = useSyncExternalStore(
    subscribe,
    () => columns,
    () => DEFAULT_COLUMNS,
  );
  const toggleColumn = useCallback((column: TLibraryColumn) => {
    columns = OPTIONAL_COLUMNS.filter((name) =>
      name === column ? !columns.includes(name) : columns.includes(name),
    );
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(columns));
    } catch {
      // Storage refused: the choice lasts as long as the window.
    }
    listeners.forEach((listener) => listener());
  }, []);
  return { columns: shown, toggleColumn };
};

/**
 * The file's format as its badge says it: the extension, in capitals —
 * FLAC, MP3, M4A. The codec name the tags carry is longer and less familiar
 * ("MPEG 1 Layer 3"); it is in the Details pane.
 */
export const formatOf = (filePath: string): string => {
  const name = filePath.split(/[\\/]/).pop() ?? '';
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toUpperCase() : '';
};
