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
import type { IFixLine, TFixSource } from '../../../common/library/tagFix';
import { cleanTagValue } from '../../../common/library/tagFields';
import type { TranslationKey } from '../../../common/i18n';
import { useTranslation } from '../../utils/I18nContext';
import { LibraryTagInput } from './LibraryTagField';
import { FIELD_LABEL_KEYS } from './tagLabels';

export const SOURCE_KEYS: Record<TFixSource, TranslationKey> = {
  fileName: 'library.tags.fix.source.fileName',
  capitals: 'library.tags.fix.source.capitals',
  junk: 'library.tags.fix.source.junk',
  majority: 'library.tags.fix.source.majority',
  count: 'library.tags.fix.source.count',
  spelling: 'library.tags.fix.source.spelling',
  hand: 'library.tags.fix.source.hand',
  artistInTitle: 'library.tags.fix.source.artistInTitle',
  folder: 'library.tags.fix.source.folder',
  parentFolder: 'library.tags.fix.source.parentFolder',
};

/** One value for one field, and every line that gives it to some songs. */
export interface IFixEntry {
  key: string;
  lines: IFixLine[];
  /** "Only on song 4": absent when the lines reach every song. */
  songs?: string;
}

interface ILibraryTagFixAlbumProps {
  entries: readonly IFixEntry[];
  isOff: (line: IFixLine) => boolean;
  onToggle: (lines: readonly IFixLine[], isOn: boolean) => void;
  onEdit: (lines: readonly IFixLine[], value: string) => void;
  onPutBack: (lines: readonly IFixLine[]) => void;
}

interface IRowProps extends Omit<ILibraryTagFixAlbumProps, 'entries'> {
  entry: IFixEntry;
}

const Row = ({ entry, isOff, onToggle, onEdit, onPutBack }: IRowProps) => {
  const { t } = useTranslation();
  const id = useId();
  const { lines, songs } = entry;
  const [line] = lines;
  const off = lines.every(isOff);
  const unique = (values: string[]) => [...new Set(values)];
  const facts = [
    ...unique(lines.map((each) => t(SOURCE_KEYS[each.source]))),
    t('library.tags.fix.now', {
      value: unique(
        lines.map((each) => each.before || t('library.tags.fix.empty')),
      ).join(', '),
    }),
    songs,
  ].filter(Boolean);
  return (
    <div className={`library-tags-fix-field${off ? ' is-off' : ''}`}>
      <input
        type="checkbox"
        checked={!off}
        aria-label={t('library.tags.fix.apply')}
        onChange={() => onToggle(lines, off)}
      />
      <label className="library-tags-fix-field__label" htmlFor={id}>
        {t(FIELD_LABEL_KEYS[line.field])}
      </label>
      <div className="library-tags-fix-field__value">
        <LibraryTagInput
          id={id}
          value={line.after}
          onChange={(value) => onEdit(lines, value)}
          isEdited={line.source === 'hand'}
          onPutBack={() => onPutBack(lines)}
          placeholder={t('library.tags.fix.empty')}
          isInvalid={cleanTagValue(line.field, line.after) === undefined}
        />
        <span className="library-tags-fix-field__facts">
          {facts.join(' · ')}
        </span>
      </div>
    </div>
  );
};

/**
 * What the album as a whole gets: one row per proposed value, ticked, the
 * value already in a box to be changed by hand, and under it where it came
 * from and what the songs say now.
 */
const LibraryTagFixAlbum = ({
  entries,
  isOff,
  onToggle,
  onEdit,
  onPutBack,
}: ILibraryTagFixAlbumProps) => {
  const { t } = useTranslation();
  return (
    <section className="library-tags-fix__card">
      <h3 className="library-tags-fix__card-title">
        {t('library.tags.set.album')}
      </h3>
      {entries.map((entry) => (
        <Row
          key={entry.key}
          entry={entry}
          isOff={isOff}
          onToggle={onToggle}
          onEdit={onEdit}
          onPutBack={onPutBack}
        />
      ))}
    </section>
  );
};

export default LibraryTagFixAlbum;
