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

import type { ReactNode } from 'react';
import type {
  TLibraryBrowseMode,
  TLibrarySort,
  TLibrarySortDirection,
  TLibraryViewMode,
} from '../../common/library/types';
import { useTranslation } from '../utils/I18nContext';
import MenuIcon, { type MenuIconName } from '../icons/MenuIcon';
import Dropdown from '../widgets/Dropdown';
import LibrarySearchField from './LibrarySearchField';
import librarySearchHistory from '../utils/librarySearchHistory';
import { IOptionEntry } from '../widgets/List';

const VIEW_MODES = [
  { mode: 'list', icon: 'viewList', label: 'library.view.list' },
  { mode: 'grid', icon: 'viewGrid', label: 'library.view.grid' },
  { mode: 'coverflow', icon: 'viewCoverFlow', label: 'library.view.coverflow' },
] as const satisfies readonly {
  mode: TLibraryViewMode;
  icon: MenuIconName;
  label: string;
}[];

const SORTS: readonly TLibrarySort[] = [
  'track',
  'title',
  'artist',
  'album',
  'year',
  'added',
  'plays',
  'length',
];

const SORT_LABEL_KEYS = {
  track: 'library.sort.track',
  title: 'library.sort.title',
  artist: 'library.sort.artist',
  album: 'library.sort.album',
  year: 'library.sort.year',
  added: 'library.sort.added',
  plays: 'library.sort.plays',
  length: 'library.sort.length',
} as const;

/**
 * The shelves whose rows are not tracks — an artist, a genre, a folder —
 * carry a name, a count and a date and nothing else, so they get the three
 * orders they actually have, named after what they do. Six options with four
 * collapsing onto the name order, and "Year" quietly ordering by how many
 * tracks each held, was the alternative.
 */
const NAMED_SHELVES: readonly TLibraryBrowseMode[] = [
  'artist',
  'genre',
  'folder',
];

const NAMED_SHELF_SORTS: readonly TLibrarySort[] = ['title', 'year', 'added'];

const NAMED_SHELF_LABEL_KEYS = {
  title: 'library.sort.name',
  year: 'library.sort.count',
  added: 'library.sort.added',
} as const;

export interface ILibraryTopBarHistory {
  canGoBack: boolean;
  canGoForward: boolean;
  onGoBack: () => void;
  onGoForward: () => void;
}

interface ILibraryTopBarProps {
  browseMode: TLibraryBrowseMode;
  viewMode: TLibraryViewMode;
  sort: TLibrarySort;
  sortDirection: TLibrarySortDirection;
  onViewMode: (mode: TLibraryViewMode) => void;
  /** Omitted where the order is not the shelf's to choose — inside a
   * record, whose own headers order it, and on Playlists, which keep their
   * own order. No handler, no control: a dropdown that changes nothing is
   * worse than none. */
  onSort?: (sort: TLibrarySort) => void;
  onSortDirection?: () => void;
  query: string;
  onQuery: (query: string) => void;
  /** Back and Forward through the reader's own steps. Absent while a video
   * has the tab: there is no shelf on screen for them to walk, and a second
   * Back beside the picture's own would not say which one leaves it. */
  history?: ILibraryTopBarHistory;
  /** What stands at the bar's right end: the Up Next toggle. */
  tail?: ReactNode;
}

/**
 * THE LIBRARY'S TOP BAR: where you have been, what you are looking for, and
 * how it is laid out (Ivan, 2026-11-14: the "A + C" design).
 *
 * Back and Forward first, as a file browser has them; the search, which is
 * never withheld — a search box that comes and goes is worse than a narrow
 * one; the three views as one segmented switch; the order. The shelves moved
 * to the rail, Add folder and the folders to the rail's foot, Rescan to the
 * status line beside the scan it starts. What is left is one calm row.
 *
 * It wraps rather than crushes: below its natural width the search takes a
 * line of its own (`_libraryWorkspace.scss`), never the three views a word
 * at a time. A pure controlled view, testable without a provider.
 */
