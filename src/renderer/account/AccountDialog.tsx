import { useEffect, useRef, useState } from 'react';
import type { TAuthFailure } from 'main/account/authClient';
import type { TranslationKey } from 'common/i18n/en';
import { isCheckoutConfigured } from 'common/accountConfig';
import { PLUS_TERMS_VERSION } from 'common/plusTerms';
import { useTranslation } from '../utils/I18nContext';
import DialogHeader from '../components/DialogHeader';
import Glyph from '../community/Glyph';
import { identityStyle } from '../community/identity';
import { useLeaderboard } from '../usage/leaderboardStore';
import type { TAccountPanelPage } from './accountPanel';
import { signOutAccount, useAccount } from './accountStore';
import { useEntitlement } from './entitlementStore';
import PlusCard from './PlusCard';
import PlusTermsDocument from './PlusTermsDocument';
import LeaderboardCard from './LeaderboardCard';
import SignInForms from './SignInForms';
import SubscribeAgreement from './SubscribeAgreement';
import initialsOf from './initials';
import '../styles/Account.scss';

interface IAccountDialogProps {
  onClose: () => void;
  /**
   * The page to open on. The leaderboard's guide opens straight on the terms,
   * and every way into paying opens on the terms with the agreement under
   * them.
   */
  initialPage?: TAccountPanelPage;
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
  signed_out_elsewhere: 'account.error.signedOutElsewhere',
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
 *
 * The Plus terms are a page of the same panel rather than a dialog of their
 * own: reached from a link on either side, from the leaderboard, and — with
 * the agreement at their foot — from every button that leads to paying.
 */
export default function AccountDialog({
  onClose,
  initialPage = 'home',
}: IAccountDialogProps) {
  const { t } = useTranslation();
  const closeRef = useRef<HTMLButtonElement>(null);
  const termsRef = useRef<HTMLDivElement>(null);
  const account = useAccount();
  const entitlement = useEntitlement();
  const { status: board } = useLeaderboard();
  const [page, setPage] = useState<TAccountPanelPage>(initialPage);
  const [checkoutOpened, setCheckoutOpened] = useState(false);

  // A request for another page while the panel is already open — the
  // composer's upgrade with the panel on screen — moves it there.
  useEffect(() => {
    setPage(initialPage);
  }, [initialPage]);

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
  const termsOffered = isCheckoutConfigured();

  // Paying needs an account with nothing to pay for yet: signed out, the
  // panel asks for the account first; already a member, there is nothing to
  // agree to and the terms are simply shown. Without a price configured there
  // is no Plus to describe at all.
  const shown: TAccountPanelPage = (() => {
    if (!termsOffered) {
      return 'home';
    }
    if (page === 'subscribe') {
      if (!signedIn) {
        return 'home';
      }
      return entitlement.state === 'none' ? 'subscribe' : 'terms';
    }
    return page;
  })();
  const onTerms = shown !== 'home';

  // The forms take the caret themselves; the close button gets it only when
  // there is nothing to type into. The terms take it on their own page, so
  // the keys scroll the document from the first press.
  useEffect(() => {
    if (onTerms) {
      termsRef.current?.focus();
    } else if (signedIn || status === 'unavailable') {
      closeRef.current?.focus();
    }
  }, [onTerms, signedIn, status]);

  const termsLink = termsOffered && (
    <button
      type="button"
      className="account-link account__terms-link"
      onClick={() => setPage('terms')}
    >
      {t('terms.link')}
    </button>
  );

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
          eyebrow={onTerms ? t('terms.eyebrow') : t('account.eyebrow')}
          title={onTerms ? t('terms.title') : t('account.title')}
          titleId="account-title"
          version={onTerms ? String(PLUS_TERMS_VERSION) : undefined}
          closeLabel={t('account.close')}
          onClose={onClose}
          closeRef={closeRef}
        />

        {onTerms && (
          <>
            {/* Keyed on the page so switching between reading and agreeing
                starts the document from its top. */}
            <div
              key={shown}
              ref={termsRef}
              tabIndex={-1}
              className="about__body account__body account__terms"
            >
              <PlusTermsDocument />
            </div>
            {shown === 'subscribe' ? (
              <SubscribeAgreement
                onBack={() => setPage('home')}
                onOpened={() => {
                  setCheckoutOpened(true);
                  setPage('home');
                }}
              />
            ) : (
              <footer className="plus-terms-foot">
                <button
                  type="button"
                  className="button small subtle"
                  onClick={() => setPage('home')}
                >
                  {t('terms.back')}
                </button>
              </footer>
            )}
          </>
        )}

        <div className="about__body account__body" hidden={onTerms}>
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
                <PlusCard
                  entitlement={entitlement}
                  onUpgrade={() => setPage('subscribe')}
                  checkoutOpened={checkoutOpened}
                />
                <LeaderboardCard />
              </div>

              <div className="account__foot">
                <p className="account__optional account__optional--foot">
                  {t('account.optional')}
                </p>
                {termsLink}
              </div>
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
                      <Glyph name="studio" />
                    </span>
                    {t('account.perk.visualizers')}
                  </li>
                  <li>
                    <span className="account__perk-mark" aria-hidden="true">
                      <Glyph name="board" />
                    </span>
                    {t('account.perk.board')}
                  </li>
                </ul>
                {termsLink}
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
