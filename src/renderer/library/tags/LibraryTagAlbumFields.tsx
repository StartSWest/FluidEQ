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
import {
  cleanTagValue,
  type ITrackTagSheet,
  type TTagFieldKey,
} from '../../../common/library/tagFields';
import { isPlaceholderName } from '../../../common/library/tagFix';
import { useTranslation } from '../../utils/I18nContext';
import { LibraryTagInput, PutBackGlyph } from './LibraryTagField';
import { FIELD_LABEL_KEYS } from './tagLabels';
import { fieldValues, type ISetState } from './tagSetModel';

interface ISharedProps {
  fieldKey: TTagFieldKey;
  sheets: readonly ITrackTagSheet[];
  state: ISetState;
  onShared: (key: TTagFieldKey, value: string | undefined) => void;
}

/** What a shared field shows: the songs' one value, or what was typed. */
const useShared = (
  fieldKey: TTagFieldKey,
  sheets: readonly ITrackTagSheet[],
  state: ISetState,
) => {
  const values = fieldValues(sheets, fieldKey);
  const isMixed = values.length > 1;
  const typed = state.shared[fieldKey];
  const isEdited = typed !== undefined;
  const value = typed ?? (isMixed ? '' : (values[0]?.value ?? ''));
  // What the songs said before an edit, struck under it where they agreed
  // on something: "<Desconocido>" gone, "Goodbye Lullaby" in its place.
  const was = !isMixed ? (values[0]?.value ?? '') : '';
  // Every song had nothing here: the value is an addition, shown in green
  // with nothing struck.
  const isAdded =
    isEdited &&
    value !== '' &&
    values.every(
      (entry) => entry.value === '' || isPlaceholderName(entry.value),
    );
  const showsWas = isEdited && !isAdded && was !== '' && was !== value;
  return { values, isMixed, isEdited, isAdded, value, was, showsWas };
};

/**
 * Under a field the songs disagree on, every value they hold: "Varies:
 * 2009 · 2011 · 2014 · 2015", each a press that gives it to every song. It
 * replaced a "Mixed · 3 values" chip behind which the values hid, and then
 * an "and 2 more" that hid the rest (Ivan, 2026-11-16: "I want to see all
 * the values").
 */
const Varies = ({
  fieldKey,
  sheets,
  onShared,
}: Omit<ISharedProps, 'state'>) => {
  const { t } = useTranslation();
  const values = fieldValues(sheets, fieldKey);
  return (
    <p className="library-tags-album__varies">
      <span>{t('library.tags.set.varies')}</span>
      {values.map((entry, index) => (
        <span key={entry.value} className="library-tags-album__value">
          {index > 0 && <span aria-hidden="true">·</span>}
          <button
            type="button"
            title={t('library.tags.set.useForAll', { count: sheets.length })}
            onClick={() => onShared(fieldKey, entry.value)}
          >
            {entry.value === '' ? t('library.tags.fix.empty') : entry.value}
          </button>
        </span>
      ))}
    </p>
  );
};

/**
 * The album's name, typed over the page's own big title — the album page
 * the Library already shows, made writable.
 */
export const LibraryTagAlbumTitle = ({
  fieldKey,
  sheets,
  state,
  onShared,
}: ISharedProps) => {
  const { t } = useTranslation();
  const id = useId();
  const { isMixed, isEdited, isAdded, value, was, showsWas } = useShared(
    fieldKey,
    sheets,
    state,
  );
  return (
    <div
      className={`library-tags-album__title${isEdited ? ' is-edited' : ''}${
        isAdded ? ' is-added' : ''
      }`}
    >
      <label htmlFor={id}>
        {t(FIELD_LABEL_KEYS[fieldKey])}
        {' · '}
        {sheets.length === 1
          ? t('library.trackCountOne')
          : t('library.trackCount', { count: sheets.length })}
      </label>
      <div className="library-tags-album__title-box">
        <input
          id={id}
          value={value}
          spellCheck={false}
          autoComplete="off"
          placeholder={
            isMixed && !isEdited ? t('library.tags.set.variesPlaceholder') : '—'
          }
          aria-invalid={
            isEdited && cleanTagValue(fieldKey, value) === undefined
          }
          onChange={(event) => onShared(fieldKey, event.target.value)}
        />
        {isEdited && (
          <button
            type="button"
            className="library-tags__put-back"
            title={t('library.tags.putBack')}
            aria-label={t('library.tags.putBack')}
            onClick={() => onShared(fieldKey, undefined)}
          >
            <PutBackGlyph />
          </button>
        )}
      </div>
      {showsWas && (
        <p className="library-tags-album__was">
          <del>{was}</del>
        </p>
      )}
      {isMixed && !isEdited && (
        <Varies fieldKey={fieldKey} sheets={sheets} onShared={onShared} />
      )}
    </div>
  );
};

/** One album value: its name over its box, and what the songs hold. */
export const LibraryTagAlbumField = ({
  suggestion,
  fieldKey,
  sheets,
  state,
  onShared,
}: ISharedProps & {
  /** Offered in one press where every song leaves the field empty: the
   * album artist from what most songs' artist says. */
  suggestion?: string;
}) => {
  const { t } = useTranslation();
  const id = useId();
  const { isMixed, isEdited, isAdded, value, was, showsWas } = useShared(
    fieldKey,
    sheets,
    state,
  );
  return (
    <div
      className={`library-tags-album__field${isEdited ? ' is-edited' : ''}${
        isAdded ? ' is-added' : ''
      }`}
    >
      <label htmlFor={id}>{t(FIELD_LABEL_KEYS[fieldKey])}</label>
      <LibraryTagInput
        id={id}
        value={value}
        isEdited={isEdited}
        placeholder={
          isMixed && !isEdited ? t('library.tags.set.variesPlaceholder') : '—'
        }
        isInvalid={isEdited && cleanTagValue(fieldKey, value) === undefined}
        onChange={(next) => onShared(fieldKey, next)}
        onPutBack={() => onShared(fieldKey, undefined)}
        trail={
          !isMixed && !isEdited && value === '' && suggestion ? (
            <button
              type="button"
              className="library-tags__values"
              onClick={() => onShared(fieldKey, suggestion)}
            >
              {t('library.tags.set.use', { value: suggestion })}
            </button>
          ) : undefined
        }
      />
      {showsWas && (
        <p className="library-tags-album__was">
          <del>{was}</del>
        </p>
      )}
      {isMixed && !isEdited && (
        <Varies fieldKey={fieldKey} sheets={sheets} onShared={onShared} />
      )}
    </div>
  );
};
