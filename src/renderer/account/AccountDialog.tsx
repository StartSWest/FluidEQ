import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { TAuthFailure } from 'main/account/authClient';
import type { TranslationKey } from 'common/i18n/en';
import { isCheckoutConfigured } from 'common/accountConfig';
import { PLUS_TERMS_EDITION } from 'common/plusTerms';
import { PLUS_TRIAL_PLAN } from 'common/plusTrial';
import { useTranslation } from '../utils/I18nContext';
import MenuIcon from '../icons/MenuIcon';
import DialogFrame from '../components/DialogFrame';
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
import { useAccount } from './accountStore';
import { useEntitlement } from './entitlementStore';
import SceneBand from '../plus/SceneBand';
import PlusCard from './PlusCard';
import PlusTermsDocument from './PlusTermsDocument';
import LeaderboardCard from './LeaderboardCard';
import MakerMonthCard from './MakerMonthCard';
import { forgetMakerMonth } from '../plus/makerMonthStore';
import SignInForms from './SignInForms';
import SignOutConfirm from './SignOutConfirm';
import SubscribeAgreement from './SubscribeAgreement';
import PlusTrialAgreement, { PlusTrialConsent } from './PlusTrialAgreement';
import AccountPitch from './AccountPitch';
import initialsOf from './initials';
// The panel sits on the About panel's backdrop, so it asks for the sheet that
// defines it: a component that draws with a class it only gets because
// `App.tsx` happens to import About too is one import away from losing it.
import '../styles/About.scss';
import '../styles/Account.scss';

/** What the frame's rail and foot say on one page of the panel. */
interface IAccountFramePage {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  badge?: ReactNode;
  description?: ReactNode;
  rail?: ReactNode;
  footer?: ReactNode;
}

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
 * On the dialog frame (`DialogFrame`), every page of it. Signed in, the rail
 * is the person: their initials in their own colour in the tile, what they
 * are here over their name, the two things they can do to the account under
 * it, and — for a member — the scene they pay for, playing. Signed out, the
 * pitch is the rail and the form is the page, so the reason to sign in and
 * the way to do it are on screen together. The sentence that says signing in
 * is optional is on both: this app has promised since its first release that
 * it is local and account-free, and that is still true for anybody who closes
 * this without typing anything.
 *
 * The Plus terms are a page of the same panel rather than a dialog of their
 * own: reached from a link on either side, from the leaderboard, and — with
 * the agreement in the foot — from every button that leads to paying.
 */
