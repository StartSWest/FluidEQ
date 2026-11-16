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

import { useId, useMemo } from 'react';
import type { ISubtitleFile } from '../../common/library/subtitles';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import subtitleLabels from './subtitleLabels';
import type { ISubtitleRemove } from './useSubtitleRemove';

/** A file's kind as its extension says it: SRT, VTT. */
const kindOf = (fileName: string): string =>
  fileName.slice(fileName.lastIndexOf('.') + 1).toUpperCase();

/**
 * Remove asked in the row itself, never in a window's own dialog: the
 * question, Cancel in the quiet outline, Remove in the red every answer
 * that takes something away wears (`button small danger`). The lyric
 * foot's question, in a row.
 */
const RowQuestion = ({
  label,
  remove,
}: {
  label: string;
  remove: ISubtitleRemove;
}) => {
  const { t } = useTranslation();
  const questionId = useId();
  const { status } = remove;
  if (status.state === 'failed') {
    return (
      <div className="library-lyrics__ask" role="alert">
        <p className="library-lyrics__ask-text">
          {t('library.subtitles.remove.failed', { name: label })}
        </p>
        <div className="library-lyrics__ask-buttons">
          <button
            type="button"
            className="button small subtle"
            onClick={remove.cancel}
          >
            {t('library.lyrics.remove.understood')}
          </button>
        </div>
      </div>
    );
  }
  const isBusy = status.state === 'busy';
  return (
    <div
      className="library-lyrics__ask"
      role="group"
      aria-labelledby={questionId}
    >
      <p id={questionId} className="library-lyrics__ask-text">
        {t('library.subtitles.remove.ask', { name: label })}
      </p>
      <div className="library-lyrics__ask-buttons">
        <button
          type="button"
          className="button small subtle"
          disabled={isBusy}
          onClick={remove.cancel}
        >
          {t('library.subtitles.remove.cancel')}
        </button>
        <button
          type="button"
          className="button small danger"
          disabled={isBusy}
          onClick={remove.confirm}
        >
          {t('library.subtitles.remove.confirm')}
        </button>
      </div>
    </div>
  );
};

/**
 * A video's subtitle files, one row each: the language (`subtitleLabels`)
 * over the file's own name, and its kind (SRT, VTT) at the end (Ivan,
 * 2026-11-15: "also show the sub name in the list"). The one in use wears
 * the Library's mark (`studio-mark`, as the playing lyric line and the
 * rail's place do) and a press puts another in use. A row never wraps: a
 * name too long for the pane is cut, and its whole self is the row's
 * tooltip. A file just kept says so above the rows, on one line. Each row
 * can send its file to the Recycle Bin, asked first in the row (Ivan,
 * 2026-11-15: "add an option to remove a sub").
 */
const LibrarySubtitleFiles = ({
  files,
  shownFileName,
  isShownEmpty,
  savedFileName,
  onChoose,
  remove,
}: {
  files: readonly ISubtitleFile[];
  shownFileName: string | undefined;
  /** The file in use held no cue that could be read. */
  isShownEmpty: boolean;
  savedFileName: string | undefined;
  onChoose: (fileName: string, tag: string | undefined) => void;
  remove: ISubtitleRemove;
}) => {
  const { t } = useTranslation();
  const labels = useMemo(() => subtitleLabels(files, t), [files, t]);
  const shownLabel =
    shownFileName === undefined ? undefined : labels.get(shownFileName);
  const { status } = remove;
  const questioned = status.state === 'idle' ? undefined : status.fileName;

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
            <li
              key={file.fileName}
              className={`library-subtitles__row${isShown ? ' is-active' : ''}`}
            >
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
              {/* Held still while a question is open, not taken away: the
                  row keeps its shape and nothing under it moves. */}
              <button
                type="button"
                className="button small subtle library-lyrics__remove"
                aria-label={t('library.subtitles.remove.label', {
                  name: label,
                })}
                title={t('library.subtitles.remove.label', { name: label })}
                disabled={status.state !== 'idle'}
                onClick={() => remove.ask(file.fileName)}
              >
                <MenuIcon name="trash" />
              </button>
              {questioned === file.fileName && (
                <RowQuestion label={label} remove={remove} />
              )}
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
