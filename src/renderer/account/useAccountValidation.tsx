import { useState } from 'react';
import {
  isCode,
  MAX_NAME_LENGTH,
  MIN_PASSWORD_LENGTH,
  validAccountEmail,
  validAccountPassword,
} from 'common/accountRules';
import type { TranslationKey } from 'common/i18n/en';
import { useTranslation } from '../utils/I18nContext';

type TField = 'email' | 'password' | 'name' | 'code';

export default function useAccountValidation(
  ids: string,
  step: string,
  values: Record<TField, string>,
) {
  const { t } = useTranslation();
  const [touched, setTouched] = useState<Partial<Record<TField, boolean>>>({});
  const creating = step === 'signUp' || step === 'recovery';
  const errors: Partial<Record<TField, TranslationKey>> = {};
  if (
    step !== 'signup' &&
    step !== 'recovery' &&
    !validAccountEmail(values.email)
  ) {
    errors.email = 'account.error.invalidEmail';
  }
  if (
    step !== 'forgot' &&
    step !== 'signup' &&
    !validAccountPassword(values.password, creating)
  ) {
    if (!values.password.length) {
      errors.password = 'account.validation.passwordRequired';
    } else if (creating && values.password.length < MIN_PASSWORD_LENGTH) {
      errors.password = 'account.validation.passwordShort';
    } else {
      errors.password = 'account.validation.passwordLong';
    }
  }
  if (step === 'signUp' && values.name.trim().length > MAX_NAME_LENGTH) {
    errors.name = 'account.validation.nameLong';
  }
  if (
    (step === 'signup' || step === 'recovery') &&
    !isCode(values.code.trim())
  ) {
    errors.code = 'account.validation.code';
  }

  const field = (name: TField) => ({
    'aria-labelledby': `${ids}-${name}-label`,
    'aria-invalid': Boolean(touched[name] && errors[name]),
    'aria-describedby':
      touched[name] && errors[name] ? `${ids}-${name}-error` : undefined,
    onBlur: () => setTouched((previous) => ({ ...previous, [name]: true })),
  });
  const message = (name: TField) => {
    const error = errors[name];
    return (
      <span
        className="account__error account-field__error"
        id={`${ids}-${name}-error`}
        aria-live="polite"
      >
        {touched[name] && error
          ? t(error, { count: MIN_PASSWORD_LENGTH })
          : null}
      </span>
    );
  };
  const validate = () => {
    setTouched({ email: true, password: true, name: true, code: true });
    return Object.keys(errors).length === 0;
  };
  return { field, message, validate, reset: () => setTouched({}) };
}
