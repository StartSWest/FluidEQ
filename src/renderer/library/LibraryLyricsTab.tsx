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

import type { ILibraryLyrics } from '../../common/library/lyrics';
import type { ILibraryTrack } from '../../common/library/types';
import { useTranslation } from '../utils/I18nContext';
import LibraryLyricsSynced from './LibraryLyricsSynced';
import { useTrackLyrics } from './useTrackLyrics';

/** Where the words came from, said once at the foot. */
const SourceFoot = ({ lyrics }: { lyrics: ILibraryLyrics }) => {
  const { t } = useTranslation();
  return (
    <div className="library-lyrics__foot">
      <p className="library-lyrics__source">
        {lyrics.fileName === undefined
          ? t('library.lyrics.fromTags')
          : t('library.lyrics.fromFile', { name: lyrics.fileName })}
      </p>
      {/* "Send to Karaoke" belongs here, at the foot's other end, when the
          Karaoke tab can take a song's words with it. */}
    </div>
  );
};

/** The playing song's words, once main has read them. */
const TrackLyrics = ({ track }: { track: ILibraryTrack }) => {
  const { t } = useTranslation();
  const read = useTrackLyrics(track);
  if (read.state === 'reading') {
    // Says so only if the read is slow enough to notice (a fade with a delay
    // in the stylesheet); a quick one shows nothing before the words.
    return (
      <p className="library-pane__empty library-lyrics__reading">
        {t('library.lyrics.reading')}
      </p>
    );
  }
  const { lyrics, looked } = read.answer;
  if (lyrics === undefined) {
    return (
      <div className="library-lyrics is-empty">
        <p className="library-lyrics__none">{t('library.lyrics.none')}</p>
        <p className="library-pane__note">{t('library.lyrics.looked')}</p>
        {looked.length > 0 && (
          <ul className="library-lyrics__looked">
            {looked.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }
  return (
    <div className={`library-lyrics is-${lyrics.kind}`}>
      {lyrics.kind === 'synced' ? (
        <LibraryLyricsSynced lines={lyrics.lines} />
      ) : (
        <div className="library-lyrics__plain">{lyrics.text}</div>
      )}
      <SourceFoot lyrics={lyrics} />
    </div>
  );
};

/**
 * The right pane's Lyrics tab: the playing song's words, from its tags or a
 * lyrics file of its own name beside it (`libraryLyrics.ts` in main). Timed
 * words follow the song; plain ones are there to read; a song with none says
 * where FluidEQ looked.
 */
const LibraryLyricsTab = ({ track }: { track: ILibraryTrack | undefined }) => {
  const { t } = useTranslation();
  if (track === undefined) {
    return <p className="library-pane__empty">{t('library.lyrics.nothing')}</p>;
  }
  // Keyed by song: a new song starts at its own first line, followed.
  return <TrackLyrics key={track.id} track={track} />;
};

export default LibraryLyricsTab;
