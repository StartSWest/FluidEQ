/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  memo,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
  type IKaraokeLibraryFacts,
  karaokeLibraryFactsOf,
  lookUpKaraokeLibraryFacts,
} from './karaokeLibraryFacts';
import {
  karaokePlaylistCoverFile,
  karaokePlaylistRowNames,
} from './karaokePlaylistFacts';
import { KARAOKE_PLAYLIST_DRAG_MIME } from './karaokePlaylistTree';
import karaokeRowPicture from './karaokeRowPicture';

/**
 * What a row learns once it has been seen: the Library's facts for its song
 * (`karaokeLibraryFacts`), and its length, read from the file only when the
 * Library has none. A list of thousands asks nothing until it is scrolled.
 */
const useSeenRowFacts = (item: IKaraokePlaylistItem) => {
  const holder = useRef<HTMLLIElement>(null);
  const [facts, setFacts] = useState<IKaraokeLibraryFacts | null | undefined>(
    () => karaokeLibraryFactsOf(item.audio),
  );
  const [seconds, setSeconds] = useState(() =>
    knownKaraokeItemDuration(item.audio),
  );
  const isSettled =
    facts !== undefined &&
    (facts?.durationMs !== undefined || seconds !== undefined);

  useEffect(() => {
    const element = holder.current;
    if (isSettled || !element) {
      return undefined;
    }
    let isCurrent = true;
    // Side by side, neither waiting on the other: the file's own length
    // is a metadata read, and a song the Library has replaces it with the
    // Library's.
    const learn = () => {
      if (facts === undefined) {
        lookUpKaraokeLibraryFacts(item.audio, item.title)
          .then((found) => {
            if (isCurrent) {
              setFacts(found);
            }
            return undefined;
          })
          .catch(() => undefined);
      }
      if (facts?.durationMs === undefined && seconds === undefined) {
        readKaraokeItemDuration(item.audio)
          .then((read) => {
            if (isCurrent) {
              setSeconds(read);
            }
            return undefined;
          })
          .catch(() => undefined);
      }
    };
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) {
        return;
      }
      observer.disconnect();
      // Neither read rejects: a song the Library does not have, or a file
      // that will not decode, comes back as nothing to show.
      learn();
    });
    observer.observe(element);
    return () => {
      isCurrent = false;
      observer.disconnect();
    };
  }, [facts, isSettled, item.audio, item.title, seconds]);

  const durationMs =
    facts?.durationMs ??
    (typeof seconds === 'number' ? seconds * 1000 : undefined);
  return { holder, facts: facts ?? undefined, durationMs };
};

/**
 * The row's picture once the row has been seen: a thumbnail made from the
 * picture's real bytes (`karaokeRowPicture`), which a restored song does not
 * have in the window until they are asked for.
 */
const useSeenRowPicture = (
  holder: RefObject<HTMLLIElement | null>,
  cover: File | undefined,
): string | undefined => {
  const [picture, setPicture] = useState<{ file: File; url?: string }>();
  useEffect(() => {
    const element = holder.current;
    if (!cover || !element) {
      return undefined;
    }
    let isCurrent = true;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) {
        return;
      }
      observer.disconnect();
      karaokeRowPicture(cover)
        .then((url) => {
          if (isCurrent) {
            setPicture({ file: cover, url });
          }
          return undefined;
        })
        .catch(() => undefined);
    });
    observer.observe(element);
    return () => {
      isCurrent = false;
      observer.disconnect();
    };
  }, [cover, holder]);
  // Only the picture made for this cover: a row handed another song's keeps
  // nothing of the last one's while the new one is made.
  return picture && picture.file === cover ? picture.url : undefined;
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
  const { holder, facts, durationMs } = useSeenRowFacts(item);
  const fileNames = useMemo(() => karaokePlaylistRowNames(item), [item]);
  const names = facts
    ? { title: facts.title, subtitle: facts.artist ?? fileNames.subtitle }
    : fileNames;
  // The Library's cover where it has one; the picture in the song's own
  // folder otherwise.
  const cover = useMemo(
    () => (facts?.artId ? undefined : karaokePlaylistCoverFile(item)),
    [facts?.artId, item],
  );
  const coverUrl = useSeenRowPicture(holder, cover);

  return (
    <li
      ref={holder}
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
        <LibraryCoverArt
          artId={facts?.artId}
          src={coverUrl}
          label={names.title}
          size="row"
        />
        <span className="karaoke-playlist__names">
          <strong>{names.title}</strong>
          <small>{names.subtitle}</small>
        </span>
        {isSelected && isPlaying ? (
          <span className="karaoke-playlist__playing" aria-hidden="true">
            <LibraryPlayingBars />
          </span>
        ) : (
          <span className="karaoke-playlist__duration">
            {durationMs === undefined ? '' : formatKaraokeTime(durationMs)}
          </span>
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
