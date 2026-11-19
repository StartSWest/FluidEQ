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
import { EmailField, FormAlert, PasswordField } from './AccountFields';
import GoogleSignIn, {
  GoogleWaiting,
  useGoogleSignInAvailable,
} from './GoogleSignIn';
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
  /** The account service's last failure, at the head of the form. */
  notice?: ReactNode;
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
 * Every form has a heading — the two tabs where there is a choice, the step's
 * own title where there is not — one loud button, the thing it exists to do,
 * and quiet links for changing course, so the eye lands on the right control
 * without reading (Ivan, 2026-11-19: the forms read plain and default).
 * Validation explains each invalid field on blur or submit. A request in
 * flight disables the whole form and relabels the button, because a press
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
  notice,
}: ISignInFormsProps) {
  const { t } = useTranslation();
  const ids = useId();
  const googleOffered = useGoogleSignInAvailable();
  const [mode, setMode] = useState<TFormMode>(initialMode);
  useEffect(() => setMode(initialMode), [initialMode]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
  }, [step]);

  // A failed resend — the server's one-a-minute limit, usually — gives the
  // link back, so the person is not stuck reading "sent again" over nothing.
  useEffect(() => {
    if (account.error) {
      setSent(false);
    }
  }, [account.error]);

  // While Google's page is open in the browser, that is the whole form side:
  // nothing here is waiting on this window, so nothing here is shown greyed.
  if (account.waiting === 'google') {
    return <GoogleWaiting />;
  }

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

  const alerts = (
    <>
      {sendFailed && <FormAlert>{t('account.error.network')}</FormAlert>}
      {notice}
    </>
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

  const resend = sent ? (
    <span className="account-form__done" role="status">
      <Glyph name="check" />
      {t('account.code.sentAgain')}
    </span>
  ) : (
    <button
      type="button"
      className="account-link"
      disabled={busy}
      onClick={() => {
        setSent(true);
        resendAccountCode().catch(() => undefined);
      }}
    >
      {t('account.code.sendAgain')}
    </button>
  );

  const loud = (label: string) => (
    <button type="submit" className="button account-form__loud" disabled={busy}>
      {busy ? t('account.working') : label}
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
        <span className="account-form__step">{t('account.code.step')}</span>
        <h3 className="account-form__title">{t('account.code.title')}</h3>
        {alerts}
        <p className="account-form__lead">
          {t('account.code.sent', { email: pending.email })}
        </p>
        {codeField}
        {loud(t('account.code.confirmEmail'))}
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
        <h3 className="account-form__title">{t('account.reset.title')}</h3>
        {alerts}
        <p className="account-form__lead">
          {t('account.reset.sent', { email: pending.email })}
        </p>
        {codeField}
        <PasswordField
          ids={ids}
          validation={validation}
          disabled={busy}
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          hint={t('account.field.passwordHint', { count: MIN_PASSWORD_LENGTH })}
        />
        {loud(t('account.reset.submit'))}
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
        <button
          type="button"
          className="account-link account-form__back"
          disabled={busy}
          onClick={() => setMode('signIn')}
        >
          <Glyph name="previous" />
          {t('account.backToSignIn')}
        </button>
        <h3 className="account-form__title">{t('account.forgot.title')}</h3>
        {alerts}
        <p className="account-form__lead">{t('account.forgot.lead')}</p>
        <EmailField
          ids={ids}
          validation={validation}
          disabled={busy}
          value={email}
          onChange={setEmail}
          inputRef={firstField}
        />
        {loud(t('account.forgot.submit'))}
      </form>
    );
  }

  // The two ways in as the form's heading: the one on screen large, the
  // other beside it as the quiet way across. The open one comes first, so
  // the heading reads as what the form is.
  const other: 'signIn' | 'signUp' = mode === 'signUp' ? 'signIn' : 'signUp';
  const tabs = (
    <div className="account-form__tabs" role="tablist">
      {[mode, other].map((option) => (
        <button
          key={option}
          type="button"
          role="tab"
          aria-selected={mode === option}
          className={`account-form__tab${mode === option ? ' account-form__tab--on' : ''}`}
          disabled={busy}
          onClick={() => {
            if (option === mode) {
              return;
            }
            validation.reset();
            setMode(option);
            onModeChange?.(option);
          }}
        >
          {option === 'signUp' ? t('account.signUp') : t('account.signIn')}
        </button>
      ))}
    </div>
  );

  const creating = mode === 'signUp';
  // Email is the quiet way in under Google's button until both its fields
  // hold something — then it is what the person is doing, and it wears the
  // loud style (Ivan, 2026-11-19, picking the mockup that showed it: the grey
  // button read as switched off) — and the loud one where Google is not
  // offered: a form must always have one thing to press.
  const filled = email.trim() !== '' && password !== '';
  let emailButton = 'button account-form__loud';
  if (googleOffered) {
    emailButton = filled
      ? 'button account-form__quiet'
      : 'button subtle account-form__quiet';
  }

  return (
    <form
      className="account-form"
      noValidate
      onSubmit={(event) =>
        submit(event, () =>
          creating
            ? signUpAccount({ email: email.trim(), password })
            : signInAccount({ email: email.trim(), password }),
        )
      }
    >
      {tabs}
      {alerts}
      <GoogleSignIn available={googleOffered} busy={busy} />
      <EmailField
        ids={ids}
        validation={validation}
        disabled={busy}
        value={email}
        onChange={setEmail}
        inputRef={firstField}
        hint={creating ? t('account.field.emailHint') : undefined}
      />
      <PasswordField
        ids={ids}
        validation={validation}
        disabled={busy}
        value={password}
        onChange={setPassword}
        autoComplete={creating ? 'new-password' : 'current-password'}
        minLength={creating ? MIN_PASSWORD_LENGTH : 1}
        hint={
          creating
            ? t('account.field.passwordHint', { count: MIN_PASSWORD_LENGTH })
            : undefined
        }
        aside={
          creating ? undefined : (
            <button
              type="button"
              className="account-link account-form__forgot"
              disabled={busy}
              onClick={() => setMode('forgot')}
            >
              {t('account.forgot.link')}
            </button>
          )
        }
      />
      <button type="submit" className={emailButton} disabled={busy}>
        {busy
          ? t('account.working')
          : t(
              creating
                ? 'account.signUp.withEmail'
                : 'account.signIn.withEmail',
            )}
      </button>
      {creating && <p className="account__hint">{t('account.signUp.terms')}</p>}
    </form>
  );
}
