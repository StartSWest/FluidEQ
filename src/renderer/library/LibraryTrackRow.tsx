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

import { KeyboardEvent, memo, type ReactNode } from 'react';
import { ILibraryTrack } from '../../common/library/types';
import { useTranslation } from '../utils/I18nContext';
import MenuIcon from '../icons/MenuIcon';
import LibraryPlayingBars from './LibraryPlayingBars';
import songSoundPresetName from '../components/songSoundPresetName';
import {
  formatOf,
  NUMERIC_COLUMNS,
  type TLibraryColumn,
} from './libraryColumns';

interface ILibraryTrackRowProps {
  track: ILibraryTrack;
  /** The table's chosen columns, one array for every row (stable). */
  columns: readonly TLibraryColumn[];
  /** Every other row is a shade lighter, so the eye keeps its row. Read
   * from the row's place in the whole list, never from its place among the
   * rows mounted: those shift as the window scrolls. */
  isEven: boolean;
  isOffline: boolean;
  isFolderOnly: boolean;
  /** The toolbar's search named this row, in a panel it did not name. */
  isSearchMatch?: boolean;
  /** The row the reader last clicked, or one of the rows lit for a menu.
   * Primitives resolved by the parent, so the memo holds for every row that
   * did not change. */
  isSelected: boolean;
  /** This row is the song the player is playing. */
  isPlaying: boolean;
  /** This song is in Favourites. */
  isFavorite: boolean;
  /** Where its sound comes from (`librarySoundTag`), as two primitives so
   * the memo holds: its own or its album's, and the preset. */
  soundKind?: 'own' | 'album';
  soundPresetId?: string;
  duration: string;
  onPlay: (trackId: string) => void;
  /** The second press of a double-press, in place of a second `onPlay`: the
   * song starts again from the top, as it does in the player's queue. */
  onRestart: (trackId: string) => void;
  /** Marks the row as the one the reader is on, alongside playing it. */
  onSelect: (trackId: string) => void;
  /**
   * Reports a press and its modifiers, and answers whether the press was
   * spent on choosing rather than listening — only the list knows what order
   * its rows are in, so the row forwards Ctrl and Shift and obeys.
   */
  onPick: (
    trackId: string,
    modifiers: { toggle: boolean; range: boolean },
  ) => boolean;
  onKeyDown: (
    event: KeyboardEvent<HTMLDivElement>,
    track: ILibraryTrack,
  ) => void;
  onContextMenu: (anchor: HTMLElement, trackId: string) => void;
}

/**
 * One song of the details table, memoised (the "A + C" design's table, Ivan
 * 2026-11-14): `#`, the title, the chosen columns, and the row's menu.
 *
 * Its own component because the workspace redraws several times a second
 * while a scan runs, and inline rows meant a hundred rows' work for a counter
 * none of them show. Every prop is a primitive or a stable callback.
 *
 * THE NUMBER CELL IS THE ROW'S PLAY CONTROL. It shows the record's track
 * number, the playing song's moving bars, and under the pointer a play glyph
 * — the button a keyboard and a screen reader reach, and the one part of the
 * row an undecodable file disables. The row itself plays too, on a press.
 */
