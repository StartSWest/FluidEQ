import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { IAccountState } from 'main/account/session';
import { CODE_LENGTH, MIN_PASSWORD_LENGTH } from 'common/accountRules';
import { useTranslation } from '../utils/I18nContext';
import '../styles/AccountForms.scss';
import useAccountValidation from './useAccountValidation';
import {
  abandonAccountPending,
  confirmAccountCode,
  forgotAccountPassword,
  resendAccountCode,
  resetAccountPassword,
  signInAccount,
  signUpAccount,
} from './accountStore';

interface ISignInFormsProps {
  account: IAccountState;
  initialMode?: 'signIn' | 'signUp';
}

/**
 * Which of the small forms is on screen while nobody is signed in.
 *
 * The two code steps are not chosen here — they follow from the main process
 * saying an address is waiting for its code, so the step survives the panel
 * being closed while the email is on its way. The other three are the panel's
 * own business.
 */
type TFormMode = 'signIn' | 'signUp' | 'forgot';

/**
 * Sign in, create an account, or get back into one.
 *
 * Every form has one loud button — the thing it exists to do — and quiet
 * links for changing course, so the eye lands on the right control without
 * reading. Validation explains each invalid field on blur or submit. A request
 * in flight disables the whole form and relabels the button, because a press
 * that shows nothing for a second reads as broken.
 *
 * A wrong code is the one failure that keeps the typed value: the person
 * will fix a digit, not retype six. Every other failure leaves the fields as
 * they were for the same reason.
 */
