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

/**
 * The right pane's Lyrics tab: the song's words, from its tags or a lyrics
 * file beside it. Until the reader lands it says, for every song, where it
 * would look — the same empty state a song without lyrics will keep.
 */
const LibraryLyricsTab = ({ track }: { track: ILibraryTrack | undefined }) => {
  const { t } = useTranslation();
  if (track === undefined) {
    return <p className="library-pane__empty">{t('library.lyrics.nothing')}</p>;
  }
  return (
    <div className="library-lyrics is-empty">
      <p className="library-lyrics__none">{t('library.lyrics.none')}</p>
      <p className="library-pane__note">{t('library.lyrics.looked')}</p>
    </div>
  );
};

export default LibraryLyricsTab;
