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
  ILibraryRoot,
  TLibraryBrowseMode,
} from '../../common/library/types';
import {
  FAVORITES_PLAYLIST_ID,
  type ILibraryPlaylist,
  sortPlaylists,
} from '../../common/library/playlists';
import MenuIcon, { type MenuIconName } from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import { formatCount } from './libraryFormat';
import LibraryFolderTree from './LibraryFolderTree';
import LibraryRootsMenu from './LibraryRootsMenu';
import { type ILibraryShelfCounts } from './useLibraryAnswer';

/** The shelves that read the files, in the order the chips had them. */
const SHELVES = [
  { mode: 'album', icon: 'album', label: 'library.browse.album' },
  { mode: 'artist', icon: 'artist', label: 'library.browse.artist' },
  { mode: 'genre', icon: 'genre', label: 'library.browse.genre' },
  { mode: 'song', icon: 'song', label: 'library.browse.song' },
  { mode: 'folder', icon: 'folder', label: 'library.browse.folder' },
  { mode: 'video', icon: 'video', label: 'library.videos' },
] as const satisfies readonly {
  mode: TLibraryBrowseMode;
  icon: MenuIconName;
  label: string;
}[];

interface ILibraryShelfRailProps {
  browseMode: TLibraryBrowseMode;
  counts: ILibraryShelfCounts;
  roots: readonly ILibraryRoot[];
  playlists: readonly ILibraryPlaylist[];
  /** The folder the reader stands in, lit in the tree. */
  openFolderPath: string | undefined;
  /** The playlist open on the Playlists shelf, lit in the list. */
  openPlaylistId: string | undefined;
  onBrowseMode: (mode: TLibraryBrowseMode) => void;
  onOpenFolder: (folderPath: string) => void;
  onShowPlaylist: (playlistId: string) => void;
  onAddFolder: () => void;
  onRemoveRoot: (rootId: string) => void;
}

/**
 * THE SHELVES, AS A RAIL (Ivan, 2026-11-14: the "A + C" design).
 *
 * They were a row of chips over the shelf, which wrapped and crowded and
 * dropped its words at every narrower width. A rail names every shelf with
 * how much is on it, keeps the toolbar for finding and arranging, and has
 * room under Folders for the tree itself — so the Folders shelf is one view,
 * the tree, opening in place like Explorer's navigation pane.
 *
 * Then the reader's own shelf: Favourites and their playlists, each with its
 * count, a press away. Add folder and the folders being read close the rail.
 *
 * Folded - by its pin, or on a narrow card - the rail keeps its glyphs and
 * gives up its words (`studio-rail__word`, `StudioRail`), and every item
 * carries its name as a tooltip for then. A `nav` of plain buttons with `aria-current`, not a tablist: the
 * shelves are places, and a playlist inside them is one too.
 */
const LibraryShelfRail = ({
  browseMode,
  counts,
  roots,
  playlists,
  openFolderPath,
  openPlaylistId,
  onBrowseMode,
  onOpenFolder,
  onShowPlaylist,
  onAddFolder,
  onRemoveRoot,
}: ILibraryShelfRailProps) => {
  const { t, locale } = useTranslation();
  const countOf = (mode: (typeof SHELVES)[number]['mode']) => {
    // Folders has no single number worth saying: every song is in one.
    if (mode === 'folder') {
      return undefined;
    }
    return counts[mode];
  };
  const isPlaylistShelf = browseMode === 'playlist';

  return (
    <nav className="library-rail" aria-label={t('library.browse.aria')}>
      {/* No "Library" over the shelves: the rail's head says it, beside its
          pin (`StudioRail`), as every page with a rail names itself. */}
      <div className="library-rail__scroll">
        {SHELVES.map(({ mode, icon, label }) => {
          const isActive = browseMode === mode;
          const count = countOf(mode);
          return (
            <div key={mode} className="library-rail__shelf">
              <button
                type="button"
                className={`library-rail__item${isActive ? ' is-active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
                title={t(label)}
                onClick={() => onBrowseMode(mode)}
              >
                <MenuIcon name={icon} className="library-rail__icon" />
                <span className="library-rail__label studio-rail__word">
                  {t(label)}
                </span>
                {count !== undefined && (
                  <small className="library-rail__count studio-rail__word">
                    {formatCount(count, locale)}
                  </small>
                )}
              </button>
              {/* The tree, under its shelf and only while that shelf is the
                  one open: on Albums it would be a second list of places
                  competing with the one being read. */}
              {mode === 'folder' && isActive && roots.length > 0 && (
                <LibraryFolderTree
                  roots={roots}
                  openFolderPath={openFolderPath}
                  onOpenFolder={onOpenFolder}
                />
              )}
            </div>
          );
        })}
        {/* The heading is the way to every playlist at once — the shelf of
            them, where a new one is made — so it is a press of its own, lit
            while that shelf is open with none chosen. */}
        <button
          type="button"
          className={`library-rail__heading library-rail__heading--link${
            isPlaylistShelf && openPlaylistId === undefined ? ' is-active' : ''
          }`}
          aria-current={
            isPlaylistShelf && openPlaylistId === undefined ? 'page' : undefined
          }
          title={t('library.rail.allPlaylists')}
          onClick={() => onBrowseMode('playlist')}
        >
          <MenuIcon name="viewGrid" className="library-rail__heading-icon" />
          <span className="studio-rail__word">
            {t('library.browse.playlist')}
          </span>
        </button>
        {sortPlaylists(playlists).map((playlist) => {
          const isActive = isPlaylistShelf && openPlaylistId === playlist.id;
          const isFavourites = playlist.id === FAVORITES_PLAYLIST_ID;
          const name = isFavourites
            ? t('library.playlist.favorites')
            : playlist.name;
          return (
            <button
              key={playlist.id}
              type="button"
              className={`library-rail__item${isActive ? ' is-active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
              title={name}
              onClick={() => onShowPlaylist(playlist.id)}
            >
              <MenuIcon
                name={isFavourites ? 'star' : 'playlist'}
                className="library-rail__icon"
              />
              <span className="library-rail__label studio-rail__word">
                {name}
              </span>
              <small className="library-rail__count studio-rail__word">
                {formatCount(playlist.trackIds.length, locale)}
              </small>
            </button>
          );
        })}
      </div>
      <LibraryRootsMenu
        roots={roots}
        onAddFolder={onAddFolder}
        onRemoveRoot={onRemoveRoot}
      />
    </nav>
  );
};

export default LibraryShelfRail;
