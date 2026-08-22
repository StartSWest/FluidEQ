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
import { ILibraryTrack } from '../../common/library/types';
import { FAVORITES_PLAYLIST_ID } from '../../common/library/playlists';
import AnchoredMenu from '../widgets/AnchoredMenu';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import { usePlaylists } from './PlaylistContext';
import LibraryPlaylistPicker from './LibraryPlaylistPicker';
import { canSendTrackToKaraoke, trackAsKaraokeFile } from './libraryToKaraoke';
import { sendFilesToKaraoke } from './karaokeHandoff';

interface ILibraryTrackMenuProps {
  anchor: HTMLElement | null;
  isOpen: boolean;
  /**
   * Everything the menu acts on, resolved by the caller — which already holds
   * the list these came from.
   *
   * One song from a row, several from a lit selection, a whole record from a
   * drill-in header. The count is the only difference, so it is the only
   * thing this takes: a set-of-one is not a special case, it is the ordinary
   * one. Empty for ids the index stopped knowing between the click and this
   * render — a rescan finishing under the pointer — and the menu then draws
   * nothing rather than acting on a song that is gone.
   */
  tracks: readonly ILibraryTrack[];
  /** The playlist being read, when one is open. Adds the one item that only
   * makes sense there, and never appears anywhere else. */
  openPlaylistId?: string;
  /** Put this song after what is playing. Optional the way the view's other
   * outward callbacks are: a caller with no player attached has no queue to
   * append to, and the item is then not drawn at all. */
  onQueueTracks?: (trackIds: readonly string[]) => void;
  onReveal: (trackId: string) => void;
  onClose: () => void;
}

/** Which face the menu is showing. Pages rather than a submenu: `AnchoredMenu`
 * is portalled to the body and has no notion of a nested one, and a hover
 * submenu hanging off a portalled menu is a positioning problem with no good
 * answer at the edge of the window. A page swap has no edge cases and is one
 * press either way. */
type TMenuPage = 'actions' | 'playlists';

/**
 * What a song row offers besides being played.
 *
 * Its own component because `LibraryListView` is already past a thousand
 * lines and this is the part that grows: the menu went from one item to five
 * and two of them have pages behind them.
 */
