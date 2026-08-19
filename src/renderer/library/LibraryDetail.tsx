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

import { useEffect, useMemo } from 'react';
import {
  artistKey,
  groupIntoAlbums,
  groupIntoArtists,
  sortTracks,
} from '../../common/library/grouping';
import { ILibraryTrack } from '../../common/library/types';
import { useTranslation } from '../utils/I18nContext';
import MenuIcon from '../icons/MenuIcon';
import LibraryCoverArt from './LibraryCoverArt';
import LibraryListView from './LibraryListView';

interface ILibraryDetailProps {
  tracks: readonly ILibraryTrack[];
  albumId?: string;
  artistId?: string;
  onBack: () => void;
  onPlayTrack: (trackId: string) => void;
  /** Forwarded straight to the `LibraryListView` this renders — see that
   * component's own doc comment for why it stays optional. */
  offlineRootIds?: ReadonlySet<string>;
}

/**
 * The drill-in behind a grid tile or a list row: a header for the one album
 * or artist, then its songs — `LibraryListView` in `browseMode="song"`
 * rather than a second table, so playability badges, the metadata-error
 * badge, keyboard rows and the reveal menu all still work here.
 *
 * `albumId` and `artistId` are mutually exclusive in practice — the
 * workspace that owns the drill-in state only ever sets one — but both are
 * optional here rather than a discriminated union, matching the interface
 * Task 15's brief specifies.
 */
const LibraryDetail = ({
  tracks,
  albumId,
  artistId,
  onBack,
  onPlayTrack,
  offlineRootIds,
}: ILibraryDetailProps) => {
  const { t } = useTranslation();

  // `groupIntoAlbums`/`groupIntoArtists` walk every track in the library.
  // Memoised on the track list and the id actually being opened, so a
  // re-render this drill-in did not ask for does not redo it — see
  // `LibraryGridView`'s identical reasoning.
  const album = useMemo(
    () =>
      albumId
        ? groupIntoAlbums(tracks).find((entry) => entry.id === albumId)
        : undefined,
    [tracks, albumId],
  );
  const artist = useMemo(
    () =>
      artistId
        ? groupIntoArtists(tracks).find((entry) => entry.id === artistId)
        : undefined,
    [tracks, artistId],
  );

  // An id whose album or artist no longer exists — a rescan dropped the
  // folder, or the root itself was removed while this was open. Left alone,
  // the screen below would settle on "Unknown album", a generated tile, a
  // Play button that does nothing, and no way back other than knowing the
  // Back button is there: the blank-screen-with-no-explanation shape this
  // project's rules are written against. Closing automatically, rather than
  // showing that and waiting for the user to notice, is the only answer
  // that does not require them to.
  const isOrphaned =
    (Boolean(albumId) && !album) || (Boolean(artistId) && !artist);

  useEffect(() => {
    if (isOrphaned) {
      onBack();
    }
  }, [isOrphaned, onBack]);

  // The album's own `trackIds` are already in disc/track/title order; an
  // artist has no such order of its own, so its tracks are grouped by album
  // the same way `LibraryToolbar`'s "Album" sort does.
  const detailTracks = useMemo(() => {
    if (albumId) {
      const byId = new Map(tracks.map((track) => [track.id, track]));
      return (album?.trackIds ?? [])
        .map((id) => byId.get(id))
        .filter((track): track is ILibraryTrack => track !== undefined);
    }
    if (artistId) {
      return sortTracks(
        tracks.filter((track) => artistKey(track) === artistId),
        'album',
      );
    }
    return [];
  }, [tracks, album, albumId, artistId]);

  // Nothing to draw once the effect above has asked to leave — one render
  // of "Unknown album" and a dead Play button is exactly the flash this
  // guard exists to skip.
  if (isOrphaned) {
    return null;
  }

  const isAlbum = Boolean(albumId);
  const title = isAlbum
    ? album?.title || t('library.unknownAlbum')
    : artist?.name || t('library.unknownArtist');
  const subtitle = isAlbum ? album?.artist || t('library.unknownArtist') : '';
  const counts = isAlbum
    ? t('library.trackCount', { count: detailTracks.length })
    : `${t('library.albumCount', { count: artist?.albumCount ?? 0 })} · ${t(
        'library.trackCount',
        { count: artist?.trackCount ?? detailTracks.length },
      )}`;

  const handlePlay = () => {
    const first = detailTracks[0];
    if (first) {
      onPlayTrack(first.id);
    }
  };

  return (
    <div className="library-detail">
      <button
        type="button"
        className="button small subtle library-detail__back"
        onClick={onBack}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M10 3L5 8l5 5" />
        </svg>
        <span>{t('library.back')}</span>
      </button>
      <div className="library-detail__header">
        <LibraryCoverArt
          artId={isAlbum ? album?.artId : artist?.artId}
          label={title}
          size="cover"
        />
        <div className="library-detail__info">
          <h2 className="library-detail__title">{title}</h2>
          {subtitle && <p className="library-detail__subtitle">{subtitle}</p>}
          <p className="library-detail__counts">{counts}</p>
          {/* Emphasis follows recommendation: this is the one filled button
              on the screen, Back above is the quiet one. */}
          <button
            type="button"
            className="button small library-detail__play"
            onClick={handlePlay}
          >
            <MenuIcon name="play" className="library-detail__play-icon" />
            <span>{t('library.play')}</span>
          </button>
        </div>
      </div>
      <LibraryListView
        tracks={detailTracks}
        browseMode="song"
        onOpenAlbum={() => undefined}
        onOpenArtist={() => undefined}
        onPlayTrack={onPlayTrack}
        offlineRootIds={offlineRootIds}
      />
    </div>
  );
};

export default LibraryDetail;
