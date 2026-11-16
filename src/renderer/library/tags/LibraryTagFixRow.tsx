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

import { useState } from 'react';
import type { IFixLine, TFixSource } from '../../../common/library/tagFix';
import { cleanTagValue } from '../../../common/library/tagFields';
import type { TranslationKey } from '../../../common/i18n';
import { useTranslation } from '../../utils/I18nContext';
import { FIELD_LABEL_KEYS } from './tagLabels';
import { type IDiffPart, wordDiff } from './wordDiff';

const SOURCE_KEYS: Record<TFixSource, TranslationKey> = {
  fileName: 'library.tags.fix.source.fileName',
  capitals: 'library.tags.fix.source.capitals',
  junk: 'library.tags.fix.source.junk',
  majority: 'library.tags.fix.source.majority',
  count: 'library.tags.fix.source.count',
  spelling: 'library.tags.fix.source.spelling',
  hand: 'library.tags.fix.source.hand',
};

const ArrowGlyph = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true" fill="none">
    <path d="M2.5 8h10M9.5 4.5 13 8l-3.5 3.5" />
  </svg>
);

/** A value's words, the changed ones marked as a deletion or an insertion. */
const Words = ({
  parts,
  mark,
}: {
  parts: IDiffPart[];
  mark: 'del' | 'ins';
}) => (
  <>
    {parts.map((part, index) => {
      // The words of one fixed string, in order: their place is their key.
      const key = `${index}-${part.text}`;
      if (!part.isChanged) {
        return <span key={key}>{part.text}</span>;
      }
      return mark === 'del' ? (
        <del key={key}>{part.text}</del>
      ) : (
        <ins key={key}>{part.text}</ins>
      );
    })}
  </>
);

interface ILibraryTagFixRowProps {
  line: IFixLine;
  isOn: boolean;
  /** "2", "9 · 12", "All 8": which songs the line changes. */
  songs: string;
  onToggle: () => void;
  onEdit: (value: string) => void;
}

/**
 * One proposed change: ticked by default, where it came from, what goes and
 * what arrives with the changed words lit. The new value opens as a box on a
 * press, so a proposal that is nearly right is corrected on its line and
 * written as typed ("Changed by you").
 */
const LibraryTagFixRow = ({
  line,
  isOn,
  songs,
  onToggle,
  onEdit,
}: ILibraryTagFixRowProps) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const diff = wordDiff(line.before, line.after);
  const label = t(FIELD_LABEL_KEYS[line.field]);
  const isInvalid = cleanTagValue(line.field, line.after) === undefined;
  const empty = (
    <span className="library-tags-fix-row__empty">
      {t('library.tags.fix.empty')}
    </span>
  );
  const editHint = t('library.tags.fix.editHint');

  return (
    <div
      className={`library-tags-fix-row${isOn ? '' : ' is-off'}${
        line.source === 'hand' ? ' is-hand' : ''
      }`}
    >
      <input
        type="checkbox"
        checked={isOn}
        aria-label={t('library.tags.fix.apply')}
        onChange={onToggle}
      />
      <span className="library-tags-fix-row__meta">
        <span className="library-tags-fix-row__songs">{songs}</span>
        <span className="library-tags-fix-row__field">
          <span>{label}</span>
          <span className="library-tags-fix-row__source">
            {t(SOURCE_KEYS[line.source])}
          </span>
        </span>
      </span>
      <span className="library-tags-fix-row__before">
        {line.before === '' ? empty : <Words parts={diff.before} mark="del" />}
      </span>
      <span className="library-tags-fix-row__arrow">
        <ArrowGlyph />
      </span>
      <span className="library-tags-fix-row__after">
        {isEditing ? (
          <input
            // eslint-disable-next-line jsx-a11y/no-autofocus -- opened by the reader's own press on the value
            autoFocus
            className={`library-tags-fix-row__input${isInvalid ? ' is-invalid' : ''}`}
            value={line.after}
            placeholder={t('library.tags.fix.empty')}
            aria-label={`${label} · ${editHint}`}
            spellCheck={false}
            onChange={(event) => onEdit(event.target.value)}
            onBlur={() => setIsEditing(false)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === 'Escape') {
                setIsEditing(false);
              }
            }}
          />
        ) : (
          <button
            type="button"
            className={`library-tags-fix-row__value${isInvalid ? ' is-invalid' : ''}`}
            title={editHint}
            aria-label={`${label}: ${line.after || t('library.tags.fix.empty')} · ${editHint}`}
            onClick={() => setIsEditing(true)}
          >
            {line.after === '' ? (
              empty
            ) : (
              <Words parts={diff.after} mark="ins" />
            )}
          </button>
        )}
      </span>
    </div>
  );
};

export default LibraryTagFixRow;
