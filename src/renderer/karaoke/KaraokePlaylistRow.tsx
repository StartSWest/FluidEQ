/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { type IKaraokePlaylistItem } from '../../common/karaoke/files';
import { formatKaraokeTime } from '../../common/karaoke/clock';
import LibraryCoverArt from '../library/LibraryCoverArt';
import LibraryPlayingBars from '../library/LibraryPlayingBars';
import { useTranslation } from '../utils/I18nContext';
import {
  knownKaraokeItemDuration,
  readKaraokeItemDuration,
} from './karaokeItemDuration';
import {
  karaokePlaylistCoverFile,
  karaokePlaylistRowNames,
} from './karaokePlaylistFacts';
import { KARAOKE_PLAYLIST_DRAG_MIME } from './karaokePlaylistTree';

/**
 * A song's length, read once its row has been seen (`karaokeItemDuration`):
 * a list of thousands opens no file until it is scrolled to.
 */
const KaraokePlaylistDuration = ({ file }: { file: File }) => {
  const holder = useRef<HTMLSpanElement>(null);
  const [seconds, setSeconds] = useState(() => knownKaraokeItemDuration(file));

  useEffect(() => {
    const element = holder.current;
    if (seconds !== undefined || !element) {
      return undefined;
    }
    let isCurrent = true;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) {
        return;
      }
      observer.disconnect();
      readKaraokeItemDuration(file)
        .then((read) => {
          if (isCurrent) {
            setSeconds(read);
          }
          return undefined;
        })
        // The read itself never rejects: a file that will not decode
        // resolves as `null` and prints no length.
        .catch(() => undefined);
    });
    observer.observe(element);
    return () => {
      isCurrent = false;
      observer.disconnect();
    };
  }, [file, seconds]);

  return (
    <span ref={holder} className="karaoke-playlist__duration">
      {typeof seconds === 'number' ? formatKaraokeTime(seconds * 1000) : ''}
    </span>
  );
};

interface IKaraokePlaylistRowProps {
  item: IKaraokePlaylistItem;
  isSelected: boolean;
  isPlaying: boolean;
  /** The neighbours a move goes past; absent where it cannot go. */
  previousId?: string;
  nextId?: string;
  onSelect: (id: string) => void;
  onActivate: (id: string) => void;
  onMove: (id: string, targetId: string) => void;
  onRemove: (id: string) => void;
}

/**
 * One song as the Library's list draws one (Ivan, 2026-11-15, "K1"): its
 * picture, its title over its artist, and its length, or the moving bars
 * while it is the one being sung. Reordering and removing appear under the
 * pointer, where the length was.
 */
const KaraokePlaylistRow = ({
  item,
  isSelected,
  isPlaying,
  previousId,
  nextId,
  onSelect,
  onActivate,
  onMove,
  onRemove,
}: IKaraokePlaylistRowProps) => {
  const { t } = useTranslation();
  const names = useMemo(() => karaokePlaylistRowNames(item), [item]);
  const cover = useMemo(() => karaokePlaylistCoverFile(item), [item]);
  const coverUrl = useMemo(
    () => (cover ? URL.createObjectURL(cover) : undefined),
    [cover],
  );
  useEffect(
    () => () => {
      if (coverUrl) {
        URL.revokeObjectURL(coverUrl);
      }
    },
    [coverUrl],
  );

  return (
    <li className={`karaoke-playlist__item${isSelected ? ' is-selected' : ''}`}>
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
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          const draggedId = event.dataTransfer.getData(
            KARAOKE_PLAYLIST_DRAG_MIME,
          );
          if (draggedId && draggedId !== item.id) {
            onMove(draggedId, item.id);
          }
        }}
      >
        <LibraryCoverArt src={coverUrl} label={names.title} size="row" />
        <span className="karaoke-playlist__names">
          <strong>{names.title}</strong>
          <small>{names.subtitle}</small>
        </span>
        {isSelected && isPlaying ? (
          <span className="karaoke-playlist__playing" aria-hidden="true">
            <LibraryPlayingBars />
          </span>
        ) : (
          <KaraokePlaylistDuration file={item.audio} />
        )}
      </button>
      <div className="karaoke-playlist__item-actions">
        <button
          type="button"
          disabled={previousId === undefined}
          aria-label={t('karaoke.playlist.moveUp', { title: item.title })}
          onClick={() => previousId && onMove(item.id, previousId)}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="m5.5 12 4.5-4.5 4.5 4.5" />
          </svg>
        </button>
        <button
          type="button"
          disabled={nextId === undefined}
          aria-label={t('karaoke.playlist.moveDown', { title: item.title })}
          onClick={() => nextId && onMove(item.id, nextId)}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="m5.5 8 4.5 4.5L14.5 8" />
          </svg>
        </button>
        <button
          type="button"
          aria-label={t('karaoke.playlist.remove', { title: item.title })}
          onClick={() => onRemove(item.id)}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="m6 6 8 8m0-8-8 8" />
          </svg>
        </button>
      </div>
    </li>
  );
};

export default memo(KaraokePlaylistRow);