const LibraryTopBar = ({
  browseMode,
  viewMode,
  sort,
  sortDirection,
  onViewMode,
  onSort,
  onSortDirection,
  query,
  onQuery,
  history,
  tail,
}: ILibraryTopBarProps) => {
  const { t } = useTranslation();

  // The open menu lists the orders; the closed trigger says what it is for,
  // or it reads as a label for whatever it happens to be set to.
  const isNamedShelf = NAMED_SHELVES.includes(browseMode);
  const offered = isNamedShelf ? NAMED_SHELF_SORTS : SORTS;
  const sortLabel = (value: TLibrarySort) =>
    t(
      isNamedShelf
        ? NAMED_SHELF_LABEL_KEYS[value as keyof typeof NAMED_SHELF_LABEL_KEYS]
        : SORT_LABEL_KEYS[value],
    );
  // A sort the named shelves do not offer is their name order, so the
  // trigger names the order in force rather than going blank.
  const shown: TLibrarySort =
    !isNamedShelf || offered.includes(sort) ? sort : 'title';
  const sortOptions: IOptionEntry[] = offered.map((value) => ({
    value,
    label: sortLabel(value),
    display:
      value === shown
        ? t('library.sortBy', { value: sortLabel(value) })
        : sortLabel(value),
  }));
  const isLibrarySort = (value: string): value is TLibrarySort =>
    (SORTS as readonly string[]).includes(value);

  return (
    <div className="library-top">
      {history && (
        <div
          className="library-top__nav"
          role="group"
          aria-label={t('library.history')}
        >
          <button
            type="button"
            className="library-top__arrow"
            aria-label={t('library.back')}
            title={t('library.back')}
            disabled={!history.canGoBack}
            onClick={history.onGoBack}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M10 3.5L5.5 8l4.5 4.5" />
            </svg>
          </button>
          <button
            type="button"
            className="library-top__arrow"
            aria-label={t('library.forward')}
            title={t('library.forward')}
            disabled={!history.canGoForward}
            onClick={history.onGoForward}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M6 3.5L10.5 8 6 12.5" />
            </svg>
          </button>
        </div>
      )}
      <div className="library-top__search">
        <LibrarySearchField
          value={query}
          onChange={onQuery}
          label={t('library.searchPlaceholder')}
          history={librarySearchHistory}
        />
      </div>
      <div className="library-top__controls">
        {/* Every shelf, Videos included, reads in all three (Ivan,
            2026-11-15: "we can show by folders, list etc similar to music",
            and of Cover Flow, "we want it there also, definitely"). */}
        <div
          className="library-top__views"
          role="group"
          aria-label={t('library.view.aria')}
        >
          {VIEW_MODES.map(({ mode, icon, label }) => {
            const isActive = viewMode === mode;
            return (
              <button
                key={mode}
                type="button"
                aria-pressed={isActive}
                className={`library-top__view${isActive ? ' is-active' : ''}`}
                title={t(label)}
                onClick={() => onViewMode(mode)}
              >
                <MenuIcon name={icon} className="library-top__view-icon" />
                <span>{t(label)}</span>
              </button>
            );
          })}
        </div>
        {onSort && onSortDirection && (
          <div className="library-top__sort">
            <Dropdown
              name={t('library.sort')}
              options={sortOptions}
              value={shown}
              isDisabled={false}
              handleChange={(newValue) => {
                if (isLibrarySort(newValue)) {
                  onSort(newValue);
                }
              }}
            />
            <button
              type="button"
              className="library-top__arrow library-top__direction"
              aria-label={t('library.sort.direction')}
              title={t('library.sort.direction')}
              onClick={onSortDirection}
            >
              <svg
                viewBox="0 0 16 16"
                aria-hidden="true"
                className={sortDirection === 'desc' ? 'is-desc' : undefined}
              >
                <path d="M8 13V3.5M4.5 7L8 3.5 11.5 7" />
              </svg>
            </button>
          </div>
        )}
        {tail}
      </div>
    </div>
  );
};

export default LibraryTopBar;