export default function AccountDialog({
  onClose,
  initialPage = 'home',
}: IAccountDialogProps) {
  const { t } = useTranslation();
  const frameRef = useRef<HTMLDivElement>(null);
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
  const member = entitlement.state !== 'none';

  // The name the board and the gallery show, when one has been chosen: it is
  // what the panel leads with, and what "Change name" edits. The provider's
  // name stands in until then.
  const { profile, loaded: profileLoaded } = useProfile();
  const accountId = signedIn ? identity.id : undefined;
  const [editingName, setEditingName] = useState(false);
  // Whether signing out is being asked about rather than done.
  const [signingOut, setSigningOut] = useState(false);
  useEffect(() => {
    // A question or a name form belongs to the account it was opened on:
    // kept, signing out and back in within one opening of the panel came
    // back to "Sign out of this account?" already asked.
    setSigningOut(false);
    setEditingName(false);
    if (accountId) {
      loadProfile(accountId).catch(() => undefined);
    } else {
      forgetProfile();
      forgetMakerMonth();
    }
  }, [accountId]);

  // Taking the question back returns the caret to the link that asked it,
  // which is mounted again only once the question has gone.
  const signOutLinkRef = useRef<HTMLButtonElement>(null);
  const returnToSignOut = useRef(false);
  useEffect(() => {
    if (!signingOut && returnToSignOut.current) {
      returnToSignOut.current = false;
      signOutLinkRef.current?.focus();
    }
  }, [signingOut]);
  const displayName =
    profile?.displayName ?? identity?.name ?? identity?.email ?? '';

  // Paying needs an account with nothing to pay for yet: signed out, the
  // panel asks for the account first; already a member, there is nothing to
  // agree to and the terms are simply shown. Without a price configured there
  // is no Plus to describe at all.
  const shown: TAccountPanelPage = (() => {
    if (page === 'trial') {
      return signedIn ? 'trial' : 'home';
    }
    if (!termsOffered) {
      return 'home';
    }
    if (page === 'subscribe') {
      if (!signedIn) {
        return 'home';
      }
      return entitlement.state === 'none' ||
        entitlement.plan === PLUS_TRIAL_PLAN
        ? 'subscribe'
        : 'terms';
    }
    return page;
  })();
  const onTerms = shown === 'terms' || shown === 'subscribe';
  const onTrial = shown === 'trial';
  const onDocument = onTerms || onTrial;
  // The front page with somebody signed in: the person, as a profile.
  const onProfile = signedIn && !onDocument;

  // The forms take the caret themselves; the close button gets it only when
  // there is nothing to type into. The terms take it on their own page, so
  // the keys scroll the document from the first press — without scrolling it
  // there: focusing brought the document's top to the body's edge, past the
  // room the frame keeps under its close button, and the version line sat
  // under the ×.
  useEffect(() => {
    if (onTerms) {
      termsRef.current?.focus({ preventScroll: true });
    } else if (signedIn || status === 'unavailable') {
      closeRef.current?.focus();
    }
  }, [onTerms, signedIn, status]);

  // Every page scrolls in the frame's one body, so each starts at its top:
  // switching between reading the terms and agreeing to them, or back to the
  // account, used to land wherever the last page had been left.
  useLayoutEffect(() => {
    const body = frameRef.current?.querySelector(
      ':scope > .dialog-frame__body',
    );
    if (body) {
      body.scrollTop = 0;
    }
  }, [shown]);

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

  // What the rail says the panel is, page by page: the terms and the trial
  // are documents about Plus; signed in, it is the person; otherwise it is
  // the account the menu row named.
  const frame = ((): IAccountFramePage => {
    if (onTerms) {
      return {
        icon: <MenuIcon name="shield" />,
        eyebrow: t('terms.eyebrow'),
        title: t('terms.title'),
        badge: (
          <span className="dialog-frame__badge">v{PLUS_TERMS_EDITION}</span>
        ),
        footer:
          shown === 'subscribe' ? (
            <SubscribeAgreement
              onBack={() => setPage('home')}
              onOpened={() => {
                setCheckoutOpened(true);
                setPage('home');
              }}
            />
          ) : (
            <div className="dialog-frame__actions">
              <button
                type="button"
                className="button small subtle"
                onClick={() => setPage('home')}
              >
                {t('terms.back')}
              </button>
            </div>
          ),
      };
    }
    if (onTrial) {
      return {
        icon: <MenuIcon name="plusTab" />,
        eyebrow: t('account.eyebrow'),
        title: t('trial.consent.title'),
        footer: <PlusTrialConsent key={accountId} onClose={onClose} />,
      };
    }
    if (onProfile) {
      // The initials of the name shown beside them, not of the one the
      // sign-in provider holds: a board name of "Ivan" over an account
      // registered as something else drew that something else's letter, and
      // the avatar and the name disagreed.
      const initials = initialsOf(displayName, identity.email);
      const email =
        identity.email && identity.email !== displayName
          ? identity.email
          : undefined;
      return {
        icon: initials ? (
          <span
            className="account__avatar"
            style={identityStyle(identity.email ?? identity.id)}
          >
            {initials}
          </span>
        ) : (
          <MenuIcon name="artist" />
        ),
        // What the account is, over whose it is.
        eyebrow: member
          ? t('account.plus.eyebrow')
          : t('account.standing.free'),
        title: displayName,
        description:
          profile || email ? (
            <>
              {profile && (
                <span className="account__handle">@{profile.handle}</span>
              )}
              {profile && email && (
                <span className="account__dot" aria-hidden="true">
                  {' · '}
                </span>
              )}
              {email && <span className="account__email">{email}</span>}
            </>
          ) : undefined,
        rail: (
          <>
            {/* The two things you can do to the account itself, as links
                under the name they are about rather than as a row of
                buttons: neither is what anybody opened this panel to be
                encouraged into, and a button says press me. Signing out
                asks first — it is one click from every Plus lock closing
                and the account's scenes leaving the lists — and while it
                asks, the question stands at the top of the page and these
                wait for its answer. */}
            {!signingOut && (
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
                  ref={signOutLinkRef}
                  type="button"
                  className="account-link"
                  onClick={() => setSigningOut(true)}
                >
                  {t('account.signOut')}
                </button>
              </p>
            )}
            {/* A member's picture is the scene, playing (Ivan, 2026-09-15):
                a scene is what Plus is. Without it there is nothing to show,
                and a band drawing on the graphics card would be a cost for
                decoration. */}
            {member && <SceneBand playsScene className="dialog-frame__scene" />}
          </>
        ),
      };
    }
    return {
      icon: <MenuIcon name="artist" />,
      eyebrow: t('account.eyebrow'),
      title: page === 'trial' ? t('trial.consent.title') : t('account.title'),
      rail:
        status === 'unavailable' ? (
          <p className="dialog-frame__rail-text">{t('account.optional')}</p>
        ) : (
          <AccountPitch trial={page === 'trial'} termsLink={termsLink} />
        ),
    };
  })();

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
      <DialogFrame
        ref={frameRef}
        className={`account${onProfile ? ' account--profile' : ''}${
          onDocument ? ' account--document' : ''
        }`}
        icon={frame.icon}
        eyebrow={frame.eyebrow}
        title={frame.title}
        titleId="account-title"
        badge={frame.badge}
        description={frame.description}
        rail={frame.rail}
        footer={frame.footer}
        closeLabel={t('account.close')}
        onClose={onClose}
        closeRef={closeRef}
      >
        {onTrial && <PlusTrialAgreement key={accountId} onClose={onClose} />}
        {/* Keyed on the page so switching between reading and agreeing
            starts the document from its top. */}
        {onTerms && (
          <div
            key={shown}
            ref={termsRef}
            tabIndex={-1}
            className="account__terms"
          >
            <PlusTermsDocument />
          </div>
        )}

        {/* Hidden, not unmounted, while a document is read: a half-typed
            sign-in, or a name being changed, is still there on the way
            back. */}
        <div className="account__page" hidden={onDocument}>
          {signedIn && (
            <>
              {/* First in the page, beside the links that ask for them: the
                  name form used to appear at the foot, below both sections,
                  where pressing "Change name" looked like it had done
                  nothing (Ivan, 2026-09-16). */}
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
              {signingOut && (
                <SignOutConfirm
                  member={member}
                  onCancel={() => {
                    returnToSignOut.current = true;
                    setSigningOut(false);
                  }}
                />
              )}

              <PlusCard
                entitlement={entitlement}
                onUpgrade={() => setPage('subscribe')}
                checkoutOpened={checkoutOpened}
              />
              {/* Under the membership, because it is where the membership
                  comes from for a maker: the month their last approved scene
                  earned, and when it runs out. */}
              {accountId && <MakerMonthCard accountId={accountId} />}
              <LeaderboardCard />

              {errorLine}

              <div className="account__foot">
                <p className="account__optional">{t('account.optional')}</p>
                {termsLink}
              </div>
            </>
          )}

          {status === 'unavailable' && (
            <div className="account__notice">
              <span className="account__notice-title">
                {t('account.unavailable')}
              </span>
              <span>{t('account.unavailableHint')}</span>
            </div>
          )}

          {!signedIn && status !== 'unavailable' && (
            <div className="account__form-column">
              <SignInForms
                account={account}
                initialMode={
                  page === 'signUp' || page === 'trial' ? 'signUp' : 'signIn'
                }
              />
              {errorLine}
            </div>
          )}
        </div>
      </DialogFrame>
    </div>
  );
}
