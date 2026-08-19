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

const BROWSE_MODES: readonly TLibraryBrowseMode[] = [
  'album',
  'artist',
  'song',
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
  query,
  onBrowseMode,
  onViewMode,
  onSort,
  onQuery,
}: ILibraryToolbarProps) => {
  const { t } = useTranslation();

  const sortOptions: IOptionEntry[] = SORTS.map((value) => ({
    value,
    label: t(SORT_LABEL_KEYS[value]),
    display: t(SORT_LABEL_KEYS[value]),
  }));

  // The options above are the only source of a sort value that reaches this
  // handler, so this is always true in practice — but `Dropdown.handleChange`
  // is typed as `(newValue: string) => void`, and a plain cast back to
  // `TLibrarySort` would be trusting that without checking it.
  const isLibrarySort = (value: string): value is TLibrarySort =>
    (SORTS as readonly string[]).includes(value);

  return (
    <div className="library-toolbar">
      {/* Same segmented-control look as the view modes just below it, not
          the top-level `.workspace-tab` shape — that class is drawn to sit
          flush against `.workspace-tabs`' own border-bottom seam, which this
          row does not have. `role="tab"`/`aria-selected` stay: it is still a
          tablist, only its styling moved to match its neighbour. */}
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
            className={`button small${browseMode === mode ? '' : ' subtle'}`}
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
            className={`button small${viewMode === mode ? '' : ' subtle'}`}
            onClick={() => onViewMode(mode)}
          >
            {t(VIEW_LABEL_KEYS[mode])}
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
