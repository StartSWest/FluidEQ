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

import { useEffect, useRef, useState } from 'react';
import { suggestSearches } from 'common/searchHistory';
import type {
  TLibraryBrowseMode,
  TLibrarySort,
  TLibrarySortDirection,
  TLibraryViewMode,
} from '../../common/library/types';
import { useTranslation } from '../utils/I18nContext';
import Dropdown from '../widgets/Dropdown';
import MenuIcon from '../icons/MenuIcon';
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
  onQuery: (query: string) => void;
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

  // Recent searches, the same list the Media tab keeps and under the same
  // rules — see `librarySearchHistory`. The box filters live as it always
  // did; what a term has to survive to be remembered is a pause, which is
  // what `commit` below is called on.
  const history = librarySearchHistory.use();
  const suggestions = suggestSearches(history, query);
  const [isFocused, setIsFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const isListShowing = isFocused && suggestions.length > 0;

  // A click anywhere else closes the list. Focus alone is not enough: the
  // suggestion buttons take mousedown without taking focus, so relying on
  // blur would close the list before the click it was closing for landed.
  useEffect(() => {
    if (!isFocused) {
      return undefined;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) {
        setIsFocused(false);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    return () => window.removeEventListener('mousedown', onPointerDown);
  }, [isFocused]);

  /** Remembers what is in the box now. Called on Enter and on leaving the
   * field, never on every keystroke — a history of every prefix somebody
   * typed on the way to "beatles" is not a history of anything. */
  const commit = () => {
    librarySearchHistory.add(query.trim());
  };

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
      {/* The Media tab's capsule, reused rather than redrawn: the magnifier
          inside the field, the whole thing lighting on focus, and a clear
          button that appears only once there is something to clear.
          `type="text"` rather than `"search"` — Chromium draws its own clear
          glyph on a search input, which sits badly on a dark capsule and
          cannot be styled. */}
      <div className="library-toolbar__search" ref={searchRef}>
        <div
          className={`library-search__field${isListShowing ? ' is-open' : ''}`}
        >
          <svg className="library-search__icon" viewBox="0 0 16 16" aria-hidden>
            <circle cx="7" cy="7" r="4.4" />
            <path d="M10.4 10.4L14 14" />
          </svg>
          <input
            type="text"
            // Stated because the type no longer implies it. `type="search"`
            // carries this role natively, and it is the honest one for a
            // field that filters a list — dropping it to control Chromium's
            // clear glyph would have traded the semantics for the styling.
            role="searchbox"
            className="library-search__input"
            value={query}
            aria-label={t('library.search')}
            placeholder={t('library.searchPlaceholder')}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => onQuery(event.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                commit();
                setIsFocused(false);
              }
              if (event.key === 'Escape') {
                setIsFocused(false);
              }
            }}
          />
          {query.length > 0 && (
            <button
              type="button"
              className="library-search__clear"
              aria-label={t('app.dismiss')}
              onClick={() => onQuery('')}
            >
              <MenuIcon name="clear" className="library-search__clear-icon" />
            </button>
          )}
        </div>
        {isListShowing && (
          <div className="library-search__suggestions">
            <div className="library-search__suggestions-title">
              {t('video.searchRecent')}
            </div>
            <ul role="listbox" aria-label={t('video.searchRecent')}>
              {suggestions.map((term) => (
                <li key={term} role="option" aria-selected={term === query}>
                  {/* Mouse-down rather than click, the same reason
                      `VideoSearch` gives: the click would land after the input
                      had lost focus and closed the list out from under the
                      pointer. */}
                  <button
                    type="button"
                    className="library-search__suggestion"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      onQuery(term);
                      librarySearchHistory.add(term);
                      setIsFocused(false);
                    }}
                  >
                    <svg viewBox="0 0 16 16" aria-hidden>
                      <path d="M8 4v4l2.6 1.6" />
                      <circle cx="8" cy="8" r="5.6" />
                    </svg>
                    <span>{term}</span>
                  </button>
                  <button
                    type="button"
                    className="library-search__forget"
                    aria-label={t('video.searchForget', { term })}
                    title={t('video.searchForget', { term })}
                    onMouseDown={(event) => {
                      // Kept off the input's blur so the box stays focused and
                      // the list stays open — dropping four old searches
                      // should be four clicks, not four clicks and three
                      // re-focuses.
                      event.preventDefault();
                      event.stopPropagation();
                      librarySearchHistory.remove(term);
                    }}
                  >
                    <svg viewBox="0 0 12 12" aria-hidden>
                      <path d="M3 3l6 6M9 3l-6 6" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="library-search__forget-all"
              onMouseDown={(event) => {
                event.preventDefault();
                librarySearchHistory.clear();
                setIsFocused(false);
              }}
            >
              {t('video.searchForgetAll')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LibraryToolbar;