export default function SignInForms({
  account,
  initialMode = 'signIn',
}: ISignInFormsProps) {
  const { t } = useTranslation();
  const ids = useId();
  const [mode, setMode] = useState<TFormMode>(initialMode);
  useEffect(() => setMode(initialMode), [initialMode]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const firstField = useRef<HTMLInputElement>(null);

  const [sending, setSending] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  const busy = account.status === 'busy' || sending;
  const { pending } = account;
  const step = pending?.purpose ?? mode;
  const validation = useAccountValidation(ids, step, {
    email,
    password,
    name,
    code,
  });

  // Each new form gets the caret without a click, and a code step starts with
  // the code box empty: the digits from the last attempt belong to it alone.
  useEffect(() => {
    firstField.current?.focus();
    if (step === 'signup' || step === 'recovery') {
      setPassword('');
    }
    setCode('');
    setSent(false);
  }, [step]);

  // A failed resend — the server's one-a-minute limit, usually — gives the
  // link back, so the person is not stuck reading "sent again" over nothing.
  useEffect(() => {
    if (account.error) {
      setSent(false);
    }
  }, [account.error]);

  const submit = (event: FormEvent, run: () => Promise<void>) => {
    event.preventDefault();
    if (busy) {
      return;
    }
    if (!validation.validate()) {
      return;
    }
    setSending(true);
    setSendFailed(false);
    run()
      .catch(() => setSendFailed(true))
      .finally(() => setSending(false));
  };

  /**
   * The privacy note rides on the sign-up form only: that is where somebody
   * decides whether to hand the address over, and the promise — never shown to
   * anyone — is what the decision turns on. The handle is what the community
   * sees; the address stays between the person and the sign-in.
   */
  const emailField = (options: { first?: boolean; note?: boolean } = {}) => (
    <label className="account-field" htmlFor={`${ids}-email`}>
      <span className="account-field__label" id={`${ids}-email-label`}>
        {t('account.field.email')}
        {options.note && (
          <span className="account-field__hint">
            {t('account.field.emailHint')}
          </span>
        )}
      </span>
      <input
        ref={options.first === false ? undefined : firstField}
        id={`${ids}-email`}
        aria-labelledby={validation.field('email')['aria-labelledby']}
        aria-invalid={validation.field('email')['aria-invalid']}
        aria-describedby={validation.field('email')['aria-describedby']}
        onBlur={validation.field('email').onBlur}
        type="email"
        autoComplete="email"
        inputMode="email"
        spellCheck={false}
        value={email}
        disabled={busy}
        onChange={(event) => setEmail(event.target.value)}
      />
      {validation.message('email')}
    </label>
  );

  const passwordField = (autoComplete: 'current-password' | 'new-password') => (
    <label className="account-field" htmlFor={`${ids}-password`}>
      <span className="account-field__label" id={`${ids}-password-label`}>
        {t('account.field.password')}
        {autoComplete === 'new-password' && (
          <span className="account-field__hint">
            {t('account.field.passwordHint', { count: MIN_PASSWORD_LENGTH })}
          </span>
        )}
      </span>
      <input
        id={`${ids}-password`}
        aria-labelledby={validation.field('password')['aria-labelledby']}
        aria-invalid={validation.field('password')['aria-invalid']}
        aria-describedby={validation.field('password')['aria-describedby']}
        onBlur={validation.field('password').onBlur}
        type="password"
        autoComplete={autoComplete}
        value={password}
        disabled={busy}
        minLength={autoComplete === 'new-password' ? MIN_PASSWORD_LENGTH : 1}
        onChange={(event) => setPassword(event.target.value)}
      />
      {validation.message('password')}
    </label>
  );

  const codeField = (
    <label className="account-field" htmlFor={`${ids}-code`}>
      <span className="account-field__label" id={`${ids}-code-label`}>
        {t('account.field.code')}
      </span>
      <input
        ref={firstField}
        id={`${ids}-code`}
        aria-labelledby={validation.field('code')['aria-labelledby']}
        aria-invalid={validation.field('code')['aria-invalid']}
        aria-describedby={validation.field('code')['aria-describedby']}
        onBlur={validation.field('code').onBlur}
        className="account-field__code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={CODE_LENGTH}
        spellCheck={false}
        value={code}
        disabled={busy}
        onChange={(event) =>
          setCode(event.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))
        }
      />
      {validation.message('code')}
    </label>
  );

  const abandon = (
    <button
      type="button"
      className="account-link"
      disabled={busy}
      onClick={() => {
        abandonAccountPending().catch(() => undefined);
      }}
    >
      {t('account.code.otherEmail')}
    </button>
  );

  const resend = (
    <button
      type="button"
      className="account-link"
      disabled={busy || sent}
      onClick={() => {
        setSent(true);
        resendAccountCode().catch(() => undefined);
      }}
    >
      {sent ? t('account.code.sentAgain') : t('account.code.sendAgain')}
    </button>
  );

  if (pending?.purpose === 'signup') {
    return (
      <form
        className="account-form"
        noValidate
        onSubmit={(event) =>
          submit(event, () => confirmAccountCode(code.trim()))
        }
      >
        {sendFailed && (
          <p className="account__error" role="alert">
            {t('account.error.network')}
          </p>
        )}
        <p className="account-form__lead">
          {t('account.code.sent', { email: pending.email })}
        </p>
        {codeField}
        <div className="account__actions">
          <button type="submit" className="button small" disabled={busy}>
            {busy ? t('account.working') : t('account.code.confirm')}
          </button>
          {resend}
          {abandon}
        </div>
        <p className="account__hint">{t('account.code.hint')}</p>
      </form>
    );
  }

  if (pending?.purpose === 'recovery') {
    return (
      <form
        className="account-form"
        noValidate
        onSubmit={(event) =>
          submit(event, () =>
            resetAccountPassword({ code: code.trim(), password }),
          )
        }
      >
        {sendFailed && (
          <p className="account__error" role="alert">
            {t('account.error.network')}
          </p>
        )}
        <p className="account-form__lead">
          {t('account.reset.sent', { email: pending.email })}
        </p>
        {codeField}
        {passwordField('new-password')}
        <div className="account__actions">
          <button type="submit" className="button small" disabled={busy}>
            {busy ? t('account.working') : t('account.reset.submit')}
          </button>
          {resend}
          {abandon}
        </div>
      </form>
    );
  }

  if (mode === 'forgot') {
    return (
      <form
        className="account-form"
        noValidate
        onSubmit={(event) =>
          submit(event, () => forgotAccountPassword(email.trim()))
        }
      >
        {sendFailed && (
          <p className="account__error" role="alert">
            {t('account.error.network')}
          </p>
        )}
        <p className="account-form__lead">{t('account.forgot.lead')}</p>
        {emailField()}
        <div className="account__actions">
          <button type="submit" className="button small" disabled={busy}>
            {busy ? t('account.working') : t('account.forgot.submit')}
          </button>
          <button
            type="button"
            className="account-link"
            disabled={busy}
            onClick={() => setMode('signIn')}
          >
            {t('account.backToSignIn')}
          </button>
        </div>
      </form>
    );
  }

  const tabs = (
    <div className="account-form__tabs" role="tablist">
      {(['signIn', 'signUp'] as const).map((option) => (
        <button
          key={option}
          type="button"
          role="tab"
          aria-selected={mode === option}
          className={`account-form__tab${mode === option ? ' account-form__tab--on' : ''}`}
          disabled={busy}
          onClick={() => {
            validation.reset();
            setMode(option);
          }}
        >
          {option === 'signIn' ? t('account.signIn') : t('account.signUp')}
        </button>
      ))}
    </div>
  );

  if (mode === 'signUp') {
    return (
      <form
        className="account-form"
        noValidate
        onSubmit={(event) =>
          submit(event, () =>
            signUpAccount({
              email: email.trim(),
              password,
              name: name.trim() || undefined,
            }),
          )
        }
      >
        {sendFailed && (
          <p className="account__error" role="alert">
            {t('account.error.network')}
          </p>
        )}
        {tabs}
        <label className="account-field" htmlFor={`${ids}-name`}>
          <span className="account-field__label" id={`${ids}-name-label`}>
            {t('account.field.name')}
            <span className="account-field__hint">
              {t('account.field.optional')}
            </span>
          </span>
          <input
            ref={firstField}
            id={`${ids}-name`}
            aria-labelledby={validation.field('name')['aria-labelledby']}
            aria-invalid={validation.field('name')['aria-invalid']}
            aria-describedby={validation.field('name')['aria-describedby']}
            onBlur={validation.field('name').onBlur}
            type="text"
            autoComplete="nickname"
            maxLength={80}
            value={name}
            disabled={busy}
            onChange={(event) => setName(event.target.value)}
          />
          {validation.message('name')}
        </label>
        {emailField({ first: false, note: true })}
        {passwordField('new-password')}
        <div className="account__actions">
          <button type="submit" className="button small" disabled={busy}>
            {busy ? t('account.working') : t('account.signUp')}
          </button>
        </div>
        <p className="account__hint">{t('account.signUpHint')}</p>
      </form>
    );
  }

  return (
    <form
      className="account-form"
      noValidate
      onSubmit={(event) =>
        submit(event, () => signInAccount({ email: email.trim(), password }))
      }
    >
      {sendFailed && (
        <p className="account__error" role="alert">
          {t('account.error.network')}
        </p>
      )}
      {tabs}
      {emailField()}
      {passwordField('current-password')}
      <div className="account__actions">
        <button type="submit" className="button small" disabled={busy}>
          {busy ? t('account.working') : t('account.signIn')}
        </button>
        <button
          type="button"
          className="account-link"
          disabled={busy}
          onClick={() => setMode('forgot')}
        >
          {t('account.forgot.link')}
        </button>
      </div>
      <p className="account__hint">{t('account.signInHint')}</p>
    </form>
  );
}
