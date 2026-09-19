import { useEffect, useRef, useState } from 'react';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import { signOutAccount } from './accountStore';
import '../styles/SignOutConfirm.scss';

interface ISignOutConfirmProps {
  /** A membership is what signing out locks, so the card says so. */
  member: boolean;
  onCancel: () => void;
}

/**
 * Signing out, asked first — in place of the links under the name, so the
 * answer is where the question was asked rather than in a dialog over the
 * panel.
 *
 * It was one line: the question and two underlined words after it, which
 * read as a sentence rather than as a question waiting for an answer (Ivan,
 * 2026-09-19). Now the question, what it costs, and the two answers as the
 * app's own buttons. The red one is the answer being given — whoever pressed
 * "Sign out" chose it — and the caret starts on the other, so an Enter
 * pressed out of habit keeps the account.
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
    // Signed out, the panel becomes the sign-in page and this card is gone
    // with the profile; only a request that failed leaves it here, to be
    // answered again.
    signOutAccount().catch(() => setLeaving(false));
  };

  return (
    <div
      className="sign-out-confirm"
      role="alertdialog"
      aria-labelledby="sign-out-confirm-title"
      aria-describedby="sign-out-confirm-detail"
    >
      <div className="sign-out-confirm__main">
        <span className="sign-out-confirm__mark" aria-hidden="true">
          <Glyph name="sign-out" />
        </span>
        <span id="sign-out-confirm-title" className="sign-out-confirm__title">
          {t('account.signOut.confirm')}
        </span>
        {/* What it costs, then what it keeps: two lines rather than one
            sentence joined by "and", which each language then broke
            wherever its width ran out — English between "sign back" and
            "in". */}
        <span id="sign-out-confirm-detail" className="sign-out-confirm__detail">
          <span>
            {t(
              member ? 'account.signOut.detailPlus' : 'account.signOut.detail',
            )}
          </span>
          <span>{t('account.signOut.kept')}</span>
        </span>
      </div>
      <div className="sign-out-confirm__answers">
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
          <Glyph name="sign-out" />
          {t('account.signOut')}
        </button>
      </div>
    </div>
  );
}
