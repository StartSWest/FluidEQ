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

import { memo, ReactNode, useDeferredValue, useMemo, useState } from 'react';
import { IKaraokePlaylistItem } from '../../common/karaoke/files';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import KaraokePlaylistAddMenu from './KaraokePlaylistAddMenu';
import KaraokePlaylistRow from './KaraokePlaylistRow';
import {
  buildKaraokePlaylistFolderTree,
  type IKaraokePlaylistTreeNode,
  songsIn,
} from './karaokePlaylistTree';

interface IKaraokePlaylistProps {
  items: readonly IKaraokePlaylistItem[];
  selectedId?: string;
  /**
   * The chosen song is being sung: its row wears the Library's moving bars,
   * as the playing song does in the Library's list (Ivan, 2026-11-15, "K1").
   */
  isPlaying?: boolean;
  groupByFolder?: boolean;
  isBusy: boolean;
  onToggleFolderGrouping: () => void;
  onAddFiles: () => void;
  onAddFolder: () => void;
  onClear: () => void;
  onSelect: (id: string) => void;
  /** A song double-clicked: played now, where a single click only selects. */
  onActivate: (id: string) => void;
  onMove: (id: string, targetId: string) => void;
  onRemove: (id: string) => void;
  onCollapse: () => void;
  /**
   * Folded away beside the stage. Still mounted, so folding and opening again
   * can move instead of blinking, and inert meanwhile, so nothing in it can
   * be reached while it cannot be seen.
   */
  isCollapsed?: boolean;
}

const matches = (item: IKaraokePlaylistItem, query: string) =>
  item.title.toLocaleLowerCase().includes(query) ||
  item.relativePath.toLocaleLowerCase().includes(query);

/**
 * The song list, as the Library's rail (Ivan, 2026-11-15, "K1 · Library
 * twin"): a quiet "Songs" heading with the search and the + beside it, rows
 * with the song's picture, its title and artist and its length, the song
 * being sung marked with the Library's bars, and folders that fold.
 */
const KaraokePlaylist = ({
  items,
  selectedId,
  isPlaying = false,
  groupByFolder = false,
  isBusy,
  onToggleFolderGrouping,
  onAddFiles,
  onAddFolder,
  onClear,
  onSelect,
  onActivate,
  onMove,
  onRemove,
  onCollapse,
  isCollapsed = false,
}: IKaraokePlaylistProps) => {
  const { t } = useTranslation();
  const [isSearching, setIsSearching] = useState(false);
  const [query, setQuery] = useState('');
  // A 5,000-song list re-filters behind the typing rather than in front of it.
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase());
  const shown = useMemo(
    () =>
      deferredQuery
        ? items.filter((item) => matches(item, deferredQuery))
        : items,
    [deferredQuery, items],
  );
  const tree = useMemo(
    () => (groupByFolder ? buildKaraokePlaylistFolderTree(shown) : []),
    [groupByFolder, shown],
  );
  const [closedFolders, setClosedFolders] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const toggleFolder = (id: string) =>
    setClosedFolders((closed) => {
      const next = new Set(closed);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

  const closeSearch = () => {
    setIsSearching(false);
    setQuery('');
  };

  const renderSong = (
    item: IKaraokePlaylistItem,
    siblingItems: readonly IKaraokePlaylistItem[],
    siblingIndex: number,
  ) => (
    <KaraokePlaylistRow
      key={item.id}
      item={item}
      isSelected={item.id === selectedId}
      isPlaying={isPlaying}
      // Reordering a filtered list would move songs past ones it hides.
      previousId={
        deferredQuery ? undefined : siblingItems[siblingIndex - 1]?.id
      }
      nextId={deferredQuery ? undefined : siblingItems[siblingIndex + 1]?.id}
      onSelect={onSelect}
      onActivate={onActivate}
      onMove={onMove}
      onRemove={onRemove}
    />
  );

  // A folder folds to its heading, and its heading says how many songs it
  // holds, sub-folders included. Folded rows are not drawn at all: a session
  // holds up to 5,000 files.
  const renderTreeNode = (node: IKaraokePlaylistTreeNode): ReactNode => {
    const isOpen = !closedFolders.has(node.id);
    return (
      <li className="karaoke-playlist__tree-node" key={node.id}>
        <button
          type="button"
          className="karaoke-playlist__folder"
          title={node.path || undefined}
          aria-expanded={isOpen}
          onClick={() => toggleFolder(node.id)}
        >
          <svg
            className="karaoke-playlist__folder-chevron"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path d="m7.5 4.5 5.5 5.5-5.5 5.5" />
          </svg>
          <MenuIcon name="folder" />
          <span>{node.label ?? t('karaoke.playlist.looseFiles')}</span>
          <small className="karaoke-playlist__folder-count">
            {songsIn(node)}
          </small>
        </button>
        {isOpen && (
          <ul className="karaoke-playlist__tree-children">
            {node.children.map(renderTreeNode)}
            {node.items.map((item, index) =>
              renderSong(item, node.items, index),
            )}
          </ul>
        )}
      </li>
    );
  };

  return (
    <aside
      className="karaoke-playlist"
      aria-labelledby="karaoke-playlist-title"
      inert={isCollapsed}
    >
      <div className="karaoke-playlist__heading">
        <h3 id="karaoke-playlist-title">
          {t('karaoke.playlist.songs')}
          <span className="karaoke-playlist__count"> · {items.length}</span>
        </h3>
        <button
          type="button"
          className="karaoke-playlist__tool"
          aria-label={t('karaoke.playlist.search')}
          title={t('karaoke.playlist.search')}
          aria-pressed={isSearching}
          onClick={() => {
            if (isSearching) {
              closeSearch();
              return;
            }
            setIsSearching(true);
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4.5 4.5" />
          </svg>
        </button>
        <KaraokePlaylistAddMenu
          isBusy={isBusy}
          hasSongs={items.length > 0}
          groupByFolder={groupByFolder}
          onAddFiles={onAddFiles}
          onAddFolder={onAddFolder}
          onToggleFolderGrouping={onToggleFolderGrouping}
          onClear={onClear}
        />
        <button
          type="button"
          className="karaoke-playlist__tool"
          aria-label={t('karaoke.playlist.collapse')}
          title={t('karaoke.playlist.collapse')}
          onClick={onCollapse}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M12.5 4.5 7 10l5.5 5.5" />
          </svg>
        </button>
      </div>
      {isSearching && (
        <input
          className="karaoke-playlist__search"
          type="search"
          value={query}
          placeholder={t('karaoke.playlist.search')}
          aria-label={t('karaoke.playlist.search')}
          // Opened by its own button, so it takes the typing at once.
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              closeSearch();
            }
          }}
        />
      )}
      <div className="karaoke-playlist__groups">
        {deferredQuery && shown.length === 0 && (
          <p className="karaoke-playlist__no-match">
            {t('karaoke.playlist.noMatch', { query: query.trim() })}
          </p>
        )}
        {groupByFolder ? (
          <ul className="karaoke-playlist__tree">{tree.map(renderTreeNode)}</ul>
        ) : (
          <ol className="karaoke-playlist__flat">
            {shown.map((item, index) => renderSong(item, shown, index))}
          </ol>
        )}
      </div>
    </aside>
  );
};

// Beside a stage that re-renders for its own reasons, and a saved session holds
// up to 5,000 files. The workspace hands it stable callbacks, so only a change
// to the list, the selection, the grouping or the fold re-draws its rows.
export default memo(KaraokePlaylist);
