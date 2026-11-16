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

import { type ReactNode, useId } from 'react';
import { useTranslation } from '../../utils/I18nContext';

export const PutBackGlyph = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true" fill="none">
    <path d="M6 9.5 2.8 6.3 6 3.1" />
    <path d="M3 6.3h6.5a3.7 3.7 0 0 1 0 7.4H7.4" />
  </svg>
);

interface ILibraryTagInputProps {
  value: string;
  onChange: (value: string) => void;
  isEdited: boolean;
  onPutBack?: () => void;
  placeholder?: string;
  /** The format's own name for the field, at the box's right end. */
  code?: string;
  isInvalid?: boolean;
  isNumber?: boolean;
  isMultiline?: boolean;
  ariaLabel?: string;
  id?: string;
  /** Content inside the box after the text: a values chip, a suggestion. */
  trail?: ReactNode;
  onFocus?: () => void;
  onBlur?: () => void;
}

/**
 * The quiet box a tag is typed into (the Library search's face), with the
 * put-back arrow while it holds an edit and the format's code at its end.
 */
export const LibraryTagInput = ({
  value,
  onChange,
  isEdited,
  onPutBack,
  placeholder,
  code,
  isInvalid = false,
  isNumber = false,
  isMultiline = false,
  ariaLabel,
  id,
  trail,
  onFocus,
  onBlur,
}: ILibraryTagInputProps) => {
  const { t } = useTranslation();
  return (
    <div
      className={`library-tags__box${isMultiline ? ' is-multiline' : ''}${
        isInvalid ? ' is-invalid' : ''
      }`}
    >
      {isMultiline ? (
        <textarea
          id={id}
          value={value}
          rows={2}
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-invalid={isInvalid}
          spellCheck={false}
          onChange={(event) => onChange(event.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
        />
      ) : (
        <input
          id={id}
          value={value}
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-invalid={isInvalid}
          inputMode={isNumber ? 'numeric' : undefined}
          spellCheck={false}
          autoComplete="off"
          onChange={(event) => onChange(event.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
        />
      )}
      {trail}
      {code !== undefined && <span className="library-tags__code">{code}</span>}
      {isEdited && onPutBack && (
        <button
          type="button"
          className="library-tags__put-back"
          title={t('library.tags.putBack')}
          aria-label={t('library.tags.putBack')}
          onClick={onPutBack}
        >
          <PutBackGlyph />
        </button>
      )}
    </div>
  );
};

interface ILibraryTagFieldProps extends Omit<
  ILibraryTagInputProps,
  'id' | 'ariaLabel'
> {
  label: string;
  /** Number pairs and other compound controls in place of the one box. */
  children?: ReactNode;
}

/** A labelled row of the panel: the name, a dot while it holds an edit, and
 * its box. */
const LibraryTagField = ({
  label,
  children,
  isEdited,
  isMultiline,
  ...input
}: ILibraryTagFieldProps) => {
  const id = useId();
  return (
    <div
      className={`library-tags__row${isEdited ? ' is-edited' : ''}${
        isMultiline ? ' is-top' : ''
      }`}
    >
      <label className="library-tags__label" htmlFor={id}>
        {label}
      </label>
      {children ?? (
        <LibraryTagInput
          id={id}
          isEdited={isEdited}
          isMultiline={isMultiline}
          value={input.value}
          onChange={input.onChange}
          onPutBack={input.onPutBack}
          placeholder={input.placeholder}
          code={input.code}
          isInvalid={input.isInvalid}
          isNumber={input.isNumber}
          trail={input.trail}
          onFocus={input.onFocus}
          onBlur={input.onBlur}
        />
      )}
    </div>
  );
};

export default LibraryTagField;
