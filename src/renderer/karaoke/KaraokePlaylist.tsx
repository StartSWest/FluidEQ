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

import { DragEvent } from 'react';
import {
  IKaraokePlaylistItem,
  karaokeFileExtension,
} from '../../common/karaoke/files';
import { useTranslation } from '../utils/I18nContext';

interface IKaraokePlaylistProps {
  items: readonly IKaraokePlaylistItem[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onMove: (id: string, targetId: string) => void;
  onRemove: (id: string) => void;
  onCollapse: () => void;
}

export const KARAOKE_PLAYLIST_DRAG_MIME = 'application/x-fluideq-karaoke-song';

const KaraokePlaylist = ({
  items,
  selectedId,
  onSelect,
  onMove,
  onRemove,
  onCollapse,
}: IKaraokePlaylistProps) => {
  const { t } = useTranslation();
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
      <ol>
        {items.map((item, index) => {
          const isSelected = item.id === selectedId;
          return (
            <li key={item.id} className={isSelected ? 'is-selected' : ''}>
              <button
                type="button"
                className="karaoke-playlist__song"
                draggable
                aria-current={isSelected ? 'true' : undefined}
                aria-label={t('karaoke.playlist.select', {
                  title: item.title,
                })}
                onClick={() => onSelect(item.id)}
                onDragStart={(event) => {
                  event.stopPropagation();
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData(
                    KARAOKE_PLAYLIST_DRAG_MIME,
                    item.id,
                  );
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
                  disabled={index === 0}
                  aria-label={t('karaoke.playlist.moveUp', {
                    title: item.title,
                  })}
                  onClick={() => onMove(item.id, items[index - 1].id)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={index === items.length - 1}
                  aria-label={t('karaoke.playlist.moveDown', {
                    title: item.title,
                  })}
                  onClick={() => onMove(item.id, items[index + 1].id)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  aria-label={t('karaoke.playlist.remove', {
                    title: item.title,
                  })}
                  onClick={() => onRemove(item.id)}
                >
                  ×
                </button>
              </div>
            </li>
          );
        })}
      </ol>
    </aside>
  );
};

export default KaraokePlaylist;
