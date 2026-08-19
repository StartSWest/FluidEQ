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
  TLibraryBrowseMode,
  TLibrarySort,
  TLibrarySortDirection,
  TLibraryViewMode,
} from '../../common/library/types';
import { useTranslation } from '../utils/I18nContext';
import Dropdown from '../widgets/Dropdown';
import LibrarySearchField from './LibrarySearchField';
import { IOptionEntry } from '../widgets/List';
import { librarySearchHistory } from '../utils/librarySearchHistory';

interface ILibraryToolbarProps {
  browseMode: TLibraryBrowseMode;
  viewMode: TLibraryViewMode;
  sort: TLibrarySort;
  sortDirection: TLibrarySortDirection;
  query: string;
  onBrowseMode: (mode: TLibraryBrowseMode) => void;
  onViewMode: (mode: TLibraryViewMode) => void;
  /** Omitted while a drill-in is open, which is what takes the sort control
   * off the bar: inside an album the order is the record's own, set by that
   * table's headers, and a second control here would have been steering a
   * list that is not on screen. Same "no handler, no control" rule
   * `LibraryListView` uses for its own headers. */
  onSort?: (sort: TLibrarySort) => void;
  onSortDirection?: () => void;
  /** Withheld while a drill-in is open, which is what takes the search box
   * off the bar: inside an album the drill-in has its own filter, and a
   * library-wide search there changes nothing the reader can see. Same "no
   * handler, no control" rule the sort control follows. */
  onQuery?: (query: string) => void;
}

const BROWSE_MODES: readonly TLibraryBrowseMode[] = [
  'album',
  'artist',
  'song',
  'folder',
  'video',
];
const VIEW_MODES: readonly TLibraryViewMode[] = ['list', 'grid', 'coverflow'];
const SORTS: readonly TLibrarySort[] = [
  'title',
  'artist',
  'album',
  'year',
  'added',
];

const BROWSE_LABEL_KEYS = {
  album: 'library.browse.album',
  artist: 'library.browse.artist',
  song: 'library.browse.song',
  folder: 'library.browse.folder',
  video: 'library.videos',
} as const;

const VIEW_LABEL_KEYS = {
  list: 'library.view.list',
  grid: 'library.view.grid',
  coverflow: 'library.view.coverflow',
} as const;

const SORT_LABEL_KEYS = {
  title: 'library.sort.title',
  artist: 'library.sort.artist',
  album: 'library.sort.album',
  year: 'library.sort.year',
  added: 'library.sort.added',
} as const;

/** Whichever `useLibrary` roots/actions this row needs live one level up, in
 * `LibraryWorkspace` — this component is a pure controlled toolbar, testable
 * without a `LibraryProvider` above it. */
const LibraryToolbar = ({
  browseMode,
  viewMode,
  sort,
  sortDirection,
  query,
  onBrowseMode,
  onViewMode,
  onSort,
  onSortDirection,
  onQuery,
}: ILibraryToolbarProps) => {
  const { t } = useTranslation();

  // The open menu lists the columns; the closed trigger says what it is for.
  // Without the prefix the control reads as a label for whatever it happens
  // to be set to — a box saying "Title" beside a search box saying nothing.
  const sortOptions: IOptionEntry[] = SORTS.map((value) => ({
    value,
    label: t(SORT_LABEL_KEYS[value]),
    display:
      value === sort
        ? t('library.sortBy', { value: t(SORT_LABEL_KEYS[value]) })
        : t(SORT_LABEL_KEYS[value]),
  }));

  // The options above are the only source of a sort value that reaches this
  // handler, so this is always true in practice — but `Dropdown.handleChange`
  // is typed as `(newValue: string) => void`, and a plain cast back to
  // `TLibrarySort` would be trusting that without checking it.
  const isLibrarySort = (value: string): value is TLibrarySort =>
    (SORTS as readonly string[]).includes(value);

  return (
    <div className="library-toolbar">
      {/* The Media tab's own chips — `.video-browser__site`'s pill, reused
          under this file's class names rather than redrawn, so the two
          toolbars read as the same toolbar. `role="tab"`/`aria-selected`
          stay: it is still a tablist, only its styling moved. */}
      <div
        className="library-toolbar__browse-modes"
        role="tablist"
        aria-label={t('library.browse.aria')}
      >
        {BROWSE_MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={browseMode === mode}
            className={`library-toolbar__chip${
              browseMode === mode ? ' is-active' : ''
            }`}
            onClick={() => onBrowseMode(mode)}
          >
            {t(BROWSE_LABEL_KEYS[mode])}
          </button>
        ))}
      </div>
      <div
        className="library-toolbar__view-modes"
        role="group"
        aria-label={t('library.view.aria')}
      >
        {VIEW_MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            aria-pressed={viewMode === mode}
            className={`library-toolbar__chip${
              viewMode === mode ? ' is-active' : ''
            }`}
            onClick={() => onViewMode(mode)}
          >
            {t(VIEW_LABEL_KEYS[mode])}
          </button>
        ))}
      </div>
      {/* Kept alongside the sortable column headers, not instead of them: the
          grid and cover flow have no columns to click, and this is the only
          way to reorder them. The arrow beside it is the direction, which a
          header click toggles in the list and nothing else could here. */}
      {onSort && onSortDirection && (
        <div className="library-toolbar__sort">
          <Dropdown
            name={t('library.sort')}
            options={sortOptions}
            value={sort}
            isDisabled={false}
            handleChange={(newValue) => {
              if (isLibrarySort(newValue)) {
                onSort(newValue);
              }
            }}
          />
          <button
            type="button"
            className="library-toolbar__chip library-toolbar__sort-direction"
            aria-label={t('library.sort.direction')}
            title={t('library.sort.direction')}
            onClick={onSortDirection}
          >
            <span aria-hidden="true">
              {sortDirection === 'desc' ? '▾' : '▴'}
            </span>
          </button>
        </div>
      )}
      {/* Withheld while a drill-in is open — the workspace passes no handler
          then. Inside an album this box searched the whole library and
          changed nothing on screen, which read as a search that had stopped
          working; the drill-in has its own filter, and one search that does
          what the screen it is on suggests beats two that disagree. */}
      {onQuery && (
        <div className="library-toolbar__search">
          <LibrarySearchField
            value={query}
            onChange={onQuery}
            label={t('library.searchPlaceholder')}
            history={librarySearchHistory}
          />
        </div>
      )}
    </div>
  );
};

export default LibraryToolbar;
