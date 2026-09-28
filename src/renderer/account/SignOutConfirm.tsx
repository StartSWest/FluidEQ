import { useEffect, useRef, useState } from 'react';
import MenuIcon from '../icons/MenuIcon';
import CompactFrame from '../components/CompactFrame';
import { useTranslation } from '../utils/I18nContext';
import { signOutAccount } from './accountStore';
import '../styles/SignOutConfirm.scss';

interface ISignOutConfirmProps {
  /** A membership is what signing out locks, so the question says so. */
  member: boolean;
  onCancel: () => void;
}

/**
 * Signing out, asked first — inside the Account panel, at the top of the
 * profile, so the answer is given where the account is rather than in a
 * dialog over the panel.
 *
 * It was one line: the question and two underlined words after it, which
 * read as a sentence rather than as a question waiting for an answer (Ivan,
 * 2026-09-19). Now it is every confirmation's small frame, in the red that
 * says something ends: the question, what it costs, and the two answers. The
 * red one is the answer being given — whoever pressed "Sign out" chose it —
 * and the caret starts on the other, so an Enter pressed out of habit keeps
 * the account.
 */
export default function SignOutConfirm({
  member,
  onCancel,
}: ISignOutConfirmProps) {
  const { t } = useTranslation();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  // Escape takes the question back rather than closing the panel under it,
  // which is what the panel's own listener would do: caught on the way down,
  // before it reaches that listener, wherever the caret is in the panel.
  useEffect(() => {
    if (leaving) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCancel();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [leaving, onCancel]);

  const signOut = () => {
    if (leaving) {
      return;
    }
    setLeaving(true);
    // Signed out, the panel becomes the sign-in page and this question is
    // gone with the profile; only a request that failed leaves it here, to be
    // answered again.
    signOutAccount().catch(() => setLeaving(false));
  };

  return (
    // In the panel, not over it: the rest of the profile stays usable, so
    // it is not modal.
    <CompactFrame
      className="sign-out-confirm"
      icon={<MenuIcon name="logout" />}
      tone="danger"
      title={t('account.signOut.confirm')}
      titleId="sign-out-confirm-title"
      aria-modal={false}
      aria-describedby="sign-out-confirm-detail"
      actions={
        <>
          <button
            ref={cancelRef}
            type="button"
            className="button small subtle"
            disabled={leaving}
            onClick={onCancel}
          >
            {t('account.name.cancel')}
          </button>
          <button
            type="button"
            className={`button small danger${leaving ? ' is-running' : ''}`}
            aria-busy={leaving}
            onClick={signOut}
          >
            {t('account.signOut')}
          </button>
        </>
      }
    >
      {/* What it costs, then what it keeps: two lines rather than one
          sentence joined by "and", which each language then broke wherever
          its width ran out — English between "sign back" and "in". */}
      <p id="sign-out-confirm-detail" className="sign-out-confirm__detail">
        <span>
          {t(member ? 'account.signOut.detailPlus' : 'account.signOut.detail')}
        </span>
        <span>{t('account.signOut.kept')}</span>
      </p>
    </CompactFrame>
  );
}
