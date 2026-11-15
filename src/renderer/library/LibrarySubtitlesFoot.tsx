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
import type { Translate } from '../../common/i18n';
import {
  type ISubtitleFile,
  subtitleLanguage,
  subtitleQualifiers,
} from '../../common/library/subtitles';
import MenuIcon from '../icons/MenuIcon';
import karaokeLanguageName from '../karaoke/karaokeLanguageName';
import { useTranslation } from '../utils/I18nContext';
import Dropdown from '../widgets/Dropdown';
import type { IOptionEntry } from '../widgets/List';

/**
 * Each file as the picker names it: its language in that language's own
 * words ("Español"), what kind of track it is after it ("English · forced"),
 * or its file name where the name says no language. Two files that would
 * read the same — an `.srt` and a `.vtt` of one language — are named by
 * file, or the picker would offer two identical choices.
 */
const labelsOf = (
  files: readonly ISubtitleFile[],
  t: Translate,
): Map<string, string> => {
  const named = files.map((file) => {
    const language = subtitleLanguage(file.tag);
    if (language === undefined) {
      return file.fileName;
    }
    const name = karaokeLanguageName(language);
    const variant = subtitleQualifiers(file.tag).join(' ');
    return variant === ''
      ? name
      : t('library.subtitles.variant', { language: name, variant });
  });
  return new Map(
    files.map((file, at) => [
      file.fileName,
      named.indexOf(named[at]) === named.lastIndexOf(named[at])
        ? named[at]
        : file.fileName,
    ]),
  );
};

/**
 * The Subtitles tab's foot: which file the lines come from — or, right
 * after an import, where it was kept — with the language picker at the end
 * of that row where the video has more than one file, and under it the way
 * to other subtitles. The Lyrics tab's foot in its classes; the picker is
 * the app's own dropdown in the Library bar's quiet face
 * (`_libraryWorkspace.scss`).
 */
const LibrarySubtitlesFoot = ({
  files,
  shownFileName,
  savedFileName,
  onChoose,
  onFind,
}: {
  files: readonly ISubtitleFile[];
  shownFileName: string;
  /** The file just kept, said in place of the source until the video
   * changes. */
  savedFileName: string | undefined;
  onChoose: (fileName: string, tag: string | undefined) => void;
  onFind: () => void;
}) => {
  const { t } = useTranslation();
  const labels = useMemo(() => labelsOf(files, t), [files, t]);
  const options: IOptionEntry[] = files.map((file) => {
    const label = labels.get(file.fileName) ?? file.fileName;
    return { value: file.fileName, label, display: label };
  });
  const isSaved = savedFileName === shownFileName;
  const source = isSaved
    ? t('library.subtitles.import.saved', { name: shownFileName })
    : t('library.lyrics.fromFile', { name: shownFileName });

  return (
    <div className="library-lyrics__foot">
      <div className="library-lyrics__source-row">
        <p
          className={`library-lyrics__source${
            isSaved ? ' is-notice is-saved' : ''
          }`}
          title={source}
          role={isSaved ? 'status' : undefined}
        >
          {isSaved && <MenuIcon name="check" />}
          <span>{source}</span>
        </p>
        {files.length > 1 && (
          <div className="library-lyrics__language">
            <Dropdown
              name={t('library.subtitles.language')}
              menuClassName="language-picker-menu"
              options={options}
              value={shownFileName}
              isDisabled={false}
              // Upward: the foot is the pane's bottom edge.
              placement="up"
              handleChange={(fileName) => {
                const file = files.find((entry) => entry.fileName === fileName);
                if (file !== undefined) {
                  onChoose(file.fileName, file.tag);
                }
              }}
            />
          </div>
        )}
      </div>
      <div className="library-lyrics__actions">
        <button
          type="button"
          className="button small subtle library-lyrics__other"
          onClick={onFind}
        >
          {t('library.subtitles.other')}
        </button>
      </div>
    </div>
  );
};

export default LibrarySubtitlesFoot;
