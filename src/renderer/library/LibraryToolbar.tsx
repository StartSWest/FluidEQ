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
  TLibraryViewMode,
} from '../../common/library/types';
import { useTranslation } from '../utils/I18nContext';
import Dropdown from '../widgets/Dropdown';
import { IOptionEntry } from '../widgets/List';

interface ILibraryToolbarProps {
  browseMode: TLibraryBrowseMode;
  viewMode: TLibraryViewMode;
  sort: TLibrarySort;
  query: string;
  onBrowseMode: (mode: TLibraryBrowseMode) => void;
  onViewMode: (mode: TLibraryViewMode) => void;
  onSort: (sort: TLibrarySort) => void;
  onQuery: (query: string) => void;
}

const BROWSE_MODES: readonly TLibraryBrowseMode[] = ['album', 'artist', 'song'];
const VIEW_MODES: readonly TLibraryViewMode[] = ['list', 'grid', 'coverflow'];
const SORTS: readonly TLibrarySort[] = [
  'title',
  'artist',
  'album',
  'year',
  'added',
];

/** Whichever `useLibrary` roots/actions this row needs live one level up, in
 * `LibraryWorkspace` — this component is a pure controlled toolbar, testable
 * without a `LibraryProvider` above it. */
const LibraryToolbar = ({
  browseMode,
  viewMode,
  sort,
  query,
  onBrowseMode,
  onViewMode,
  onSort,
  onQuery,
}: ILibraryToolbarProps) => {
  const { t } = useTranslation();

  const browseLabel = (mode: TLibraryBrowseMode) => {
    if (mode === 'artist') {
      return t('library.browse.artist');
    }
    if (mode === 'song') {
      return t('library.browse.song');
    }
    return t('library.browse.album');
  };

  const viewLabel = (mode: TLibraryViewMode) => {
    if (mode === 'grid') {
      return t('library.view.grid');
    }
    if (mode === 'coverflow') {
      return t('library.view.coverflow');
    }
    return t('library.view.list');
  };

  const sortLabel = (value: TLibrarySort) => {
    if (value === 'artist') {
      return t('library.sort.artist');
    }
    if (value === 'album') {
      return t('library.sort.album');
    }
    if (value === 'year') {
      return t('library.sort.year');
    }
    if (value === 'added') {
      return t('library.sort.added');
    }
    return t('library.sort.title');
  };

  const sortOptions: IOptionEntry[] = SORTS.map((value) => ({
    value,
    label: sortLabel(value),
    display: sortLabel(value),
  }));

  // The options above are the only source of a sort value that reaches this
  // handler, so this is always true in practice — but `Dropdown.handleChange`
  // is typed as `(newValue: string) => void`, and a plain cast back to
  // `TLibrarySort` would be trusting that without checking it.
  const isLibrarySort = (value: string): value is TLibrarySort =>
    (SORTS as readonly string[]).includes(value);

  return (
    <div className="library-toolbar">
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
            className={`workspace-tab${
              browseMode === mode ? ' is-active' : ''
            }`}
            onClick={() => onBrowseMode(mode)}
          >
            {browseLabel(mode)}
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
            className={`button small${viewMode === mode ? '' : ' subtle'}`}
            onClick={() => onViewMode(mode)}
          >
            {viewLabel(mode)}
          </button>
        ))}
      </div>
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
      </div>
      <div className="library-toolbar__search">
        <input
          type="search"
          className="library-toolbar__search-input"
          value={query}
          aria-label={t('library.search')}
          placeholder={t('library.searchPlaceholder')}
          onChange={(event) => onQuery(event.target.value)}
        />
      </div>
    </div>
  );
};

export default LibraryToolbar;
