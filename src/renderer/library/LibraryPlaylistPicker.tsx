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

import { useState } from 'react';
import {
  FAVORITES_PLAYLIST_ID,
  MAX_PLAYLIST_NAME_LENGTH,
  isTrackInPlaylist,
} from '../../common/library/playlists';
import TextInput from '../widgets/TextInput';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import { usePlaylists } from './PlaylistContext';

/** Which of its own two faces the picker is showing. */
type TPickerPage = 'list' | 'new';

/**
 * "Put these somewhere" — the shelf of playlists, and the field that makes a
 * new one.
 *
 * Its own component because it is the half of the row menu that a SET of songs
 * wants as much as a single one does: the album header adds a whole record,
 * a multi-selection adds whatever is lit, and a row adds itself. All three ask
 * the same question and only differ in how many ids they hand over — so the
 * ids are the parameter and there is one picker rather than three that drift.
 *
 * It owns which of its two faces is up. The caller owns whether the picker is
 * showing at all, which is why `onBack` exists: leaving the picker is the
 * caller's page change, not this one's.
 */
const LibraryPlaylistPicker = ({
  trackIds,
  onBack,
  onClose,
}: {
  /** Everything being filed. One id from a row, a record's worth from a
   * drill-in header, or whatever is lit in a multi-selection. */
  trackIds: readonly string[];
  /** Back to whatever page the caller was showing. */
  onBack: () => void;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  const { playlists, addTracks, createPlaylist } = usePlaylists();
  const [page, setPage] = useState<TPickerPage>('list');
  const [newName, setNewName] = useState('');

  const submitNewPlaylist = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    createPlaylist(trimmed, trackIds);
    onClose();
  };

  if (page === 'new') {
    return (
      <>
        <button
          type="button"
          className="library-list__menu-back"
          onClick={() => setPage('list')}
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
            handleEscape={() => setPage('list')}
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
  }

  return (
    <>
      <button
        type="button"
        className="library-list__menu-back"
        onClick={onBack}
      >
        <MenuIcon name="back" className="library-list__menu-icon" />
        <span>{t('library.playlist.addTo')}</span>
      </button>
      {playlists.map((playlist) => {
        // EVERY id, not any of them. A record half of which is already in a
        // playlist still has a half that is not, and disabling that row would
        // be refusing the only useful press on it. `addTracks` skips what is
        // already there, so the partial case adds the remainder and nothing
        // is duplicated.
        const hasAll = trackIds.every((id) => isTrackInPlaylist(playlist, id));
        return (
          <button
            key={playlist.id}
            type="button"
            // Shown and disabled rather than hidden: a list that quietly
            // omits the playlist you were looking for reads as the playlist
            // having been lost, and the tick is the answer to "did I already
            // put it there".
            disabled={hasAll}
            title={hasAll ? t('library.playlist.alreadyIn') : undefined}
            onClick={() => {
              addTracks(playlist.id, trackIds);
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
            {hasAll && (
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
};

export default LibraryPlaylistPicker;
