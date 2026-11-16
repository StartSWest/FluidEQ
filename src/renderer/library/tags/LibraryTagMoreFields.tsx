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

import { useId, useState } from 'react';
import Switch from '../../widgets/Switch';
import {
  cleanTagValue,
  type ITrackTagSheet,
  MAX_EXTRA_CODE,
  TAG_MORE_FIELDS,
  type TTagFieldKey,
} from '../../../common/library/tagFields';
import { useTranslation } from '../../utils/I18nContext';
import LibraryTagField, { LibraryTagInput } from './LibraryTagField';
import { FIELD_LABEL_KEYS } from './tagLabels';
import type { ITagDraft } from './tagDrafts';

interface ILibraryTagMoreFieldsProps {
  sheet: ITrackTagSheet;
  draft: ITagDraft | undefined;
  onField: (key: TTagFieldKey, value: string) => void;
  onExtra: (code: string, value: string) => void;
}

/**
 * Codes a format can hold as text, asked of the window before main refuses
 * them: the same patterns main's `isWritableExtraCode` checks, kept loose
 * here (main is the gate) and strict where a typo is easy to make.
 */
const looksWritable = (sheet: ITrackTagSheet, code: string): boolean => {
  if (code.length === 0 || code.length > MAX_EXTRA_CODE) {
    return false;
  }
  if (Object.values(sheet.codes).includes(code)) {
    return false;
  }
  switch (sheet.format) {
    case 'mp3':
    case 'aac':
    case 'wav':
    case 'aiff':
      return (
        /^(T[A-Z0-9]{3}|TXXX:[\x20-\x7e]{1,80})$/.test(code) && code !== 'TXXX'
      );
    case 'm4a':
      return /^----:[A-Za-z0-9 _.-]{1,64}$/.test(code);
    case 'wma':
      return /^[\x20-\x7e]{1,64}$/.test(code);
    default:
      return /^[\x20-\x3c\x3e-\x7d]{1,64}$/.test(code);
  }
};

/**
 * "More fields": every other field the editor names, each with its code in
 * this file's format; then every raw field the file carries by its code;
 * then a code of the reader's own. Closed until asked — most songs need
 * none of it.
 */
const LibraryTagMoreFields = ({
  sheet,
  draft,
  onField,
  onExtra,
}: ILibraryTagMoreFieldsProps) => {
  const { t } = useTranslation();
  const listId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newValue, setNewValue] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const present = TAG_MORE_FIELDS.filter(
    (key) => sheet.fields[key] !== undefined,
  ).length;
  const shownCount = present + sheet.extras.length;
  // Extras typed in this session that the file did not have yet.
  const added = Object.keys(draft?.extras ?? {}).filter(
    (code) => !sheet.extras.some((extra) => extra.code === code),
  );

  const fieldValue = (key: TTagFieldKey) =>
    draft?.fields[key] ?? sheet.fields[key] ?? '';
  const extraValue = (code: string) =>
    draft?.extras[code] ??
    sheet.extras.find((extra) => extra.code === code)?.value ??
    '';
  const codeIsBad = newCode !== '' && !looksWritable(sheet, newCode.trim());

  return (
    <div className="library-tags__more">
      <button
        type="button"
        className="library-tags__disclose"
        aria-expanded={isOpen}
        aria-controls={listId}
        onClick={() => setIsOpen((open) => !open)}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" fill="none">
          <path d="m6 3.5 4.5 4.5L6 12.5" />
        </svg>
        <span>{t('library.tags.more.toggle')}</span>
        <span className="library-tags__disclose-count">
          {shownCount > 0
            ? t('library.tags.more.count', { count: shownCount })
            : t('library.tags.more.countNone')}
        </span>
      </button>
      {isOpen && (
        <div id={listId} className="library-tags__more-list">
          {TAG_MORE_FIELDS.map((key) =>
            key === 'compilation' ? (
              <div key={key} className="library-tags__row">
                <span className="library-tags__label">
                  {t(FIELD_LABEL_KEYS[key])}
                </span>
                <div className="library-tags__pair">
                  <Switch
                    id={`${listId}-compilation`}
                    isOn={fieldValue(key) === '1'}
                    isDisabled={false}
                    ariaLabel={t(FIELD_LABEL_KEYS[key])}
                    handleToggle={() =>
                      onField(key, fieldValue(key) === '1' ? '' : '1')
                    }
                  />
                  <span className="library-tags__code is-end">
                    {sheet.codes[key]}
                  </span>
                </div>
              </div>
            ) : (
              <LibraryTagField
                key={key}
                label={t(FIELD_LABEL_KEYS[key])}
                value={fieldValue(key)}
                placeholder="—"
                code={sheet.codes[key]}
                isEdited={draft?.fields[key] !== undefined}
                isInvalid={cleanTagValue(key, fieldValue(key)) === undefined}
                onChange={(value) => onField(key, value)}
                onPutBack={() => onField(key, sheet.fields[key] ?? '')}
              />
            ),
          )}
          {[...sheet.extras.map((extra) => extra.code), ...added].map(
            (code) => (
              <LibraryTagField
                key={code}
                label={code.replace(/^(TXXX|APE|----):/, '')}
                value={extraValue(code)}
                placeholder="—"
                code={code.includes(':') ? code.split(':')[0] : code}
                isEdited={draft?.extras[code] !== undefined}
                onChange={(value) => onExtra(code, value)}
                onPutBack={() =>
                  onExtra(
                    code,
                    sheet.extras.find((extra) => extra.code === code)?.value ??
                      '',
                  )
                }
              />
            ),
          )}
          {isAdding ? (
            <div className="library-tags__add">
              <div className="library-tags__add-row">
                <LibraryTagInput
                  value={newCode}
                  onChange={setNewCode}
                  isEdited={false}
                  placeholder={t('library.tags.more.code')}
                  ariaLabel={t('library.tags.more.code')}
                  isInvalid={codeIsBad}
                />
                <LibraryTagInput
                  value={newValue}
                  onChange={setNewValue}
                  isEdited={false}
                  placeholder={t('library.tags.more.value')}
                  ariaLabel={t('library.tags.more.value')}
                />
                <button
                  type="button"
                  className="button small"
                  disabled={
                    newCode.trim() === '' || codeIsBad || newValue === ''
                  }
                  onClick={() => {
                    onExtra(newCode.trim(), newValue);
                    setNewCode('');
                    setNewValue('');
                    setIsAdding(false);
                  }}
                >
                  {t('library.tags.more.addConfirm')}
                </button>
              </div>
              {codeIsBad && (
                <p className="library-tags__note is-warning">
                  {t('library.tags.more.badCode')}
                </p>
              )}
            </div>
          ) : (
            <div className="library-tags__add">
              <button
                type="button"
                className="button small subtle"
                onClick={() => setIsAdding(true)}
              >
                {t('library.tags.more.add')}
              </button>
              <span className="library-tags__note">
                {t('library.tags.more.addHint')}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LibraryTagMoreFields;