const LibraryTrackMenu = ({
  anchor,
  isOpen,
  tracks,
  openPlaylistId,
  onQueueTracks,
  onReveal,
  onClose,
}: ILibraryTrackMenuProps) => {
  const { t } = useTranslation();
  const { isFavorite, addTracks, removeTracks } = usePlaylists();
  const [page, setPage] = useState<TMenuPage>('actions');
  // The karaoke handoff reads the whole file through main. Small for a song
  // and not instant for a long lossless one, and a menu item that sits there
  // looking unpressed for two seconds is the failure this state exists to
  // prevent.
  const [isSending, setIsSending] = useState(false);
  const [didSendFail, setDidSendFail] = useState(false);

  // Every open starts at the front page with no stale error from the last
  // row. Keyed on what is being acted on as well as on `isOpen`, because
  // right-clicking a second row while the first row's menu is up moves the
  // menu rather than closing it.
  const subject = tracks.map((entry) => entry.id).join('|');
  useEffect(() => {
    setPage('actions');
    setDidSendFail(false);
  }, [isOpen, subject]);

  const [single] = tracks;
  if (!single) {
    return null;
  }

  const trackIds = tracks.map((entry) => entry.id);
  const isOne = tracks.length === 1;
  // ALL of them, so the label says what the press will do. A record where
  // four of twelve are starred is not "in Favourites", and offering to remove
  // it would take away the eight that are not there while leaving the four
  // that are — the opposite of both readings.
  const areAllFavorited = trackIds.every((id) => isFavorite(id));
  // One song at a time. The handoff reads whole files through main, and
  // "send" on a fifty-track record would be fifty of those at once — a
  // different feature, and not one anybody asked for by pressing this.
  const canSendToKaraoke = isOne && canSendTrackToKaraoke(single);

  const sendToKaraoke = () => {
    setIsSending(true);
    setDidSendFail(false);
    trackAsKaraokeFile(single)
      .then((file) => {
        setIsSending(false);
        if (!file) {
          // Main declined it — unreadable, or past the size cap it applies to
          // playback too. Said here rather than swallowed: the alternative is
          // a press that closes the menu and changes nothing.
          setDidSendFail(true);
          return undefined;
        }
        sendFilesToKaraoke([file]);
        onClose();
        return undefined;
      })
      .catch(() => {
        setIsSending(false);
        setDidSendFail(true);
      });
  };

  const actionsPage = (
    <>
      {/* How many this menu is about, when it is about more than one. Without
          it a menu opened over a lit selection is indistinguishable from one
          opened over the row under the pointer, and the two do very different
          things to a library. */}
      {!isOne && (
        <p className="library-list__menu-subject">
          {t('library.trackCount', { count: tracks.length })}
        </p>
      )}
      {/* FIRST, and above the two that file the song away.
          The row's own click plays this song now; this is the other answer to
          the same question — play it after what is already going. It was the
          one way into the queue that the row did not have: the drill-in
          header queues a whole album, folder or playlist and Cover Flow
          queues a cover, so a single song was the case with no control at
          all. */}
      {onQueueTracks && (
        <button
          type="button"
          onClick={() => {
            onQueueTracks(trackIds);
            onClose();
          }}
        >
          <MenuIcon name="queueAdd" className="library-list__menu-icon" />
          <span>{t('library.queueAdd')}</span>
        </button>
      )}
      {/* THREE GROUPS, and the rules are what say so: what to play, where to
          keep it, where to send it. Presentational, so `role="none"` keeps
          them out of what a screen reader walks — the grouping is a reading
          aid for the eye, and a menu that announces two extra separators is
          slower to hear, not clearer. */}
      {onQueueTracks && <div className="library-list__menu-rule" role="none" />}
      <button
        type="button"
        onClick={() => {
          // `addTracks` skips what is already there, so a part-starred record
          // adds its remainder rather than double-filing anything.
          if (areAllFavorited) {
            removeTracks(FAVORITES_PLAYLIST_ID, trackIds);
          } else {
            addTracks(FAVORITES_PLAYLIST_ID, trackIds);
          }
          onClose();
        }}
      >
        <MenuIcon
          name="star"
          className={`library-list__menu-icon${
            areAllFavorited ? ' library-list__menu-icon--on' : ''
          }`}
        />
        <span>
          {t(
            areAllFavorited
              ? 'library.playlist.removeFromFavorites'
              : 'library.playlist.addToFavorites',
          )}
        </span>
      </button>
      <button
        type="button"
        aria-haspopup="menu"
        onClick={() => setPage('playlists')}
      >
        <MenuIcon name="playlistAdd" className="library-list__menu-icon" />
        <span>{t('library.playlist.addTo')}</span>
        <span className="library-list__menu-more" aria-hidden="true">
          ›
        </span>
      </button>
      {/* Only inside a playlist. On the album shelf there is no "this
          playlist" for it to mean, and an item whose subject has to be
          guessed at is worse than one that is not there. */}
      {openPlaylistId !== undefined && (
        <button
          type="button"
          onClick={() => {
            removeTracks(openPlaylistId, trackIds);
            onClose();
          }}
        >
          <MenuIcon name="clear" className="library-list__menu-icon" />
          <span>{t('library.playlist.removeFrom')}</span>
        </button>
      )}
      {/* Filing done; what follows leaves the library — and neither of them
          means anything for a set, so for a set there is nothing below the
          rule and the rule itself would be a line under the last item. */}
      {isOne && <div className="library-list__menu-rule" role="none" />}
      {/* Absent for video and for containers the Karaoke tab has no decoder
          for, rather than disabled: those are not songs it declined, they are
          songs it was never going to be offered. */}
      {canSendToKaraoke && (
        <button
          type="button"
          className={isSending ? 'is-busy' : undefined}
          disabled={isSending}
          onClick={sendToKaraoke}
          aria-busy={isSending}
        >
          {/* The glyph pulses rather than being swapped for a spinner: this
              app's `Spinner` is five balls across, which is furniture beside
              a 14px menu icon. The label carries the news; the pulse says it
              is still happening. */}
          <MenuIcon name="microphone" className="library-list__menu-icon" />
          <span>
            {t(isSending ? 'library.karaoke.sending' : 'library.karaoke.send')}
          </span>
        </button>
      )}
      {didSendFail && (
        <p className="library-list__menu-error" role="alert">
          {t('library.karaoke.failed')}
        </p>
      )}
      {/* One file has a place on disk. A selection spanning four folders does
          not, and picking one of them to open would be answering a question
          nobody asked. */}
      {isOne && (
        <button type="button" onClick={() => onReveal(single.id)}>
          <MenuIcon name="external" className="library-list__menu-icon" />
          <span>{t('library.reveal')}</span>
        </button>
      )}
    </>
  );

  return (
    <AnchoredMenu
      anchor={anchor}
      isOpen={isOpen}
      className="library-list__menu"
      ariaLabel={t('library.trackActions')}
    >
      {page === 'actions' && actionsPage}
      {page === 'playlists' && (
        <LibraryPlaylistPicker
          trackIds={trackIds}
          onBack={() => setPage('actions')}
          onClose={onClose}
        />
      )}
    </AnchoredMenu>
  );
};

export default LibraryTrackMenu;
