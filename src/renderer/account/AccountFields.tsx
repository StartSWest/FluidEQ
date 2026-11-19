/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState, type ReactNode, type RefObject } from 'react';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import type useAccountValidation from './useAccountValidation';

type TValidation = ReturnType<typeof useAccountValidation>;

interface IFieldProps {
  /** The form's `useId`, which every id here is built from. */
  ids: string;
  validation: TValidation;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  /** The quiet words beside the label: the privacy note, the length. */
  hint?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
}

/**
 * The address, with the mail mark inside its box (Ivan, 2026-11-19: the
 * forms read plain and default; a field now says what it is before it is
 * read).
 */
export function EmailField({
  ids,
  validation,
  value,
  onChange,
  disabled,
  hint,
  inputRef,
}: IFieldProps) {
  const { t } = useTranslation();
  const field = validation.field('email');
  return (
    <label className="account-field" htmlFor={`${ids}-email`}>
      <span className="account-field__label" id={`${ids}-email-label`}>
        <span>
          {t('account.field.email')}
          {hint && <span className="account-field__hint">{hint}</span>}
        </span>
      </span>
      <span className="account-input">
        <Glyph name="mail" className="account-input__mark" />
        <input
          ref={inputRef}
          id={`${ids}-email`}
          aria-labelledby={field['aria-labelledby']}
          aria-invalid={field['aria-invalid']}
          aria-describedby={field['aria-describedby']}
          onBlur={field.onBlur}
          type="email"
          autoComplete="email"
          inputMode="email"
          spellCheck={false}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      </span>
      {validation.message('email')}
    </label>
  );
}

/**
 * The password, with the lock inside its box and a button at its end that
 * shows what was typed and hides it again — the one way to check a new
 * password nobody has to type twice.
 */
export function PasswordField({
  ids,
  validation,
  value,
  onChange,
  disabled,
  hint,
  aside,
  inputRef,
  autoComplete,
  minLength,
}: IFieldProps & {
  autoComplete: 'current-password' | 'new-password';
  minLength: number;
  /** At the label's other end: "Forgot your password?". */
  aside?: ReactNode;
}) {
  const { t } = useTranslation();
  const [shown, setShown] = useState(false);
  const field = validation.field('password');
  return (
    <div className="account-field">
      <span className="account-field__label">
        <label id={`${ids}-password-label`} htmlFor={`${ids}-password`}>
          {t('account.field.password')}
          {hint && <span className="account-field__hint">{hint}</span>}
        </label>
        {aside}
      </span>
      <span className="account-input">
        <Glyph name="lock" className="account-input__mark" />
        <input
          ref={inputRef}
          id={`${ids}-password`}
          aria-labelledby={field['aria-labelledby']}
          aria-invalid={field['aria-invalid']}
          aria-describedby={field['aria-describedby']}
          onBlur={field.onBlur}
          type={shown ? 'text' : 'password'}
          autoComplete={autoComplete}
          spellCheck={false}
          value={value}
          disabled={disabled}
          minLength={minLength}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className="account-input__reveal"
          aria-label={
            shown
              ? t('account.field.hidePassword')
              : t('account.field.showPassword')
          }
          aria-pressed={shown}
          aria-controls={`${ids}-password`}
          title={
            shown
              ? t('account.field.hidePassword')
              : t('account.field.showPassword')
          }
          disabled={disabled}
          onClick={() => setShown((now) => !now)}
        >
          <Glyph name={shown ? 'eye-off' : 'eye'} />
        </button>
      </span>
      {validation.message('password')}
    </div>
  );
}

/**
 * A failure the whole form is about — the service refused, the network is
 * down, the password was wrong — on a tinted panel at the head of the form
 * with the alert mark, where it used to be a line of amber text under it.
 */
export function FormAlert({ children }: { children: ReactNode }) {
  return (
    <p className="account-alert" role="alert">
      <Glyph name="alert" />
      <span>{children}</span>
    </p>
  );
}