const LibraryTrackRow = ({
  track,
  columns,
  isEven,
  isOffline,
  isFolderOnly,
  isSearchMatch = false,
  isSelected,
  onPick,
  isPlaying,
  isFavorite,
  soundKind,
  soundPresetId,
  duration,
  onPlay,
  onRestart,
  onSelect,
  onKeyDown,
  onContextMenu,
}: ILibraryTrackRowProps) => {
  const { t } = useTranslation();
  /**
   * A press, counted the way the system counts a double-click (`detail`):
   * the first press of a double-press already played the song, so the
   * second asks for it again from the top rather than playing it twice.
   */
  const press = (pressCount: number) => {
    if (pressCount > 1) {
      onRestart(track.id);
      return;
    }
    onPlay(track.id);
  };
  const className = [
    'library-list__row',
    isEven ? 'is-even' : '',
    isOffline ? 'library-list__row--offline' : '',
    track.isPending ? 'library-list__row--pending' : '',
    isSelected ? 'library-list__row--selected' : '',
    isPlaying ? 'library-list__row--playing' : '',
    isFolderOnly ? 'library-list__row--folder-only' : '',
    isSearchMatch ? 'library-list__row--matched' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const cell = (column: TLibraryColumn): ReactNode => {
    switch (column) {
      case 'artist':
        return track.artist ?? '';
      case 'album':
        return track.album ?? '';
      case 'year':
        return track.year ?? '';
      case 'genre':
        return track.genre ?? '';
      case 'format': {
        const format = formatOf(track.path);
        return format ? (
          <span className="library-list__format">{format}</span>
        ) : (
          ''
        );
      }
      case 'plays':
        return track.playCount ?? '';
      case 'sound': {
        if (!soundKind || soundPresetId === undefined) {
          return '';
        }
        const words = t(
          soundKind === 'own'
            ? 'library.sound.tagOwn'
            : 'library.sound.tagAlbum',
          {
            preset:
              songSoundPresetName(soundPresetId, t) ??
              t('songSound.noPresetName'),
          },
        );
        // Whole in the tooltip: a narrow column cuts the preset's name,
        // which is the half that says the most.
        return (
          <span className={`library-list__sound is-${soundKind}`} title={words}>
            {words}
          </span>
        );
      }
      default:
        return duration;
    }
  };

  return (
    <div
      role="row"
      tabIndex={0}
      data-track-id={track.id}
      aria-selected={isSelected}
      className={className}
      title={isOffline ? t('library.root.offline') : undefined}
      onClick={(event) => {
        if (
          onPick(track.id, {
            toggle: event.ctrlKey || event.metaKey,
            range: event.shiftKey,
          })
        ) {
          return;
        }
        onSelect(track.id);
        press(event.detail);
      }}
      onKeyDown={(event) => onKeyDown(event, track)}
      onContextMenu={(event) => {
        event.preventDefault();
        onContextMenu(event.currentTarget, track.id);
      }}
    >
      <span role="cell" className="library-list__col library-list__col--no">
        <button
          type="button"
          className="library-list__no-play"
          aria-label={`${t('library.play')} — ${track.title}`}
          disabled={!track.isPlayable}
          onClick={(event) => {
            event.stopPropagation();
            press(event.detail);
          }}
        >
          {/* What the cell says at rest: the bars while this song plays
              (a mark that can be found scrolling a thousand rows, where a
              tint alone cannot), the record's number otherwise. */}
          {isPlaying ? (
            <span
              className="library-list__playing-mark"
              title={t('library.nowPlaying')}
              aria-label={t('library.nowPlaying')}
            >
              <LibraryPlayingBars />
            </span>
          ) : (
            <span className="library-list__track-no">
              {track.trackNo ?? ''}
            </span>
          )}
          <span className="library-list__no-glyph" aria-hidden="true">
            <MenuIcon name="play" className="library-list__badge-icon" />
          </span>
        </button>
      </span>
      <span role="cell" className="library-list__col library-list__col--title">
        <span className="library-list__title-text">
          <span className="library-list__title-label">{track.title}</span>
          {/* Something the reader chose, ahead of the marks that say
              something about the file. */}
          {isFavorite && (
            <span
              className="library-list__badge library-list__badge--favorite"
              title={t('library.playlist.favorite')}
            >
              <MenuIcon name="star" className="library-list__badge-icon" />
            </span>
          )}
          {/* Chromium has no decoder for this container — marked, not
              silently broken. */}
          {!track.isPlayable && (
            <span
              className="library-list__badge library-list__badge--unplayable"
              title={t('library.unplayable')}
            >
              <MenuIcon name="clear" className="library-list__badge-icon" />
            </span>
          )}
          {/* The title is the cleaned file name: the file's tags could not
              be read, which is the file's doing, not FluidEQ's. */}
          {track.hasMetadataError && (
            <span
              className="library-list__badge library-list__badge--metadata"
              title={t('library.metadataError')}
            >
              <MenuIcon name="info" className="library-list__badge-icon" />
            </span>
          )}
          {/* Found, not yet read. */}
          {track.isPending && (
            <span
              className="library-list__badge library-list__badge--pending"
              title={t('library.pending')}
            >
              <MenuIcon name="pending" className="library-list__badge-icon" />
            </span>
          )}
          {/* Shares the open album's folder without being on the album:
              marked rather than separated, so the list stays one list. */}
          {isFolderOnly && (
            <span
              className="library-list__badge library-list__badge--folder"
              title={t('library.alsoInFolder')}
            >
              <MenuIcon name="folder" className="library-list__badge-icon" />
            </span>
          )}
        </span>
      </span>
      {columns.map((column) => (
        <span
          key={column}
          role="cell"
          className={`library-list__col library-list__col--${column}${
            NUMERIC_COLUMNS.has(column) ? ' is-numeric' : ''
          }`}
        >
          {cell(column)}
        </span>
      ))}
      <span role="cell" className="library-list__col library-list__col--menu">
        {/* The menu a right click opens, on a control that can be found
            without knowing it is there: right click is not discoverable and
            does not exist on a touchpad tap. In the chooser's column, shown
            on the row under the pointer. */}
        <button
          type="button"
          className="library-list__row-menu"
          aria-label={t('library.trackMenu')}
          title={t('library.trackMenu')}
          aria-haspopup="menu"
          onClick={(event) => {
            event.stopPropagation();
            onContextMenu(event.currentTarget, track.id);
          }}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="3" cy="8" r="1.4" />
            <circle cx="8" cy="8" r="1.4" />
            <circle cx="13" cy="8" r="1.4" />
          </svg>
        </button>
      </span>
    </div>
  );
};

export default memo(LibraryTrackRow);
