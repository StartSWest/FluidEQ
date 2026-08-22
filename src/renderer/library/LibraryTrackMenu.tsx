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
import {
  FAVORITES_PLAYLIST_ID,
  MAX_PLAYLIST_NAME_LENGTH,
  isTrackInPlaylist,
} from '../../common/library/playlists';
import AnchoredMenu from '../widgets/AnchoredMenu';
import TextInput from '../widgets/TextInput';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import { usePlaylists } from './PlaylistContext';
import { canSendTrackToKaraoke, trackAsKaraokeFile } from './libraryToKaraoke';
import { sendFilesToKaraoke } from './karaokeHandoff';

interface ILibraryTrackMenuProps {
  anchor: HTMLElement | null;
  isOpen: boolean;
  /** Resolved by the caller, which already holds the list this row came
   * from. Undefined for an id the index stopped knowing between the right
   * click and this render — a rescan finishing under the pointer. */
  track: ILibraryTrack | undefined;
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
type TMenuPage = 'actions' | 'playlists' | 'new';

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
  track,
  openPlaylistId,
  onQueueTracks,
  onReveal,
  onClose,
}: ILibraryTrackMenuProps) => {
  const { t } = useTranslation();
  const {
    playlists,
    isFavorite,
    toggleFavorite,
    addTracks,
    removeTracks,
    createPlaylist,
  } = usePlaylists();
  const [page, setPage] = useState<TMenuPage>('actions');
  const [newName, setNewName] = useState('');
  // The karaoke handoff reads the whole file through main. Small for a song
  // and not instant for a long lossless one, and a menu item that sits there
  // looking unpressed for two seconds is the failure this state exists to
  // prevent.
  const [isSending, setIsSending] = useState(false);
  const [didSendFail, setDidSendFail] = useState(false);

  // Every open starts at the front page, on a clean field, with no stale
  // error from the last row. Keyed on the track as well as on `isOpen`
  // because right-clicking a second row while the first row's menu is up
  // moves the menu rather than closing it.
  useEffect(() => {
    setPage('actions');
    setNewName('');
    setDidSendFail(false);
  }, [isOpen, track?.id]);

  if (!track) {
    return null;
  }

  const trackId = track.id;
  const isFavorited = isFavorite(trackId);
  const canSendToKaraoke = canSendTrackToKaraoke(track);

  const sendToKaraoke = () => {
    setIsSending(true);
    setDidSendFail(false);
    trackAsKaraokeFile(track)
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

  const submitNewPlaylist = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    createPlaylist(trimmed, [trackId]);
    onClose();
  };

  const actionsPage = (
    <>
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
            onQueueTracks([trackId]);
            onClose();
          }}
        >
          <MenuIcon name="queueAdd" className="library-list__menu-icon" />
          <span>{t('library.queueAdd')}</span>
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          toggleFavorite(trackId);
          onClose();
        }}
      >
        <MenuIcon
          name="star"
          className={`library-list__menu-icon${
            isFavorited ? ' library-list__menu-icon--on' : ''
          }`}
        />
        <span>
          {t(
            isFavorited
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
            removeTracks(openPlaylistId, [trackId]);
            onClose();
          }}
        >
          <MenuIcon name="clear" className="library-list__menu-icon" />
          <span>{t('library.playlist.removeFrom')}</span>
        </button>
      )}
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
      <button type="button" onClick={() => onReveal(trackId)}>
        <MenuIcon name="external" className="library-list__menu-icon" />
        <span>{t('library.reveal')}</span>
      </button>
    </>
  );

  const playlistsPage = (
    <>
      <button
        type="button"
        className="library-list__menu-back"
        onClick={() => setPage('actions')}
      >
        <MenuIcon name="back" className="library-list__menu-icon" />
        <span>{t('library.playlist.addTo')}</span>
      </button>
      {playlists.map((playlist) => {
        const has = isTrackInPlaylist(playlist, trackId);
        return (
          <button
            key={playlist.id}
            type="button"
            // Shown and disabled rather than hidden: a list that quietly
            // omits the playlist you were looking for reads as the playlist
            // having been lost, and the tick is the answer to "did I already
            // put it there".
            disabled={has}
            title={has ? t('library.playlist.alreadyIn') : undefined}
            onClick={() => {
              addTracks(playlist.id, [trackId]);
              onClose();
            }}
          >
            <MenuIcon
              name={playlist.id === FAVORITES_PLAYLIST_ID ? 'star' : 'playlist'}
              className="library-list__menu-icon"
            />
            <span>
              {playlist.id === FAVORITES_PLAYLIST_ID
                ? t('library.playlist.favorites')
                : playlist.name}
            </span>
            {has && (
              <span className="library-list__menu-tick" aria-hidden="true">
                ✓
              </span>
            )}
          </button>
        );
      })}
      <button
        type="button"
        className="library-list__menu-new"
        onClick={() => setPage('new')}
      >
        <MenuIcon name="plus" className="library-list__menu-icon" />
        <span>{t('library.playlist.new')}</span>
      </button>
    </>
  );

  const newPage = (
    <>
      <button
        type="button"
        className="library-list__menu-back"
        onClick={() => setPage('playlists')}
      >
        <MenuIcon name="back" className="library-list__menu-icon" />
        <span>{t('library.playlist.new')}</span>
      </button>
      <div className="library-list__menu-field">
        <TextInput
          value={newName}
          ariaLabel={t('library.playlist.newName')}
          placeholder={t('library.playlist.newName')}
          isDisabled={false}
          errorMessage=""
          formatInput={(value) => value.slice(0, MAX_PLAYLIST_NAME_LENGTH)}
          handleChange={setNewName}
          handleSubmit={submitNewPlaylist}
          handleEscape={() => setPage('playlists')}
        />
        <button
          type="button"
          className="button small"
          disabled={newName.trim().length === 0}
          onClick={() => submitNewPlaylist(newName)}
        >
          {t('library.playlist.create')}
        </button>
      </div>
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
      {page === 'playlists' && playlistsPage}
      {page === 'new' && newPage}
    </AnchoredMenu>
  );
};

export default LibraryTrackMenu;
