import { useEffect } from 'react';
import type { TranslationKey } from 'common/i18n/en';
import { requestAccountPanel } from '../account/accountPanel';
import { useAccount, useAccountKnown } from '../account/accountStore';
import { useEntitlementKnown } from '../account/entitlementStore';
import {
  addonForPlace,
  isAddonPlace,
  refreshAddons,
  rendererAddons,
} from '../addons';
import { useTranslation } from '../utils/I18nContext';
import { runsOnLinux } from '../utils/platform';
import Avatar from './Avatar';
import Glyph, { type TCommunityGlyph } from './Glyph';
import { identityStyle } from './identity';
import { setGalleryNotice } from '../plus/galleryActions';
import {
  openPlusPlace,
  usePlusNavigation,
  type TPlusPlace,
} from '../plus/plusNavigation';
import { setPlusRailPinned, usePlusRailPinned } from '../plus/plusRail';
import PlusWelcome from '../plus/PlusWelcome';
import { forgetProfile, loadProfile, useProfile } from '../plus/profileStore';
import VisualizersView from '../plus/VisualizersView';
import LightingPanel from '../plus/lighting/LightingPanel';
import StudioPanel from '../studio/StudioPanel';
import '../styles/CommunityRail.scss';
import '../styles/Community.scss';
// The ring the scene page turns while a scene downloads, used here too.
import '../styles/Gallery.scss';
import '../styles/PlusRail.scss';

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

/**
 * The rail, top to bottom: visualizers, Studio, then dynamic lighting — the places that make scenes before the one that takes them off
 * the screen. An add-on's places follow (`renderer/addons.ts`), when there is one.
 */
export const PLACES: readonly IPlace[] = [
  {
    place: 'visualizers',
    glyph: 'looks',
    name: 'plus.visualizers.title',
    blurb: 'plus.visualizers.blurb',
  },
  {
    place: 'studio',
    glyph: 'studio',
    name: 'studio.title',
    blurb: 'studio.rail.blurb',
  },
  {
    place: 'lighting',
    glyph: 'lighting',
    name: 'lighting.title',
    blurb: 'lighting.rail.blurb',
  },
];

/**
 * The Plus tab: the Visualizers gallery of scenes members publish, the
 * Studio and the lighting. It was called Community while it also held
 * chat channels; those went when the Forum tab arrived, because two places
 * to talk were two things to keep.
 *
 * A place you go and stay, which is why it is a tab and the Account is a
 * dialog. The places down the left with a picture each, the one open beside
 * them, and at the foot of the rail the member as the gallery shows them — or, until they have chosen one, the way to choose a name.
 */
