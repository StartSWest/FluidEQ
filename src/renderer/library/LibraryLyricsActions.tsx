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

import { type ReactNode, useId } from 'react';
import type { ILibraryLyrics } from '../../common/library/lyrics';
import type { ILibraryTrack } from '../../common/library/types';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import { useLyricsRemove } from './useLyricsRemove';
import { useOpenInKaraoke } from './useOpenInKaraoke';

interface ILibraryLyricsActionsProps {
  track: ILibraryTrack;
  lyrics: ILibraryLyrics;
  /** The most completely timed words the song has, where they are not the
   * ones shown: what Open in Karaoke hands over. */
  forKaraoke?: ILibraryLyrics;
  onFind: () => void;
  /** The lyrics file was removed: read the song's lyrics again. */
  onRemoved: () => void;
  /** Where the words came from, said on the first row. */
  source: ReactNode;
}

/**
 * The tab's foot: where the words came from, with Remove at the end of that
 * row — it removes the very file the row names — and under it what can be
 * done with them: time them in the Karaoke Maker, or find others.
 *
 * Remove is asked here: the row under the source becomes the question until
 * it is answered — never a window's own dialog. Words in the song's own tags
 * get the reason they stay instead of the question.
 */
const LibraryLyricsActions = ({
  track,
  lyrics,
  forKaraoke,
  onFind,
  onRemoved,
  source,
}: ILibraryLyricsActionsProps) => {
  const { t } = useTranslation();
  const questionId = useId();
  const karaoke = useOpenInKaraoke(track, forKaraoke ?? lyrics);
  const remove = useLyricsRemove(track.id, lyrics, onRemoved);
  const { status } = remove;

  let lower: ReactNode;
  if (status.state === 'asking' || status.state === 'busy') {
    const isBusy = status.state === 'busy';
    let question = '';
    if (status.state === 'asking') {
      question =
        status.target.place === 'beside' && lyrics.fileName !== undefined
          ? t('library.lyrics.remove.askFile', { name: lyrics.fileName })
          : t('library.lyrics.remove.askKept');
    } else {
      question = t('library.lyrics.remove.busy');
    }
    lower = (
      <div
        className="library-lyrics__ask"
        role="group"
        aria-labelledby={questionId}
      >
        <p id={questionId} className="library-lyrics__ask-text">
          {question}
        </p>
        <div className="library-lyrics__ask-buttons">
          <button
            type="button"
            className="button small"
            disabled={isBusy}
            onClick={remove.confirm}
          >
            {t('library.lyrics.remove.confirm')}
          </button>
          <button
            type="button"
            className="button small subtle"
            disabled={isBusy}
            onClick={remove.dismiss}
          >
            {t('library.lyrics.remove.keep')}
          </button>
        </div>
      </div>
    );
  } else if (status.state === 'inSong' || status.state === 'failed') {
    lower = (
      <div className="library-lyrics__ask" role="status">
        <p className="library-lyrics__ask-text">
          {t(
            status.state === 'inSong'
              ? 'library.lyrics.remove.inSong'
              : 'library.lyrics.remove.failed',
          )}
        </p>
        <div className="library-lyrics__ask-buttons">
          <button
            type="button"
            className="button small subtle"
            onClick={remove.dismiss}
          >
            {t('library.lyrics.remove.understood')}
          </button>
        </div>
      </div>
    );
  } else {
    lower = (
      <>
        <div className="library-lyrics__actions">
          {karaoke.canOpen && (
            <button
              type="button"
              className="button small subtle library-lyrics__karaoke"
              disabled={karaoke.state === 'busy'}
              title={t(
                lyrics.kind === 'synced'
                  ? 'library.lyrics.karaoke.hintTimed'
                  : 'library.lyrics.karaoke.hintPlain',
              )}
              onClick={karaoke.open}
            >
              <MenuIcon name="microphone" />
              {t(
                karaoke.state === 'busy'
                  ? 'library.lyrics.karaoke.opening'
                  : 'library.lyrics.karaoke.open',
              )}
            </button>
          )}
          <button
            type="button"
            className="button small subtle library-lyrics__other"
            onClick={onFind}
          >
            {t('library.lyrics.other')}
          </button>
        </div>
        {karaoke.state === 'failed' && (
          <p className="library-lyrics__action-note" role="status">
            {t('library.lyrics.karaoke.failed')}
          </p>
        )}
      </>
    );
  }

  return (
    <>
      <div className="library-lyrics__source-row">
        {source}
        {/* Held still while its question is open, not taken away: the row
            keeps its height and nothing under the words moves. */}
        <button
          type="button"
          className="button small subtle library-lyrics__remove"
          aria-label={t('library.lyrics.remove.button')}
          title={t('library.lyrics.remove.button')}
          disabled={status.state !== 'idle'}
          onClick={remove.ask}
        >
          <MenuIcon name="trash" />
        </button>
      </div>
      {lower}
    </>
  );
};

export default LibraryLyricsActions;
