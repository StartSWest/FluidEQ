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

import { useEffect, useState } from 'react';
import type {
  TLibraryBrowseMode,
  TLibrarySort,
  TLibrarySortDirection,
  TLibraryViewMode,
} from '../../common/library/types';
import { useTranslation } from '../utils/I18nContext';
import ArrowIcon from '../icons/ArrowIcon';
import AnchoredMenu, { isInsideAnchoredMenu } from '../widgets/AnchoredMenu';
import Dropdown from '../widgets/Dropdown';
import { setFolderTree, useFolderTree } from './folderTree';
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
  /** Always supplied by `LibraryWorkspace`, unlike the sort handlers beside
   * it. This box was withheld inside a drill-in once and that was wrong: a
   * search control that comes and goes is worse than a narrow one. Optional
   * only so a test can render the bar without one. */
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

/** The two readings of the same shelf, in the order the menu offers them. */
const FOLDER_READINGS = [
  {
    key: 'library.browse.folder',
    hint: 'library.browse.folderHint',
    asTree: false,
  },
  {
    key: 'library.browse.directory',
    hint: 'library.browse.directoryHint',
    asTree: true,
  },
] as const;

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
  const asTree = useFolderTree();
  const [folderMenuAnchor, setFolderMenuAnchor] = useState<HTMLElement | null>(
    null,
  );

  /**
   * A press elsewhere puts it away, and so does Escape.
   *
   * The menu is portalled to the body, so "elsewhere" cannot be answered by
   * asking whether the press was inside this toolbar — `isInsideAnchoredMenu`
   * is what every other menu here asks, and this one was the only one that
   * stayed open until its own trigger was pressed again.
   */
  useEffect(() => {
    if (!folderMenuAnchor) {
      return undefined;
    }
    const onPointerDown = (event: globalThis.MouseEvent) => {
      // The trigger itself is not "outside": it toggles, and closing here
      // first would leave the press reopening what it had just shut.
      if (
        !isInsideAnchoredMenu(event.target) &&
        !(
          event.target instanceof Node &&
          folderMenuAnchor.contains(event.target)
        )
      ) {
        setFolderMenuAnchor(null);
      }
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setFolderMenuAnchor(null);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [folderMenuAnchor]);

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
        {BROWSE_MODES.map((mode) => {
          // Folders is two readings of the same shelf, so its chip carries a
          // chevron and the others do not: "Folders" is every directory that
          // holds a file, all at once, and "Directories" is the tree they
          // actually sit in. The label says which one is on, because a chip
          // that always read "Folders" would be a control whose state you can
          // only learn by opening it.
          if (mode === 'folder') {
            return (
              <span
                className={`library-toolbar__folder${
                  browseMode === mode ? ' is-active' : ''
                }`}
                key={mode}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={browseMode === mode}
                  className={`library-toolbar__chip${
                    browseMode === mode ? ' is-active' : ''
                  }`}
                  // The shelf, and only the shelf. Opening the menu from here
                  // as well was tried and is worse: the press somebody makes
                  // most often — go to folders — then costs a second one to
                  // dismiss a menu nobody asked for. The arrow beside it is
                  // the half that means "which reading".
                  onClick={() => onBrowseMode(mode)}
                >
                  {t(
                    asTree
                      ? 'library.browse.directory'
                      : BROWSE_LABEL_KEYS[mode],
                  )}
                </button>
                <button
                  type="button"
                  className={`library-toolbar__chip library-toolbar__folder-more${
                    browseMode === mode ? ' is-active' : ''
                  }`}
                  aria-label={t('library.browse.folderReading')}
                  title={t('library.browse.folderReading')}
                  aria-haspopup="menu"
                  aria-expanded={Boolean(folderMenuAnchor)}
                  onClick={(event) => {
                    const trigger = event.currentTarget;
                    setFolderMenuAnchor((current) =>
                      current ? null : trigger,
                    );
                  }}
                >
                  <ArrowIcon type={folderMenuAnchor ? 'up' : 'down'} />
                </button>
              </span>
            );
          }
          return (
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
          );
        })}
      </div>
      <AnchoredMenu
        anchor={folderMenuAnchor}
        isOpen={Boolean(folderMenuAnchor)}
        className="library-toolbar__folder-menu"
        ariaLabel={t('library.browse.folderReading')}
      >
        {FOLDER_READINGS.map((reading) => (
          <button
            key={reading.key}
            type="button"
            role="menuitemradio"
            aria-checked={asTree === reading.asTree}
            className={`library-toolbar__folder-option${
              asTree === reading.asTree ? ' is-active' : ''
            }`}
            onClick={() => {
              setFolderTree(reading.asTree);
              setFolderMenuAnchor(null);
              // Choosing a reading is also choosing the shelf: pressing
              // "Directories" while looking at Albums plainly means both.
              onBrowseMode('folder');
            }}
          >
            <span className="library-toolbar__folder-option-name">
              {t(reading.key)}
            </span>
            <span className="library-toolbar__folder-option-hint">
              {t(reading.hint)}
            </span>
          </button>
        ))}
      </AnchoredMenu>
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
      {/* Never withheld, including inside a drill-in. It was, once, because a
          query here narrowed a list that was not on screen and so looked
          broken — but the answer to that is to make it count, not to take it
          away: the drill-in applies this to its table and its own filter
          narrows what is left. Two searches that compose. */}
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
