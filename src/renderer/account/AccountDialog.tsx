import { useEffect, useRef, useState } from 'react';
import type { TAuthFailure } from 'main/account/authClient';
import type { TranslationKey } from 'common/i18n/en';
import { isCheckoutConfigured } from 'common/accountConfig';
import { PLUS_TERMS_EDITION } from 'common/plusTerms';
import { useTranslation } from '../utils/I18nContext';
import BrandMark from '../icons/BrandMark';
import DialogHeader from '../components/DialogHeader';
import Glyph from '../community/Glyph';
import LeaderboardName from '../community/LeaderboardName';
import { identityStyle } from '../community/identity';
import {
  createProfile,
  forgetProfile,
  loadProfile,
  updateProfile,
  useProfile,
} from '../plus/profileStore';
import type { TAccountPanelPage } from './accountPanel';
import { signOutAccount, useAccount } from './accountStore';
import { useEntitlement } from './entitlementStore';
import SceneBand from '../plus/SceneBand';
import PlusCard from './PlusCard';
import PlusTermsDocument from './PlusTermsDocument';
import LeaderboardCard from './LeaderboardCard';
import SignInForms from './SignInForms';
import SubscribeAgreement from './SubscribeAgreement';
import initialsOf from './initials';
// The panel is an `about` surface with an `account` body inside it, so it
// depends on both sheets. About's came in only because `App.tsx` imports the
// About dialog too — a component that draws with a class has to ask for the
// sheet that defines it, or it is one import away from losing its width, its
// padding and its scrolling.
import '../styles/About.scss';
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
  const termsOffered = isCheckoutConfigured();

  // The name the board and the gallery show, when one has been chosen: it is
  // what the panel leads with, and what "Change name" edits. The provider's
  // name stands in until then.
  const { profile, loaded: profileLoaded } = useProfile();
  const accountId = signedIn ? identity.id : undefined;
  useEffect(() => {
    if (accountId) {
      loadProfile(accountId).catch(() => undefined);
    } else {
      forgetProfile();
    }
  }, [accountId]);
  const [editingName, setEditingName] = useState(false);
  // Whether signing out is being asked about rather than done.
  const [signingOut, setSigningOut] = useState(false);
  const displayName =
    profile?.displayName ?? identity?.name ?? identity?.email ?? '';

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
  const onTerms = shown === 'terms' || shown === 'subscribe';
  // The front page with somebody signed in: the person, as a profile.
  const onProfile = signedIn && !onTerms;

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
        className={`about account${onProfile ? ' account--profile' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-title"
      >
        {/* Signed in, the banner is the top of the panel and the person's
            name is its title; the standard header would be a second top over
            it. Every other page keeps the header. */}
        {!onProfile && (
          <DialogHeader
            eyebrow={onTerms ? t('terms.eyebrow') : t('account.eyebrow')}
            title={onTerms ? t('terms.title') : t('account.title')}
            titleId="account-title"
            version={onTerms ? String(PLUS_TERMS_EDITION) : undefined}
            closeLabel={t('account.close')}
            onClose={onClose}
            closeRef={closeRef}
          />
        )}

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

        {/* A profile card, the way Discord draws one — the pattern Ivan chose
            from the references (2026-09-15): a wide banner, the avatar cut
            into its lower-left edge with a ring in the panel's own colour,
            the name under it, and the sections as text under hairlines
            rather than as boxes. A member's banner is the scene, playing;
            without Plus it is a flat field in the person's colour, the way a
            profile with no banner takes the account colour there.

            The banner, the avatar and the name are the panel's top, in the
            row the header would take, and only the sections under them
            scroll: the avatar hangs over the banner's edge, and a scrolling
            body would clip the half of it that hangs out. Hidden, not
            unmounted, on the terms page, like the body under it. */}
        {signedIn && (
          <div
            className="account__top"
            hidden={onTerms}
            style={identityStyle(identity.email ?? identity.id)}
          >
            <SceneBand
              playsScene={entitlement.state !== 'none'}
              className="account__banner"
            >
              {/* What the account is, in the banner's own corner (Ivan,
                  2026-09-16): a plate of dark glass over the scene rather
                  than a filled pill under it, which read as a button and
                  put dark letters on the app's brightest colour. */}
              {entitlement.state === 'none' ? (
                <span className="account__standing account__standing--free">
                  {t('account.standing.free')}
                </span>
              ) : (
                <span className="account__standing">
                  <BrandMark />
                  {t('account.plus.eyebrow')}
                </span>
              )}

              <button
                ref={closeRef}
                type="button"
                className="account__banner-close"
                aria-label={t('account.close')}
                onClick={onClose}
              >
                <Glyph name="close" />
              </button>
            </SceneBand>

            <div className="account__head">
              {/* The initials of the name shown under them, not of the one
                  the sign-in provider holds: a board name of "Ivan" over an
                  account registered as something else drew that something
                  else's letter, and the avatar and the name disagreed. */}
              <span className="account__avatar" aria-hidden="true">
                {initialsOf(displayName, identity.email)}
              </span>
            </div>

            <div className="account__who">
              <h2 id="account-title" className="account__name">
                {displayName}
              </h2>
              <p className="account__line">
                {profile && (
                  <span className="account__handle">@{profile.handle}</span>
                )}
                {profile && identity.email && (
                  <span className="account__dot" aria-hidden="true">
                    ·
                  </span>
                )}
                {identity.email && identity.email !== displayName && (
                  <span className="account__email">{identity.email}</span>
                )}
              </p>

              {/* The two things you can do to the account itself, as links
                  under the name they are about rather than as a row of
                  buttons at the foot: neither is what anybody opened this
                  panel to be encouraged into, and a button says press me.
                  Signing out asks first — it is one click from losing a
                  half-written scene's home and every Plus lock closing. */}
              {signingOut ? (
                <p className="account__ask" role="alertdialog">
                  <span className="account__ask-title">
                    {t('account.signOut.confirm')}
                  </span>
                  <button
                    type="button"
                    className="account-link account__ask-yes"
                    onClick={() => {
                      signOutAccount().catch(() => undefined);
                    }}
                  >
                    {t('account.signOut')}
                  </button>
                  <button
                    type="button"
                    className="account-link"
                    onClick={() => setSigningOut(false)}
                  >
                    {t('account.name.cancel')}
                  </button>
                </p>
              ) : (
                <p className="account__links">
                  {/* Only once the server has said whether there is a name:
                      "choose" offered to somebody who has one would fail on
                      the first press. */}
                  {profileLoaded && !editingName && (
                    <button
                      type="button"
                      className="account-link"
                      onClick={() => setEditingName(true)}
                    >
                      {t(
                        profile
                          ? 'account.name.change'
                          : 'leaderboard.name.choose',
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    className="account-link"
                    onClick={() => setSigningOut(true)}
                  >
                    {t('account.signOut')}
                  </button>
                </p>
              )}
            </div>
          </div>
        )}

        <div className="about__body account__body" hidden={onTerms}>
          {signedIn && (
            <>
              {/* First in the body, which is directly under the link that
                  opens it: the form used to appear at the foot, below both
                  sections, where pressing "Change name" looked like it had
                  done nothing (Ivan, 2026-09-16). The body scrolls, and the
                  header above it does not, which is why it is here rather
                  than inside that header. */}
              {editingName && (
                <div className="account__name-form">
                  <LeaderboardName
                    initial={
                      profile
                        ? {
                            handle: profile.handle,
                            displayName: profile.displayName,
                          }
                        : undefined
                    }
                    save={profile ? updateProfile : createProfile}
                    onSaved={() => setEditingName(false)}
                    onCancel={() => setEditingName(false)}
                  />
                </div>
              )}

              <PlusCard
                entitlement={entitlement}
                onUpgrade={() => setPage('subscribe')}
                checkoutOpened={checkoutOpened}
              />
              <LeaderboardCard />

              {errorLine}

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
                <SignInForms
                  account={account}
                  initialMode={page === 'signUp' ? 'signUp' : 'signIn'}
                />
                {errorLine}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
