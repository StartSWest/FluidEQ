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

import { useId } from 'react';
import type { ITrackTagSheet } from '../../../common/library/tagFields';
import type { ILibraryTrack } from '../../../common/library/types';
import MenuIcon from '../../icons/MenuIcon';
import { useTranslation } from '../../utils/I18nContext';
import { formatOf } from '../libraryColumns';
import { formatDuration } from './tagTime';
import type { ITagDraft } from './tagDrafts';

/** The folder's own separator: a backslash on Windows, a slash elsewhere. */
const joinPath = (folder: string, name: string): string =>
  `${folder}${folder.includes('\\') ? '\\' : '/'}${name}`;

interface ILibraryTagFileFactsProps {
  sheet: ITrackTagSheet;
  track: ILibraryTrack | undefined;
  draft: ITagDraft | undefined;
  onVersion: (version: 3 | 4 | undefined) => void;
  onKeepId3v1: (keep: boolean | undefined) => void;
}

/**
 * What the file is and what it carries, and the two choices that are about
 * the file rather than the song: the ID3v2 version, kept unless another is
 * picked, and the old ID3v1 tag.
 */
const LibraryTagFileFacts = ({
  sheet,
  track,
  draft,
  onVersion,
  onKeepId3v1,
}: ILibraryTagFileFactsProps) => {
  const { t } = useTranslation();
  const v1Id = useId();
  const format = [
    track ? formatOf(track.path) : sheet.format.toUpperCase(),
    track?.sampleRate ? `${track.sampleRate / 1000} kHz` : '',
    track?.bitrate ? `${Math.round(track.bitrate / 1000)} kbps` : '',
    track?.durationMs ? formatDuration(track.durationMs) : '',
  ].filter(Boolean);
  const own = sheet.id3v2Version ?? 3;
  const other: 3 | 4 = own === 3 ? 4 : 3;
  const chosen = draft?.id3v2Version ?? own;
  const keepsV1 = draft?.keepId3v1 ?? sheet.hasId3v1;
  const offersV1 = sheet.format === 'mp3' || sheet.format === 'aac';

  return (
    <div className="library-tags__facts">
      <div className="library-tags__row is-fact">
        <span className="library-tags__label">
          {t('library.tags.file.format')}
        </span>
        <span className="library-tags__fact">{format.join(' · ')}</span>
      </div>
      <div className="library-tags__row is-fact">
        <span className="library-tags__label">
          {t('library.tags.file.tags')}
        </span>
        <span className="library-tags__chips">
          {sheet.tagsInFile.length > 0 ? (
            sheet.tagsInFile.map((name) => (
              <span key={name} className="library-tags__chip">
                {name}
              </span>
            ))
          ) : (
            <span className="library-tags__chip is-warning">
              {t('library.tags.file.noTags')}
            </span>
          )}
        </span>
      </div>
      {sheet.canChooseId3v2Version && (
        <>
          <div className="library-tags__row is-fact">
            <span className="library-tags__label">
              {t('library.tags.file.writeAs')}
            </span>
            <span
              className="segmented library-tags__segmented"
              role="radiogroup"
            >
              <button
                type="button"
                role="radio"
                aria-checked={chosen === own}
                className={`segmented__option${chosen === own ? ' is-selected' : ''}`}
                onClick={() => onVersion(undefined)}
              >
                {sheet.tagsInFile.some((name) => name.startsWith('ID3v2'))
                  ? t('library.tags.file.keep', { version: `ID3v2.${own}` })
                  : `ID3v2.${own}`}
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={chosen === other}
                className={`segmented__option${chosen === other ? ' is-selected' : ''}`}
                onClick={() => onVersion(other)}
              >
                {`ID3v2.${other}`}
              </button>
            </span>
          </div>
          <p className="library-tags__note">
            {t(
              chosen === 4
                ? 'library.tags.file.v24Note'
                : 'library.tags.file.v23Note',
            )}
          </p>
        </>
      )}
      {offersV1 && (
        <label className="library-tags__check" htmlFor={v1Id}>
          <input
            id={v1Id}
            type="checkbox"
            checked={keepsV1}
            onChange={() =>
              onKeepId3v1(!keepsV1 === sheet.hasId3v1 ? undefined : !keepsV1)
            }
          />
          <span>{t('library.tags.file.id3v1')}</span>
        </label>
      )}
      {sheet.isReadOnly && (
        <p className="library-tags__note is-warning">
          <MenuIcon name="lock" />
          {t('library.tags.file.readOnly')}
        </p>
      )}
      <p className="library-tags__path">
        {joinPath(sheet.folder, sheet.fileName)}
      </p>
      <button
        type="button"
        className="button small subtle library-tags__reveal"
        onClick={() => {
          window.electron.ipcRenderer
            .revealLibraryTrack(sheet.trackId)
            .catch(() => undefined);
        }}
      >
        <MenuIcon name="folder" />
        {t('library.reveal')}
      </button>
    </div>
  );
};

export default LibraryTagFileFacts;