export default function CommunityPanel({
  onSignIn,
  onShowGraph,
}: ICommunityPanelProps) {
  const { t } = useTranslation();
  const account = useAccount();
  const accountKnown = useAccountKnown();
  const entitlementKnown = useEntitlementKnown();
  const { profile, loaded } = useProfile();
  const signedIn = account.status === 'signed-in';
  const { place: view } = usePlusNavigation();
  const pinned = usePlusRailPinned();
  const accountId = signedIn ? account.identity?.id : undefined;

  useEffect(() => {
    if (accountId) {
      loadProfile(accountId).catch(() => undefined);
    } else {
      forgetProfile();
    }
  }, [accountId]);

  // An add-on asks what it needs whenever the tab opens and whenever another
  // account signs in.
  useEffect(() => {
    refreshAddons(accountId);
  }, [accountId]);

  // What a place said back under its head belongs to the tab's visit. Cleared
  // here, not by each place as it closes: a scene answered from its own page
  // sends somebody to another place, and the answer goes along.
  useEffect(() => () => setGalleryNotice(undefined), []);

  // Neither version of the tab until the main process has said which one is
  // true: the stores start signed out and unsubscribed, and drawing that
  // flashed the welcome, or the offer, at a member opening the tab.
  if (!accountKnown || (signedIn && !entitlementKnown)) {
    return (
      <div
        className="community community--checking"
        role="status"
        aria-label={t('account.checking')}
      >
        <span className="gallery-preview__spinner" aria-hidden="true" />
      </div>
    );
  }

  if (!signedIn) {
    return <PlusWelcome onSignIn={onSignIn} />;
  }

  const ownName = profile?.displayName || account.identity?.name || '';
  const ownHandle = profile?.handle ?? account.identity?.email ?? '';

  const pinLabel = t(pinned ? 'plus.rail.collapse' : 'plus.rail.pin');

  // A place remembered from an add-on that is not loaded is the gallery.
  const addon = isAddonPlace(view) ? addonForPlace(view) : undefined;
  // Dynamic lighting still depends on Windows services. Keep the Linux rail
  // adapted while sharing main's add-on availability and gallery fallback.
  const isLinux = runsOnLinux();
  const places = isLinux
    ? PLACES.filter((entry) => entry.place !== 'lighting')
    : PLACES;
  const shown: TPlusPlace =
    (isAddonPlace(view) && !addon) || (view === 'lighting' && isLinux)
      ? 'visualizers'
      : view;

  const openPlace = (place: TPlusPlace) => {
    if (place !== shown) {
      setGalleryNotice(undefined);
    }
    openPlusPlace(place);
  };

  return (
    <div
      className={`community community--plus${pinned ? '' : ' community--rail-folded'}`}
    >
      {/* The slot keeps the rail's room in the grid; the rail stands in it,
          and when folded opens over the place instead of pushing it. */}
      <div className="community__rail-slot">
        <nav className="community__rail" aria-label={t('tabs.plus')}>
          <div className="community__rail-head">
            <button
              type="button"
              className="community__rail-pin"
              aria-pressed={pinned}
              aria-label={pinLabel}
              title={pinLabel}
              onClick={() => setPlusRailPinned(!pinned)}
            >
              <Glyph name={pinned ? 'rail-collapse' : 'pin'} />
            </button>
            <span className="community__rail-title">{t('tabs.plus')}</span>
          </div>

          <div className="community__channels">
            {places.map((entry) => {
              const isActive = shown === entry.place;
              return (
                <button
                  key={entry.place}
                  type="button"
                  className={`community__channel${isActive ? ' is-active' : ''}`}
                  aria-current={isActive ? 'true' : undefined}
                  onClick={() => openPlace(entry.place)}
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
            {accountId &&
              rendererAddons().map(
                ({ name, RailPlaces }) =>
                  RailPlaces && (
                    <RailPlaces
                      key={name}
                      accountId={accountId}
                      activePlace={shown}
                      openPlace={openPlace}
                    />
                  ),
              )}
          </div>

          <div className="community__foot">
            {/* The member as the gallery shows them, in their own colour; the whole card is the way to their account. */}
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
                  {rendererAddons().map(
                    ({ name, AccountBadge }) =>
                      AccountBadge && <AccountBadge key={name} />,
                  )}
                </span>
              </span>
              <span className="community__account-chevron" aria-hidden="true" />
            </button>
            {/* The name the gallery credits published scenes with is chosen
                in the account panel; this is the way there from the tab. */}
            {!profile && loaded && (
              <button
                type="button"
                className="community__link community__choose"
                onClick={() => requestAccountPanel()}
              >
                <Glyph name="mention" />
                {t('profile.name.choose')}
              </button>
            )}
          </div>
        </nav>
      </div>

      <section className="community__main">
        {shown === 'visualizers' && (
          <VisualizersView onShowGraph={onShowGraph} />
        )}
        {shown === 'studio' && <StudioPanel />}
        {shown === 'lighting' && <LightingPanel onShowGraph={onShowGraph} />}
        {isAddonPlace(shown) && addon?.Place && accountId && (
          <addon.Place place={shown} accountId={accountId} />
        )}
      </section>
    </div>
  );
}
