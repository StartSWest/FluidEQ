import { useEffect } from 'react';
import type { TranslationKey } from 'common/i18n/en';
import { requestAccountPanel } from '../account/accountPanel';
import { useAccount } from '../account/accountStore';
import { useEntitlement } from '../account/entitlementStore';
import { useTranslation } from '../utils/I18nContext';
import Avatar from './Avatar';
import Glyph, { type TCommunityGlyph } from './Glyph';
import { identityStyle } from './identity';
import LeaderboardView from './LeaderboardView';
import {
  openPlusPlace,
  usePlusNavigation,
  type TPlusPlace,
} from '../plus/plusNavigation';
import PlusWelcome from '../plus/PlusWelcome';
import { forgetProfile, loadProfile, useProfile } from '../plus/profileStore';
import VisualizersView from '../plus/VisualizersView';
import StudioPanel from '../studio/StudioPanel';
import '../styles/CommunityRail.scss';
import '../styles/Community.scss';
import '../styles/Leaderboard.scss';

interface ICommunityPanelProps {
  /** Opens the Account panel; sign-in lives there, not here. */
  onSignIn: () => void;
  /** Shows the graph, where a look chosen in the Plus gallery plays. */
  onShowGraph: () => void;
}

interface IPlace {
  place: TPlusPlace;
  glyph: TCommunityGlyph;
  name: TranslationKey;
  blurb: TranslationKey;
}

/** The rail, top to bottom: the gallery first, because it is open to all. */
const PLACES: readonly IPlace[] = [
  {
    place: 'visualizers',
    glyph: 'looks',
    name: 'plus.visualizers.title',
    blurb: 'plus.visualizers.blurb',
  },
  {
    place: 'board',
    glyph: 'board',
    name: 'leaderboard.title',
    blurb: 'leaderboard.rail.blurb',
  },
  {
    place: 'studio',
    glyph: 'studio',
    name: 'studio.title',
    blurb: 'studio.rail.blurb',
  },
];

/**
 * The Plus tab: the Visualizers gallery of scenes members publish, the
 * leaderboard and the Studio. It was called Community while it also held
 * chat channels; those went when the Forum tab arrived, because two places
 * to talk were two things to keep.
 *
 * A place you go and stay, which is why it is a tab and the Account is a
 * dialog. The places down the left with a picture each, the one open beside
 * them, and at the foot of the rail the member as the board and the gallery
 * show them — or, until they have chosen one, the way to choose a name.
 */
export default function CommunityPanel({
  onSignIn,
  onShowGraph,
}: ICommunityPanelProps) {
  const { t } = useTranslation();
  const account = useAccount();
  const entitlement = useEntitlement();
  const { profile, loaded } = useProfile();
  const signedIn = account.status === 'signed-in';
  const entitled = entitlement.state !== 'none';
  const { place: view } = usePlusNavigation();
  const accountId = signedIn ? account.identity?.id : undefined;

  useEffect(() => {
    if (accountId) {
      loadProfile(accountId).catch(() => undefined);
    } else {
      forgetProfile();
    }
  }, [accountId]);

  if (!signedIn) {
    return <PlusWelcome onSignIn={onSignIn} />;
  }

  const ownName = profile?.displayName || account.identity?.name || '';
  const ownHandle = profile?.handle ?? account.identity?.email ?? '';

  return (
    <div className="community">
      <nav className="community__rail" aria-label={t('tabs.plus')}>
        <div className="community__rail-head">
          <span className="eyebrow">{t('tabs.plus')}</span>
        </div>

        <div className="community__channels">
          {PLACES.map((entry) => {
            const isActive = view === entry.place;
            return (
              <button
                key={entry.place}
                type="button"
                className={`community__channel${isActive ? ' is-active' : ''}`}
                aria-current={isActive ? 'true' : undefined}
                onClick={() => openPlusPlace(entry.place)}
              >
                <span className="community__channel-mark">
                  <Glyph name={entry.glyph} />
                </span>
                <span className="community__channel-text">
                  <span className="community__channel-name">
                    {t(entry.name)}
                  </span>
                  <span className="community__channel-blurb">
                    {t(entry.blurb)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="community__foot">
          {/* The member as the board and the gallery show them, in their own
              colour; the whole card is the way to their account. */}
          <button
            type="button"
            className="community__account"
            style={identityStyle(ownHandle)}
            title={t('account.menu')}
            onClick={() => requestAccountPanel()}
          >
            <Avatar handle={ownHandle} displayName={ownName} size="rail" />
            <span className="community__account-text">
              <span className="community__name community__name--hued">
                {ownName || ownHandle}
              </span>
              {/* The mark beside the handle, not beside the name: in a rail
                  this narrow, a name that has to share its line is cut. */}
              <span className="community__account-line">
                <span className="community__handle">
                  {profile ? `@${profile.handle}` : t('account.menu')}
                </span>
                {profile?.role === 'admin' && (
                  <span className="community__role community__role--admin">
                    {t('leaderboard.role.admin')}
                  </span>
                )}
                {profile?.role !== 'admin' && entitled && (
                  <span className="community__role">
                    {t('graph.scene.badge')}
                  </span>
                )}
              </span>
            </span>
            <span className="community__account-chevron" aria-hidden="true" />
          </button>
          {/* The name the board ranks is chosen on the board; this is the
              way there from anywhere in the tab. */}
          {!profile && loaded && entitled && (
            <button
              type="button"
              className="community__link community__choose"
              onClick={() => openPlusPlace('board')}
            >
              <Glyph name="mention" />
              {t('leaderboard.name.choose')}
            </button>
          )}
        </div>
      </nav>

      <section className="community__main">
        {view === 'visualizers' && (
          <VisualizersView onShowGraph={onShowGraph} />
        )}
        {view === 'studio' && <StudioPanel />}
        {view === 'board' && (
          <>
            <header className="community__head">
              <span className="community__head-mark">
                <Glyph name="board" />
              </span>
              <span className="community__head-name">
                {t('leaderboard.title')}
              </span>
            </header>
            <LeaderboardView />
          </>
        )}
      </section>
    </div>
  );
}
