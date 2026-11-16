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

import { useEffect, useId, useRef, useState } from 'react';
import {
  cleanTagValue,
  type ITrackTagSheet,
  type TTagFieldKey,
} from '../../../common/library/tagFields';
import { useTranslation } from '../../utils/I18nContext';
import { LibraryTagInput, PutBackGlyph } from './LibraryTagField';
import { FIELD_LABEL_KEYS } from './tagLabels';
import { fieldValues, SHARED_FIELDS, type ISetState } from './tagSetModel';

interface ISharedFieldProps {
  fieldKey: TTagFieldKey;
  sheets: readonly ITrackTagSheet[];
  state: ISetState;
  onShared: (key: TTagFieldKey, value: string | undefined) => void;
  /** A value to offer in one press where the field is empty for every song:
   * the album artist from what most of the songs' artist says. */
  suggestion?: string;
}

const ChevronGlyph = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true" fill="none">
    <path d="m4 6 4 4 4-4" />
  </svg>
);

/**
 * One shared field. Where the songs agree it holds their value; where they
 * do not it says Mixed and offers the values with how many songs hold each
 * — picking one is the fix for two spellings of a band in one click. Typed
 * or picked, the value goes to every song ("→ all 19") until put back.
 */
const SharedField = ({
  fieldKey,
  sheets,
  state,
  onShared,
  suggestion,
}: ISharedFieldProps) => {
  const { t } = useTranslation();
  const id = useId();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const values = fieldValues(sheets, fieldKey);
  const isMixed = values.length > 1;
  const typed = state.shared[fieldKey];
  const isEdited = typed !== undefined;
  const value = typed ?? (isMixed ? '' : (values[0]?.value ?? ''));

  // Closes on a press elsewhere and on Escape, as the Library's menus do.
  useEffect(() => {
    if (!isMenuOpen) {
      return undefined;
    }
    const onDown = (event: MouseEvent) => {
      if (!rowRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [isMenuOpen]);

  const label = t(FIELD_LABEL_KEYS[fieldKey]);
  return (
    <div
      ref={rowRef}
      className={`library-tags__row is-shared${isEdited ? ' is-edited' : ''}`}
    >
      <label className="library-tags__label" htmlFor={id}>
        {label}
      </label>
      <div className="library-tags__suggest">
        <LibraryTagInput
          id={id}
          value={value}
          isEdited={isEdited}
          isMultiline={false}
          placeholder={isMixed && !isEdited ? t('library.tags.set.mixed') : '—'}
          isInvalid={isEdited && cleanTagValue(fieldKey, value) === undefined}
          onChange={(next) => onShared(fieldKey, next)}
          onPutBack={() => onShared(fieldKey, undefined)}
          trail={
            <>
              {isEdited && (
                <span className="library-tags__chip is-accent library-tags__all">
                  {t('library.tags.set.toAll', { count: sheets.length })}
                </span>
              )}
              {!isMixed && !isEdited && value === '' && suggestion && (
                <button
                  type="button"
                  className="library-tags__values"
                  onClick={() => onShared(fieldKey, suggestion)}
                >
                  {t('library.tags.set.use', { value: suggestion })}
                </button>
              )}
              {isMixed && !isEdited && (
                <button
                  type="button"
                  className="library-tags__values"
                  aria-haspopup="listbox"
                  aria-expanded={isMenuOpen}
                  onClick={() => setIsMenuOpen((open) => !open)}
                >
                  {t('library.tags.set.values', { count: values.length })}
                  <ChevronGlyph />
                </button>
              )}
            </>
          }
        />
        {isMenuOpen && (
          <div className="library-tags__suggestions is-values" role="listbox">
            <p className="library-tags__suggestions-label">
              {t('library.tags.set.pickFor', {
                field: label,
                count: sheets.length,
              })}
            </p>
            {values.map((entry) => (
              <button
                key={entry.value}
                type="button"
                role="option"
                aria-selected={false}
                className="library-tags__suggestion"
                onClick={() => {
                  onShared(fieldKey, entry.value);
                  setIsMenuOpen(false);
                }}
              >
                <span className={entry.value === '' ? 'is-empty' : undefined}>
                  {entry.value === ''
                    ? t('library.tags.set.empty')
                    : entry.value}
                </span>
                <span className="library-tags__suggestion-count">
                  {entry.count === 1
                    ? t('library.trackCountOne')
                    : t('library.trackCount', { count: entry.count })}
                </span>
              </button>
            ))}
            <div className="library-tags__suggestions-rule" role="none" />
            <button
              type="button"
              className="library-tags__suggestion"
              onClick={() => {
                onShared(fieldKey, undefined);
                setIsMenuOpen(false);
              }}
            >
              <PutBackGlyph />
              <span>{t('library.tags.set.keepEach')}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

interface ILibraryTagSharedFieldsProps {
  sheets: readonly ITrackTagSheet[];
  state: ISetState;
  onShared: (key: TTagFieldKey, value: string | undefined) => void;
  onVersion: (version: ISetState['version']) => void;
}

/** The shared fields in two columns, then the tag version for all. */
const LibraryTagSharedFields = ({
  sheets,
  state,
  onShared,
  onVersion,
}: ILibraryTagSharedFieldsProps) => {
  const { t } = useTranslation();
  const id3 = sheets.filter((sheet) => sheet.canChooseId3v2Version);
  // What most of the songs' artist says, when more than half agree on it.
  const [topArtist] = fieldValues(sheets, 'artist');
  const majorityArtist =
    topArtist && topArtist.value !== '' && topArtist.count * 2 > sheets.length
      ? topArtist.value
      : undefined;
  const counts = {
    v3: id3.filter((sheet) => sheet.tagsInFile.includes('ID3v2.3')).length,
    v4: id3.filter((sheet) => sheet.tagsInFile.includes('ID3v2.4')).length,
  };
  const choices: Array<[ISetState['version'], string]> = [
    ['keep', t('library.tags.set.versionKeep')],
    [3, t('library.tags.set.versionAll23')],
    [4, t('library.tags.set.versionAll24')],
  ];
  return (
    <div className="library-tags-set__fields">
      {SHARED_FIELDS.map((key) => (
        <SharedField
          key={key}
          fieldKey={key}
          sheets={sheets}
          state={state}
          onShared={onShared}
          suggestion={key === 'albumArtist' ? majorityArtist : undefined}
        />
      ))}
      {id3.length > 0 && (
        <div className="library-tags__row is-wide">
          <span className="library-tags__label">
            {t('library.tags.set.version')}
          </span>
          <div className="library-tags__pair is-wrapping">
            <span
              className="segmented library-tags__segmented"
              role="radiogroup"
            >
              {choices.map(([choice, label]) => (
                <button
                  key={String(choice)}
                  type="button"
                  role="radio"
                  aria-checked={state.version === choice}
                  className={`segmented__option${state.version === choice ? ' is-selected' : ''}`}
                  onClick={() => onVersion(choice)}
                >
                  {label}
                </button>
              ))}
            </span>
            <span className="library-tags__of">
              {t('library.tags.set.versionCounts', {
                v3: counts.v3,
                v4: counts.v4,
                none: id3.length - counts.v3 - counts.v4,
              })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default LibraryTagSharedFields;
