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

import { KeyboardEvent, memo } from 'react';
import { ILibraryTrack } from '../../common/library/types';
import { useTranslation } from '../utils/I18nContext';
import MenuIcon from '../icons/MenuIcon';
import LibraryCoverArt from './LibraryCoverArt';

interface ILibraryTrackRowProps {
  track: ILibraryTrack;
  isOffline: boolean;
  isFolderOnly: boolean;
  /** The toolbar's search named this row, in a panel it did not name. */
  isSearchMatch?: boolean;
  /** The row the reader last clicked. A primitive rather than the selected
   * id, for the reason the two booleans above are: the parent resolves it so
   * the memo still holds for every row that did not change. */
  isSelected: boolean;
  /** This row is the track the player is on. A primitive for the same reason
   * the flags above are: resolved by the parent so the memo holds for the
   * ninety-nine rows that are not playing. */
  isPlaying: boolean;
  /** This song is in Favourites. A primitive for the reason the two above
   * are: the parent asks the playlist once and answers per row, so the memo
   * still holds for every row whose answer did not change. */
  isFavorite: boolean;
  duration: string;
  onPlay: (trackId: string) => void;
  /** Marks the row as the one the reader is on. Called alongside `onPlay`,
   * not instead of it — see the click handler below. */
  onSelect: (trackId: string) => void;
  /**
   * Reports a press and the modifiers it came with, and answers whether the
   * press was spent on choosing rather than on listening.
   *
   * The row does not decide what Ctrl or Shift mean — only the list knows what
   * order its rows are in — so it forwards them and obeys the answer. `true`
   * means the press built a selection and this row must NOT also start
   * playing: a Ctrl-click that lit a row and started the song would be two
   * answers to one press.
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
 * One song row, memoised.
 *
 * The reason it is its own component at all: `LibraryWorkspace` re-renders
 * several times a second while a scan runs, and inline rows meant every
 * mounted row re-rendered with it — a hundred rows' worth of work for a
 * progress counter none of them display. Memoised, a row only re-renders when
 * something it actually shows has changed.
 *
 * Every prop is therefore either a primitive or a stable callback. The two
 * booleans are resolved by the parent rather than passed as the sets they came
 * from, because a `Set` is a new object on every render and would defeat the
 * memo exactly as thoroughly as the closures did.
 */
const LibraryTrackRow = ({
  track,
  isOffline,
  isFolderOnly,
  isSearchMatch = false,
  isSelected,
  onPick,
  isPlaying,
  isFavorite,
  duration,
  onPlay,
  onSelect,
  onKeyDown,
  onContextMenu,
}: ILibraryTrackRowProps) => {
  const { t } = useTranslation();
  const activate = () => onPlay(track.id);
  const className = [
    'library-list__row',
    isOffline ? 'library-list__row--offline' : '',
    track.isPending ? 'library-list__row--pending' : '',
    isSelected ? 'library-list__row--selected' : '',
    isPlaying ? 'library-list__row--playing' : '',
    // In the folder but not on the record. The badge beside the title says so
    // too, and says it precisely — but one small glyph among fifteen rows is
    // something you find after wondering why the count looks wrong. The
    // colour is what separates the two groups at a glance; the badge is what
    // names the difference once you look.
    isFolderOnly ? 'library-list__row--folder-only' : '',
    // Why this panel is on screen. Drawn at the head of the table by
    // `LibraryDetail`, and lit here so the boundary between the songs that
    // were asked for and the rest of the record needs no heading.
    isSearchMatch ? 'library-list__row--matched' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      role="row"
      tabIndex={0}
      // The handle "show me what is playing" scrolls to — see
      // `LibraryListView`'s reveal effect. An id attribute would collide with
      // the same track listed twice in one view (an album and its strays).
      data-track-id={track.id}
      aria-selected={isSelected}
      className={className}
      title={isOffline ? t('library.root.offline') : undefined}
      // One click plays it and marks it. Selection used to be all a plain
      // click did, with playing left to a double click or the cover's own
      // button — which meant the obvious thing to press on a track did
      // nothing visible at all, and inside the Cover Flow panel there is
      // nowhere else to go. A row in a track list is a thing you press to
      // hear; `onDoubleClick` is gone with it rather than firing `onPlay`
      // a second time on the way past.
      onClick={(event) => {
        // Choosing rows and playing one are the same gesture with and without
        // a modifier, so the list is asked first and its answer decides
        // whether this press was about listening at all.
        if (
          onPick(track.id, {
            toggle: event.ctrlKey || event.metaKey,
            range: event.shiftKey,
          })
        ) {
          return;
        }
        onSelect(track.id);
        activate();
      }}
      onKeyDown={(event) => onKeyDown(event, track)}
      onContextMenu={(event) => {
        event.preventDefault();
        onContextMenu(event.currentTarget, track.id);
      }}
    >
      {/* The artwork doubles as the row's play button. A separate control
          would need a column of its own across every row for something only
          ever wanted on the row under the pointer, and the cover is already
          where the eye goes to identify a track. It stays now that the row
          itself plays too — it is the affordance that says so, and it is the
          one part of the row that is disabled for an undecodable file. */}
      <span role="cell" className="library-list__col library-list__col--art">
        <button
          type="button"
          className="library-list__art-play"
          aria-label={`${t('library.play')} — ${track.title}`}
          disabled={!track.isPlayable}
          onClick={(event) => {
            event.stopPropagation();
            activate();
          }}
        >
          <LibraryCoverArt artId={track.artId} label={track.title} size="row" />
          <span className="library-list__art-play-glyph" aria-hidden="true">
            <MenuIcon name="play" className="library-list__badge-icon" />
          </span>
        </button>
      </span>
      <span role="cell" className="library-list__col library-list__col--title">
        <span className="library-list__title-text">
          {/* In front of the title of whatever the player is *playing*, not
              of whatever it has loaded: a paused song is the selected row and
              nothing more. Colour alone would not mark it either way — the
              selected row is already tinted, and a reader scrolling a
              thousand rows needs a mark they can find rather than a shade to
              compare against its neighbours. */}
          {isPlaying && (
            <span
              className="library-list__playing-mark"
              title={t('library.nowPlaying')}
              aria-label={t('library.nowPlaying')}
            >
              {/* Four bars, and nothing else. This was a five-bar spectrum
                  with the response curve riding across it — the graph's own
                  figure in miniature — and at twenty pixels beside a title
                  it read as a smudge: the curve crossed the bars at their own
                  weight and neither could be made out. Four bars at twice the
                  width, no overlay, each on its own period so they never fall
                  into step and pulse as one block. */}
              <svg viewBox="0 0 14 12" aria-hidden="true">
                <g className="library-list__playing-bars">
                  <rect x="0.5" y="1" width="2.2" height="10" rx="1.1" />
                  <rect x="4.1" y="1" width="2.2" height="10" rx="1.1" />
                  <rect x="7.7" y="1" width="2.2" height="10" rx="1.1" />
                  <rect x="11.3" y="1" width="2.2" height="10" rx="1.1" />
                </g>
              </svg>
            </span>
          )}
          {/* The number the record was pressed with, where the tags carry
              one. Quiet and fixed-width so twelve of them make a column the
              eye can run down rather than twelve numbers of differing widths
              pushing the titles about. */}
          {track.trackNo !== undefined && (
            <span className="library-list__track-no">{track.trackNo}</span>
          )}
          <span className="library-list__title-label">{track.title}</span>
          {/* A filled star, before the warning badges rather than among
              them: those say something is wrong with the file and this says
              something the reader chose. Without it the only way to know
              what is favourited would be to open a menu on every row, or to
              go and read the Favourites playlist — which is the question
              this answers in place. */}
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
          {/* The title is already the cleaned filename rather than a tag —
              this says why, and says it is the file's tags that could not be
              read rather than FluidEQ failing to read them. */}
          {track.hasMetadataError && (
            <span
              className="library-list__badge library-list__badge--metadata"
              title={t('library.metadataError')}
            >
              <MenuIcon name="info" className="library-list__badge-icon" />
            </span>
          )}
          {/* Found, not yet read. Never set alongside `hasMetadataError` — a
              pending track has not been through a tag read at all. */}
          {track.isPending && (
            <span
              className="library-list__badge library-list__badge--pending"
              title={t('library.pending')}
            >
              <MenuIcon name="pending" className="library-list__badge-icon" />
            </span>
          )}
          {/* Shares the open album's folder without being part of the album.
              Marked rather than separated out, so the list stays one list. */}
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
      <span role="cell" className="library-list__col">
        {track.artist ?? ''}
      </span>
      <span role="cell" className="library-list__col">
        {track.album ?? ''}
      </span>
      <span role="cell" className="library-list__col library-list__col--length">
        {duration}
        {/* The same menu the right-click opens, on a control that can be
            found without knowing it is there. Right-click is not discoverable
            and does not exist on a touchpad tap, so everything behind it —
            queue, favourite, playlist, karaoke — was reachable only by
            somebody who already guessed. Inside the duration cell rather than
            a column of its own: a column would take width from every row for
            something only ever wanted on the row under the pointer. */}
        <button
          type="button"
          className="library-list__row-menu"
          aria-label={t('library.trackMenu')}
          title={t('library.trackMenu')}
          aria-haspopup="menu"
          onClick={(event) => {
            // The row plays the song. This does not.
            event.stopPropagation();
            onContextMenu(event.currentTarget, track.id);
          }}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="3" r="1.4" />
            <circle cx="8" cy="8" r="1.4" />
            <circle cx="8" cy="13" r="1.4" />
          </svg>
        </button>
      </span>
    </div>
  );
};

export default memo(LibraryTrackRow);
