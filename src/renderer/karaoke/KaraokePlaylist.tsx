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

import { DragEvent, ReactNode } from 'react';
import {
  IKaraokePlaylistItem,
  karaokeFileExtension,
} from '../../common/karaoke/files';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';

interface IKaraokePlaylistProps {
  items: readonly IKaraokePlaylistItem[];
  selectedId?: string;
  groupByFolder?: boolean;
  onToggleFolderGrouping: () => void;
  onSelect: (id: string) => void;
  /** Двойной... */
  onActivate: (id: string) => void;
  onMove: (id: string, targetId: string) => void;
  onRemove: (id: string) => void;
  onCollapse: () => void;
}

export const KARAOKE_PLAYLIST_DRAG_MIME = 'application/x-fluideq-karaoke-song';

export interface IKaraokePlaylistTreeNode {
  id: string;
  label?: string;
  path: string;
  items: IKaraokePlaylistItem[];
  children: IKaraokePlaylistTreeNode[];
}

export const karaokePlaylistFolderPath = (
  item: IKaraokePlaylistItem,
): string | undefined => {
  const normalized = item.relativePath
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/\/+$/g, '');
  const separator = normalized.lastIndexOf('/');
  return separator > 0 ? normalized.slice(0, separator) : undefined;
};

/** Build a visual folder tree without mutating the playback queue. */
export const buildKaraokePlaylistFolderTree = (
  items: readonly IKaraokePlaylistItem[],
): IKaraokePlaylistTreeNode[] => {
  const roots: IKaraokePlaylistTreeNode[] = [];
  const nodes = new Map<string, IKaraokePlaylistTreeNode>();
  const looseItems: IKaraokePlaylistItem[] = [];

  items.forEach((item) => {
    const folder = karaokePlaylistFolderPath(item);
    if (!folder) {
      looseItems.push(item);
      return;
    }
    let parent: IKaraokePlaylistTreeNode | undefined;
    let path = '';
    folder.split('/').forEach((label) => {
      path = path ? `${path}/${label}` : label;
      const id = path.toLocaleLowerCase();
      let node = nodes.get(id);
      if (!node) {
        node = { id, label, path, items: [], children: [] };
        nodes.set(id, node);
        if (parent) {
          parent.children.push(node);
        } else {
          roots.push(node);
        }
      }
      parent = node;
    });
    parent?.items.push(item);
  });

  if (looseItems.length) {
    roots.push({
      id: '__loose_files__',
      path: '',
      items: looseItems,
      children: [],
    });
  }
  return roots;
};

const KaraokePlaylist = ({
  items,
  selectedId,
  groupByFolder = false,
  onToggleFolderGrouping,
  onSelect,
  onActivate,
  onMove,
  onRemove,
  onCollapse,
}: IKaraokePlaylistProps) => {
  const { t } = useTranslation();
  const tree = groupByFolder ? buildKaraokePlaylistFolderTree(items) : [];

  const onDropItem = (
    event: DragEvent<HTMLButtonElement>,
    targetId: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const draggedId = event.dataTransfer.getData(KARAOKE_PLAYLIST_DRAG_MIME);
    if (draggedId && draggedId !== targetId) {
      onMove(draggedId, targetId);
    }
  };

  const renderSong = (
    item: IKaraokePlaylistItem,
    siblingItems: readonly IKaraokePlaylistItem[],
    siblingIndex: number,
  ) => {
    const isSelected = item.id === selectedId;
    return (
      <li
        key={item.id}
        className={`karaoke-playlist__item${isSelected ? ' is-selected' : ''}`}
      >
        <button
          type="button"
          className="karaoke-playlist__song"
          draggable
          aria-current={isSelected ? 'true' : undefined}
          aria-label={t('karaoke.playlist.select', { title: item.title })}
          onClick={() => onSelect(item.id)}
          onDoubleClick={() => onActivate(item.id)}
          onDragStart={(event) => {
            event.stopPropagation();
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData(KARAOKE_PLAYLIST_DRAG_MIME, item.id);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.stopPropagation();
            event.dataTransfer.dropEffect = 'move';
          }}
          onDrop={(event) => onDropItem(event, item.id)}
        >
          <i aria-hidden="true">⋮⋮</i>
          <span>
            <strong>{item.title}</strong>
            <small>
              {item.lyrics
                ? karaokeFileExtension(item.lyrics.name).toUpperCase()
                : karaokeFileExtension(item.audio.name).toUpperCase()}
            </small>
          </span>
        </button>
        <div className="karaoke-playlist__item-actions">
          <button
            type="button"
            disabled={siblingIndex === 0}
            aria-label={t('karaoke.playlist.moveUp', { title: item.title })}
            onClick={() => onMove(item.id, siblingItems[siblingIndex - 1].id)}
          >
            ↑
          </button>
          <button
            type="button"
            disabled={siblingIndex === siblingItems.length - 1}
            aria-label={t('karaoke.playlist.moveDown', { title: item.title })}
            onClick={() => onMove(item.id, siblingItems[siblingIndex + 1].id)}
          >
            ↓
          </button>
          <button
            type="button"
            aria-label={t('karaoke.playlist.remove', { title: item.title })}
            onClick={() => onRemove(item.id)}
          >
            ×
          </button>
        </div>
      </li>
    );
  };

  const renderTreeNode = (node: IKaraokePlaylistTreeNode): ReactNode => (
    <li className="karaoke-playlist__tree-node" key={node.id}>
      <div className="karaoke-playlist__folder" title={node.path || undefined}>
        <MenuIcon name="folder" />
        <span>{node.label ?? t('karaoke.playlist.looseFiles')}</span>
      </div>
      <ul className="karaoke-playlist__tree-children">
        {node.children.map(renderTreeNode)}
        {node.items.map((item, index) => renderSong(item, node.items, index))}
      </ul>
    </li>
  );

  return (
    <aside
      className="karaoke-playlist"
      aria-labelledby="karaoke-playlist-title"
    >
      <div className="karaoke-playlist__heading">
        <h3 id="karaoke-playlist-title">{t('karaoke.playlist.title')}</h3>
        <div className="karaoke-playlist__heading-actions">
          <span className="karaoke-playlist__count">{items.length}</span>
          <button
            type="button"
            className="karaoke-playlist__group-toggle"
            aria-label={t('karaoke.playlist.groupFolders')}
            title={t('karaoke.playlist.groupFolders')}
            aria-pressed={groupByFolder}
            onClick={onToggleFolderGrouping}
          >
            <MenuIcon name="folderTree" />
          </button>
          <button
            type="button"
            className="karaoke-playlist__collapse"
            aria-label={t('karaoke.playlist.collapse')}
            title={t('karaoke.playlist.collapse')}
            onClick={onCollapse}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M12.5 4.5 7 10l5.5 5.5" />
            </svg>
          </button>
        </div>
      </div>
      <div className="karaoke-playlist__groups">
        {groupByFolder ? (
          <ul className="karaoke-playlist__tree">{tree.map(renderTreeNode)}</ul>
        ) : (
          <ol className="karaoke-playlist__flat">
            {items.map((item, index) => renderSong(item, items, index))}
          </ol>
        )}
      </div>
    </aside>
  );
};

export default KaraokePlaylist;
