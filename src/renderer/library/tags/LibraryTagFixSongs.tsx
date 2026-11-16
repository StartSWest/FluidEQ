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

import type { IFixLine } from '../../../common/library/tagFix';
import {
  cleanTagValue,
  type ITrackTagSheet,
} from '../../../common/library/tagFields';
import { useTranslation } from '../../utils/I18nContext';
import { LibraryTagInput } from './LibraryTagField';
import { FIELD_LABEL_KEYS } from './tagLabels';

export interface IFixSongRow {
  sheet: ITrackTagSheet;
  title?: IFixLine;
  trackNo?: IFixLine;
}

interface ILibraryTagFixSongsProps {
  rows: readonly IFixSongRow[];
  isOff: (line: IFixLine) => boolean;
  /** Ticks or unticks every line of one song together. */
  onToggle: (lines: readonly IFixLine[], isOn: boolean) => void;
  onEdit: (lines: readonly IFixLine[], value: string) => void;
  onPutBack: (lines: readonly IFixLine[]) => void;
}

/**
 * Each song's own number and title, one row a song: the new values in boxes
 * to correct by hand, and what they replace struck through beside them.
 */
const LibraryTagFixSongs = ({
  rows,
  isOff,
  onToggle,
  onEdit,
  onPutBack,
}: ILibraryTagFixSongsProps) => {
  const { t } = useTranslation();
  const trackLabel = t(FIELD_LABEL_KEYS.trackNo);
  const titleLabel = t(FIELD_LABEL_KEYS.title);

  const box = (line: IFixLine, label: string, sheet: ITrackTagSheet) => (
    <LibraryTagInput
      value={line.after}
      onChange={(value) => onEdit([line], value)}
      isEdited={line.source === 'hand'}
      onPutBack={() => onPutBack([line])}
      isNumber={line.field === 'trackNo'}
      placeholder={t('library.tags.fix.empty')}
      ariaLabel={`${label} · ${sheet.fileName}`}
      isInvalid={cleanTagValue(line.field, line.after) === undefined}
    />
  );

  return (
    <section className="library-tags-fix__card">
      <h3 className="library-tags-fix__card-title">
        {t('library.tags.set.songs')}
      </h3>
      <div className="library-tags-fix-song is-head" aria-hidden="true">
        <span />
        <span>{trackLabel}</span>
        <span>{titleLabel}</span>
        <span>{t('library.tags.fix.beforeCol')}</span>
      </div>
      {rows.map(({ sheet, title, trackNo }) => {
        const lines = [title, trackNo].filter(
          (line): line is IFixLine => line !== undefined,
        );
        const isOn = lines.every((line) => !isOff(line));
        const before = title ? title.before || sheet.fileName : '';
        return (
          <div
            key={sheet.trackId}
            className={`library-tags-fix-song${isOn ? '' : ' is-off'}`}
          >
            <input
              type="checkbox"
              checked={isOn}
              aria-label={`${t('library.tags.fix.apply')} · ${sheet.fileName}`}
              onChange={() => onToggle(lines, !isOn)}
            />
            <span className="library-tags-fix-song__no">
              {trackNo ? (
                box(trackNo, trackLabel, sheet)
              ) : (
                <span className="library-tags-fix-song__now">
                  {sheet.fields.trackNo ?? ''}
                </span>
              )}
            </span>
            <span className="library-tags-fix-song__title">
              {title ? (
                box(title, titleLabel, sheet)
              ) : (
                <span className="library-tags-fix-song__now">
                  {sheet.fields.title ?? ''}
                </span>
              )}
            </span>
            <span className="library-tags-fix-song__before" title={before}>
              {before !== '' && <del>{before}</del>}
            </span>
          </div>
        );
      })}
    </section>
  );
};

export default LibraryTagFixSongs;
