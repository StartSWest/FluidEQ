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

import type { ILibraryTrack } from '../../common/library/types';
import { useTranslation } from '../utils/I18nContext';
import LibraryArtistName from './LibraryArtistName';
import LibraryCoverArt from './LibraryCoverArt';

/**
 * The right pane's head (the "A + C" design, Ivan 2026-11-14): the song the
 * player holds, its cover at 56px beside its title and "artist · album", on a
 * tray of light — so what plays and what comes next are read in one place.
 * The loaded song, playing or paused: it is still the one being listened to.
 */
const LibraryNowPlayingCard = ({
  track,
  isPending = false,
}: {
  track: ILibraryTrack | undefined;
  /** The player has a song coming and has not read it yet. */
  isPending?: boolean;
}) => {
  const { t } = useTranslation();
  // Its room and nothing in it while the song is still coming: "Nothing
  // playing" said for a moment before the song's own name read as the card
  // changing its mind (Ivan, 2026-11-15: "make sure it completely has it
  // before showing it").
  if (track === undefined && isPending) {
    return (
      <div className="library-now is-empty is-pending" aria-hidden="true">
        <span className="library-now__art-empty" />
        <span className="library-now__text" />
      </div>
    );
  }
  if (track === undefined) {
    return (
      <div className="library-now is-empty">
        <span className="library-now__art-empty" aria-hidden="true" />
        <span className="library-now__text">
          <b className="library-now__title">{t('library.now.nothing')}</b>
          <small className="library-now__who">
            {t('library.now.nothingHint')}
          </small>
        </span>
      </div>
    );
  }
  return (
    <div className="library-now" title={track.title}>
      <LibraryCoverArt artId={track.artId} label={track.title} size="tile" />
      <span className="library-now__text">
        <b className="library-now__title">{track.title}</b>
        <small className="library-now__who">
          {/* The artist a way to their page, the album beside it. */}
          <LibraryArtistName
            line={track.artist}
            fallback={track.album ? undefined : t('library.unknownArtist')}
          />
          {track.artist?.trim() && track.album ? ' · ' : ''}
          {track.album}
        </small>
      </span>
    </div>
  );
};

export default LibraryNowPlayingCard;
