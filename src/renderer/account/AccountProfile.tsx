import type { ReactNode, RefObject } from 'react';
import type { ISceneStore } from 'common/sceneStore';
import { CREATOR_PAYOUTS_OPEN } from 'common/creatorPayouts';
import type { IPlusProfile } from 'common/plusProfile';
import Glyph from '../community/Glyph';
import type { TMine } from '../plus/myScenes';
import { createProfile, updateProfile } from '../plus/profileStore';
import { useTranslation } from '../utils/I18nContext';
import AccountPublished from './AccountPublished';
import AccountScenes from './AccountScenes';
import AccountStats from './AccountStats';
import CreatorPayoutsCard from './CreatorPayoutsCard';
import CreditsCard from './CreditsCard';
import ProfileNameForm from './ProfileNameForm';
import SignOutConfirm from './SignOutConfirm';
import '../styles/AccountProfile.scss';

/**
 * The account panel with somebody signed in (Ivan, 2026-11-13: "improve
 * account a bit"): the rail is the person — the scene playing behind them,
 * their face, name, @handle and, quieter, the address — with the account's
 * two actions and its three numbers; the page leads with the credits and
 * "Get more credits", then the scenes the account has and what it published.
 * Split from `AccountDialog`, which keeps the frame and the signed-out side.
 */

/** Under the name: the @handle, and the address on a line of its own. */
export function ProfileContact({
  handle,
  email,
}: {
  handle: string | undefined;
  email: string | undefined;
}) {
  return (
    <span className="account-contact">
      {handle && <span className="account__handle">@{handle}</span>}
      {email && <span className="account__email">{email}</span>}
    </span>
  );
}

interface IProfileRailProps {
  profileLoaded: boolean;
  hasName: boolean;
  editingName: boolean;
  onEditName: () => void;
  signingOut: boolean;
  onSignOut: () => void;
  signOutLinkRef: RefObject<HTMLButtonElement | null>;
  store: ISceneStore | undefined;
  mine: TMine;
}

/**
 * The account's two actions and its numbers. The actions stay links — neither
 * is what anybody opened the panel to be encouraged into, and a button says
 * press me — but each with its glyph, on a row of their own. Signing out asks
 * first, and while it asks the question stands at the top of the page and
 * these wait for its answer.
 */
export function ProfileRail({
  profileLoaded,
  hasName,
  editingName,
  onEditName,
  signingOut,
  onSignOut,
  signOutLinkRef,
  store,
  mine,
}: IProfileRailProps) {
  const { t } = useTranslation();
  return (
    <>
      {!signingOut && (
        <p className="account__links account-actions">
          {/* Only once the server has said whether there is a name: "choose"
              offered to somebody who has one would fail on the first press. */}
          {profileLoaded && !editingName && (
            <button type="button" className="account-link" onClick={onEditName}>
              <Glyph name="mention" />
              {t(hasName ? 'account.name.change' : 'profile.name.choose')}
            </button>
          )}
          <button
            ref={signOutLinkRef}
            type="button"
            className="account-link"
            onClick={onSignOut}
          >
            <Glyph name="sign-out" />
            {t('account.signOut')}
          </button>
        </p>
      )}
      {store && (
        <AccountStats
          owned={store.owned.length}
          publishedFromStore={store.published?.length ?? 0}
          mine={mine}
        />
      )}
    </>
  );
}

interface IProfileBodyProps {
  editingName: boolean;
  profileLoaded: boolean;
  profile: IPlusProfile | undefined;
  onNameDone: () => void;
  signingOut: boolean;
  ownsScenes: boolean;
  onSignOutCancel: () => void;
  store: ISceneStore | undefined;
  accountId: string | undefined;
  mine: TMine;
  onClose: () => void;
  errorLine: ReactNode;
  termsLink: ReactNode;
}

/** The page beside the rail. */
export function ProfileBody({
  editingName,
  profileLoaded,
  profile,
  onNameDone,
  signingOut,
  ownsScenes,
  onSignOutCancel,
  store,
  accountId,
  mine,
  onClose,
  errorLine,
  termsLink,
}: IProfileBodyProps) {
  return (
    <>
      {/* First in the page, beside the links that ask for them: the name form
          used to appear at the foot, where pressing "Change name" looked like
          it had done nothing (Ivan, 2026-09-16). Only once the server has
          said whether there is a name: the form starts from it. */}
      {editingName && profileLoaded && (
        <div className="account__name-form">
          <ProfileNameForm
            initial={
              profile
                ? { handle: profile.handle, displayName: profile.displayName }
                : undefined
            }
            save={profile ? updateProfile : createProfile}
            onSaved={onNameDone}
            onCancel={onNameDone}
          />
        </div>
      )}
      {signingOut && (
        <SignOutConfirm ownsScenes={ownsScenes} onCancel={onSignOutCancel} />
      )}

      {/* What gets scenes: credits. Plus is not sold any more, and nothing
          about a subscription is shown (Ivan, 2026-10-21). */}
      <CreditsCard />
      {store && (
        <AccountScenes
          owned={store.owned}
          unpublished={store.unpublished}
          onLeave={onClose}
        />
      )}
      {accountId && (
        <AccountPublished me={accountId} mine={mine} onLeave={onClose} />
      )}
      {/* Getting paid for the scenes members keep, once FluidEQ can pay
          creators; never asked for until then. */}
      {CREATOR_PAYOUTS_OPEN && accountId && (
        <CreatorPayoutsCard accountId={accountId} />
      )}

      {errorLine}

      {/* Signed in, that signing in is optional goes without saying: the foot
          keeps the terms alone. */}
      {termsLink && <div className="account__foot">{termsLink}</div>}
    </>
  );
}
