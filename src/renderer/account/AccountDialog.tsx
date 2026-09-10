import { useEffect, useRef } from 'react';
import type { TAuthFailure } from 'main/account/authClient';
import type { TranslationKey } from 'common/i18n/en';
import { useTranslation } from '../utils/I18nContext';
import DialogHeader from '../components/DialogHeader';
import Glyph from '../community/Glyph';
import { identityStyle } from '../community/identity';
import { useLeaderboard } from '../usage/leaderboardStore';
import { signOutAccount, useAccount } from './accountStore';
import { useEntitlement } from './entitlementStore';
import PlusCard from './PlusCard';
import LeaderboardCard from './LeaderboardCard';
import SignInForms from './SignInForms';
import initialsOf from './initials';
import '../styles/Account.scss';

interface IAccountDialogProps {
  onClose: () => void;
}

/**
 * Exhaustive by type: a new failure does not compile until it has a sentence.
 *
 * The same shape `ProcessesDialog` uses for its role names, and for the same
 * reason — a template key built from the value would be a string the key type
 * cannot check, and the first failure added without a translation would render
 * its own key in all ten languages with nothing failing anywhere.
 */
const ERROR_KEYS: Record<TAuthFailure, TranslationKey> = {
  network: 'account.error.network',
  rejected: 'account.error.rejected',
  expired: 'account.error.expired',
  malformed: 'account.error.malformed',
  wrong_credentials: 'account.error.wrongCredentials',
  unconfirmed: 'account.error.unconfirmed',
  weak_password: 'account.error.weakPassword',
  bad_code: 'account.error.badCode',
  rate_limited: 'account.error.rateLimited',
  invalid_email: 'account.error.invalidEmail',
  already_registered: 'account.error.alreadyRegistered',
};

/**
 * The optional account.
 *
 * A dialog rather than a workspace tab on purpose. The tab strip was
 * deliberately cut from eight to six and its own comment puts the budget at
 * four short words; this is somewhere you go once and leave, which is what the
 * Support, About and Processes panels already are.
 *
 * Signed in, the panel is the person first: a band with their initials in
 * their own colour, their name, and what they are here — Plus, on the board —
 * with the two cards side by side under it. Signed out, the pitch stands
 * beside the form rather than above it, so the reason to sign in and the way
 * to do it are on screen together. The sentence that says signing in is
 * optional is on both: this app has promised since its first release that it
 * is local and account-free, and that is still true for anybody who closes
 * this without typing anything.
 */
export default function AccountDialog({ onClose }: IAccountDialogProps) {
  const { t } = useTranslation();
  const closeRef = useRef<HTMLButtonElement>(null);
  const account = useAccount();
  const entitlement = useEntitlement();
  const { status: board } = useLeaderboard();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const { identity, status } = account;
  const signedIn = status === 'signed-in' && identity !== undefined;
  const displayName = identity?.name ?? identity?.email ?? '';

  // The forms take the caret themselves; the close button gets it only when
  // there is nothing to type into.
  useEffect(() => {
    if (signedIn || status === 'unavailable') {
      closeRef.current?.focus();
    }
  }, [signedIn, status]);

  const errorLine = account.error && (
    <p className="account__error" role="alert">
      {t(ERROR_KEYS[account.error])}
    </p>
  );

  return (
    <div
      className="about-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="about account"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-title"
      >
        <DialogHeader
          eyebrow={t('account.eyebrow')}
          title={t('account.title')}
          titleId="account-title"
          closeLabel={t('account.close')}
          onClose={onClose}
          closeRef={closeRef}
        />

        <div className="about__body account__body">
          {signedIn && (
            <>
              <section
                className="account__hero"
                style={identityStyle(identity.email ?? identity.id)}
              >
                <span className="account__avatar" aria-hidden="true">
                  {initialsOf(identity.name, identity.email)}
                </span>
                <div className="account__who">
                  <span className="account__name">{displayName}</span>
                  {identity.email && identity.email !== displayName && (
                    <span className="account__email">{identity.email}</span>
                  )}
                  <div className="account__chips">
                    {entitlement.state === 'active' && (
                      <span className="account__chip account__chip--plus">
                        {t('account.plus.eyebrow')}
                      </span>
                    )}
                    {entitlement.state === 'grace' && (
                      <span className="account__chip account__chip--grace">
                        {t('account.plus.eyebrow')}
                      </span>
                    )}
                    {board.optedIn && (
                      <span className="account__chip">
                        <Glyph name="board" />
                        {t('leaderboard.card.title')}
                      </span>
                    )}
                  </div>
                </div>
                {/* The quiet style: signing out is not what anybody opened
                    this panel to be encouraged into. */}
                <button
                  type="button"
                  className="button small subtle account__sign-out"
                  onClick={() => {
                    signOutAccount().catch(() => undefined);
                  }}
                >
                  {t('account.signOut')}
                </button>
              </section>

              {errorLine}

              <div className="account__cards">
                <PlusCard entitlement={entitlement} />
                <LeaderboardCard />
              </div>

              <p className="account__optional account__optional--foot">
                {t('account.optional')}
              </p>
            </>
          )}

          {status === 'unavailable' && (
            <>
              <div className="account__notice">
                <span className="account__notice-title">
                  {t('account.unavailable')}
                </span>
                <span>{t('account.unavailableHint')}</span>
              </div>
              <p className="account__optional">{t('account.optional')}</p>
            </>
          )}

          {!signedIn && status !== 'unavailable' && (
            <div className="account__split">
              <aside className="account__pitch">
                <p className="account__optional">{t('account.optional')}</p>
                <ul className="account__perks">
                  <li>
                    <span className="account__perk-mark" aria-hidden="true">
                      <Glyph name="looks" />
                    </span>
                    {t('account.perk.looks')}
                  </li>
                  <li>
                    <span className="account__perk-mark" aria-hidden="true">
                      <Glyph name="general" />
                    </span>
                    {t('account.perk.community')}
                  </li>
                  <li>
                    <span className="account__perk-mark" aria-hidden="true">
                      <Glyph name="board" />
                    </span>
                    {t('account.perk.board')}
                  </li>
                </ul>
              </aside>
              <div className="account__form-column">
                <SignInForms account={account} />
                {errorLine}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
