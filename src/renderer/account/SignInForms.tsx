import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import type { IAccountState } from 'main/account/session';
import { MIN_PASSWORD_LENGTH } from 'common/accountRules';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import '../styles/AccountForms.scss';
import useAccountValidation from './useAccountValidation';
import CodeBoxes from './CodeBoxes';
import GoogleSignIn from './GoogleSignIn';
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
  /** Told when a tab is pressed, so the rail beside the form follows it. */
  onModeChange?: (mode: 'signIn' | 'signUp') => void;
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
  onModeChange,
}: ISignInFormsProps) {
  const { t } = useTranslation();
  const ids = useId();
  const [mode, setMode] = useState<TFormMode>(initialMode);
  useEffect(() => setMode(initialMode), [initialMode]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  // The password in clear while the eye is pressed: typed on a laptop in
  // company, hidden is the right default, and a mistyped one is found by
  // looking rather than by a failed attempt.
  const [shown, setShown] = useState(false);
  const firstField = useRef<HTMLInputElement>(null);

  const [sending, setSending] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  const busy = account.status === 'busy' || sending;
  // While Google's page is open in the browser the form waits, disabled, but
  // its button is not what is working: "One moment…" under "Finish signing in
  // with Google in your browser" read as the email form sending something.
  const working = busy && account.waiting !== 'google';
  const { pending } = account;
  const step = pending?.purpose ?? mode;
  const validation = useAccountValidation(ids, step, {
    email,
    password,
    name: '',
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
    setShown(false);
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
    <div className="account-field">
      <label
        className="account-field__label"
        id={`${ids}-email-label`}
        htmlFor={`${ids}-email`}
      >
        {t('account.field.email')}
        {options.note && (
          <span className="account-field__hint">
            {t('account.field.emailHint')}
          </span>
        )}
      </label>
      <span className="account-field__box">
        <Glyph name="mail" />
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
      </span>
      {validation.message('email')}
    </div>
  );

  /**
   * The way back into an account stands beside the password it is for, on
   * the label's line, where somebody stuck on that field looks for it.
   */
  const passwordField = (
    autoComplete: 'current-password' | 'new-password',
    forgot?: ReactNode,
  ) => (
    <div className="account-field">
      <span className="account-field__head">
        <label
          className="account-field__label"
          id={`${ids}-password-label`}
          htmlFor={`${ids}-password`}
        >
          {t('account.field.password')}
          {autoComplete === 'new-password' && (
            <span className="account-field__hint">
              {t('account.field.passwordHint', { count: MIN_PASSWORD_LENGTH })}
            </span>
          )}
        </label>
        {forgot}
      </span>
      <span className="account-field__box">
        <Glyph name="lock" />
        <input
          id={`${ids}-password`}
          aria-labelledby={validation.field('password')['aria-labelledby']}
          aria-invalid={validation.field('password')['aria-invalid']}
          aria-describedby={validation.field('password')['aria-describedby']}
          onBlur={validation.field('password').onBlur}
          type={shown ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={password}
          disabled={busy}
          minLength={autoComplete === 'new-password' ? MIN_PASSWORD_LENGTH : 1}
          onChange={(event) => setPassword(event.target.value)}
        />
        <button
          type="button"
          className="account-field__reveal"
          aria-label={t(
            shown ? 'account.password.hide' : 'account.password.show',
          )}
          aria-pressed={shown}
          aria-controls={`${ids}-password`}
          disabled={busy}
          onClick={() => setShown((now) => !now)}
        >
          <Glyph name={shown ? 'eye-off' : 'eye'} />
        </button>
      </span>
      {validation.message('password')}
    </div>
  );

  // Email is the quiet way in beside Google's until both its fields hold
  // something: then it is what the person is doing, and it wears the loud
  // style (Ivan, 2026-11-19: "A, galería" — the grey button read as off).
  const filled = email.trim() !== '' && password !== '';
  const emailSubmit = (label: string) => (
    <button
      type="submit"
      className={`button account-form__submit${filled ? '' : ' subtle'}`}
      disabled={busy}
    >
      {working ? t('account.working') : label}
      {!working && <Glyph name="next" />}
    </button>
  );

  const codeField = (
    <>
      <CodeBoxes
        id={`${ids}-code`}
        labelId={`${ids}-code-label`}
        label={t('account.field.code')}
        value={code}
        disabled={busy}
        inputRef={firstField}
        invalid={validation.field('code')['aria-invalid']}
        describedBy={validation.field('code')['aria-describedby']}
        onBlur={validation.field('code').onBlur}
        onChange={setCode}
      />
      {validation.message('code')}
    </>
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
        <span className="account-form__step">{t('account.code.step')}</span>
        <h3 className="account-form__title">{t('account.code.title')}</h3>
        <p className="account-form__lead">
          {t('account.code.sent', { email: pending.email })}
        </p>
        {codeField}
        <button
          type="submit"
          className="button account-form__loud"
          disabled={busy}
        >
          {working ? t('account.working') : t('account.code.confirmEmail')}
        </button>
        <p className="account__hint">{t('account.code.hint')}</p>
        <div className="account-form__links">
          {resend}
          {abandon}
        </div>
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
        <button
          type="submit"
          className="button account-form__loud"
          disabled={busy}
        >
          {working ? t('account.working') : t('account.reset.submit')}
        </button>
        <div className="account-form__links">
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
        <h3 className="account-form__title">{t('account.forgot.link')}</h3>
        <p className="account-form__lead">{t('account.forgot.lead')}</p>
        {emailField()}
        <button
          type="submit"
          className="button account-form__loud"
          disabled={busy}
        >
          {working ? t('account.working') : t('account.forgot.submit')}
        </button>
        <div className="account-form__links">
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
      {(['signUp', 'signIn'] as const).map((option) => (
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
            onModeChange?.(option);
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
        <GoogleSignIn account={account} busy={busy} />
        {emailField({ note: true })}
        {passwordField('new-password')}
        {emailSubmit(t('account.signUp.withEmail'))}
        <p className="account__hint">{t('account.signUp.terms')}</p>
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
      <GoogleSignIn account={account} busy={busy} />
      {emailField()}
      {passwordField(
        'current-password',
        <button
          type="button"
          className="account-link account-form__forgot"
          disabled={busy}
          onClick={() => setMode('forgot')}
        >
          {t('account.forgot.link')}
        </button>,
      )}
      {emailSubmit(t('account.signIn.withEmail'))}
    </form>
  );
}
