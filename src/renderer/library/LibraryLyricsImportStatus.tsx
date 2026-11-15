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

import { useCallback } from 'react';
import type { TranslationKey } from '../../common/i18n';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import type { ILyricsImport, TLyricsImportState } from './useLyricsImport';

type TRefusal = Extract<TLyricsImportState, { state: 'refused' }>['reason'];

const REFUSAL_KEYS: Record<TRefusal, TranslationKey> = {
  empty: 'library.lyrics.import.empty',
  tooBig: 'library.lyrics.import.tooBig',
  notText: 'library.lyrics.import.notText',
  notLyricsFile: 'library.lyrics.import.notLyricsFile',
};

/**
 * What an import is doing while it is not yet done: saving, asking before a
 * lyrics file already there is replaced, or why the words were not kept.
 * Kept lyrics are said where they are shown, at the lyrics' foot.
 *
 * The question is asked here, in the tab, never in a system box: "Replace"
 * is what the listener set out to do and wears the accent, keeping the old
 * file the quiet outline.
 */
const LibraryLyricsImportStatus = ({
  lyricsImport,
}: {
  lyricsImport: ILyricsImport;
}) => {
  const { t } = useTranslation();
  const { status } = lyricsImport;
  // Said at the foot of a column that scrolls: brought into the pane when
  // it appears, or a refusal at a short height is said below the fold.
  // Keyed by state, so each new message is a new element and is brought in.
  const reveal = useCallback((node: HTMLElement | null) => {
    node?.scrollIntoView({ block: 'nearest' });
  }, []);
  if (status.state === 'busy') {
    return (
      <p
        key="busy"
        ref={reveal}
        className="library-lyrics-status"
        role="status"
      >
        {t('library.lyrics.import.busy')}
      </p>
    );
  }
  if (status.state === 'confirm') {
    return (
      <div
        key="confirm"
        ref={reveal}
        className="library-lyrics-status is-question"
        role="alert"
      >
        <p className="library-lyrics-status__text">
          {status.place === 'beside'
            ? t('library.lyrics.import.exists', { name: status.fileName })
            : t('library.lyrics.import.existsKept')}
        </p>
        <div className="library-lyrics-finder__actions">
          <button
            type="button"
            className="button small"
            onClick={lyricsImport.replace}
          >
            {t('library.lyrics.import.replace')}
          </button>
          <button
            type="button"
            className="button small subtle"
            onClick={lyricsImport.dismiss}
          >
            {t('library.lyrics.import.keep')}
          </button>
        </div>
      </div>
    );
  }
  if (status.state === 'refused' || status.state === 'failed') {
    return (
      <p
        key={status.state}
        ref={reveal}
        className="library-lyrics-status is-problem"
        role="alert"
      >
        <MenuIcon name="alert" />
        <span>
          {t(
            status.state === 'failed'
              ? 'library.lyrics.import.failed'
              : REFUSAL_KEYS[status.reason],
          )}
        </span>
      </p>
    );
  }
  return null;
};

export default LibraryLyricsImportStatus;
