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

import { useMemo } from 'react';
import type { ISubtitleFile } from '../../common/library/subtitles';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import subtitleLabels from './subtitleLabels';

/** A file's kind as its extension says it: SRT, VTT. */
const kindOf = (fileName: string): string =>
  fileName.slice(fileName.lastIndexOf('.') + 1).toUpperCase();

/**
 * A video's subtitle files, one row each: the language (`subtitleLabels`)
 * over the file's own name, and its kind (SRT, VTT) at the end (Ivan,
 * 2026-11-15: "also show the sub name in the list"). The one in use wears
 * the Library's mark (`studio-mark`, as the playing lyric line and the
 * rail's place do) and a press puts another in use. A row never wraps: a
 * name too long for the pane is cut, and its whole self is the row's
 * tooltip. A file just kept says so above the rows, on one line.
 */
const LibrarySubtitleFiles = ({
  files,
  shownFileName,
  isShownEmpty,
  savedFileName,
  onChoose,
}: {
  files: readonly ISubtitleFile[];
  shownFileName: string | undefined;
  /** The file in use held no cue that could be read. */
  isShownEmpty: boolean;
  savedFileName: string | undefined;
  onChoose: (fileName: string, tag: string | undefined) => void;
}) => {
  const { t } = useTranslation();
  const labels = useMemo(() => subtitleLabels(files, t), [files, t]);
  const shownLabel =
    shownFileName === undefined ? undefined : labels.get(shownFileName);

  return (
    <section className="library-lyrics-finder__group">
      <h3 className="library-pane__heading">{t('library.subtitles.files')}</h3>
      {/* One line, cut at the pane's edge (`library-lyrics__source` without
          `is-notice`), and whole in its tooltip: a release name runs to
          sixty characters and wrapped it was three lines of file name. */}
      {savedFileName !== undefined && (
        <p
          className="library-lyrics__source is-saved library-subtitles__note"
          role="status"
          title={t('library.subtitles.import.saved', { name: savedFileName })}
        >
          <MenuIcon name="check" />
          <span>
            {t('library.subtitles.import.saved', { name: savedFileName })}
          </span>
        </p>
      )}
      <ul
        className="library-subtitles__files"
        role="radiogroup"
        aria-label={t('library.subtitles.files')}
      >
        {files.map((file) => {
          const label = labels.get(file.fileName) ?? '';
          const isShown = file.fileName === shownFileName;
          return (
            <li key={file.fileName}>
              <button
                type="button"
                role="radio"
                aria-checked={isShown}
                className={`library-lyrics__line library-subtitles__file${
                  isShown ? ' is-active' : ''
                }`}
                // The file it is, for a viewer who needs to know which.
                title={file.fileName}
                onClick={() => {
                  if (!isShown) {
                    onChoose(file.fileName, file.tag);
                  }
                }}
              >
                <span className="library-subtitles__file-words">
                  <span className="library-subtitles__file-language">
                    {label}
                  </span>
                  <small className="library-subtitles__file-name">
                    {file.fileName}
                  </small>
                </span>
                <small className="library-subtitles__file-kind">
                  {kindOf(file.fileName)}
                </small>
              </button>
            </li>
          );
        })}
      </ul>
      {isShownEmpty && shownLabel !== undefined && (
        <p className="library-pane__note library-subtitles__note">
          {t('library.subtitles.unreadable', { name: shownLabel })}
        </p>
      )}
    </section>
  );
};

export default LibrarySubtitleFiles;
