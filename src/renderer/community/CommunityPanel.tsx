import { Fragment, useEffect } from 'react';
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
import Avatar from './Avatar';
import Glyph, { type TCommunityGlyph } from './Glyph';
import { identityStyle } from './identity';
import { setGalleryNotice } from '../plus/galleryActions';
import {
  openPlusPlace,
  plusTabOpened,
  usePlusNavigation,
  type TPlusPlace,
} from '../plus/plusNavigation';
import {
  PLUS_RAIL_WIDTH_KEY,
  setPlusRailPinned,
  usePlusRailPinned,
} from '../plus/plusRail';
import { useRailWidth } from '../library/LibraryRailSplitter';
import StudioRail from '../widgets/StudioRail';
import VisualizersSignedOut from '../plus/VisualizersSignedOut';
import { forgetProfile, loadProfile, useProfile } from '../plus/profileStore';
import VisualizersView from '../plus/VisualizersView';
import PlusPage from '../plus/PlusPage';
import PlusRailRow from '../plus/PlusRailRow';
import { plusShown, usePlusSubscription } from '../plus/plusSubscriptionStore';
import LightingPanel from '../plus/lighting/LightingPanel';
import StudioPanel from '../studio/StudioPanel';
import VisualsNewsNotice, { VisualsNewsEntry } from './VisualsNews';
import '../styles/CommunityRail.scss';
import '../styles/Community.scss';
// The ring the scene page turns while a scene downloads, used here too.
import '../styles/Gallery.scss';
import '../styles/PlusRail.scss';
import '../styles/VisualsNews.scss';

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
  const plus = usePlusSubscription();
  const pinned = usePlusRailPinned();
  const rail = useRailWidth(PLUS_RAIL_WIDTH_KEY);
  const accountId = signedIn ? account.identity?.id : undefined;

  useEffect(() => {
    if (accountId) {
      loadProfile(accountId).catch(() => undefined);
    } else {
      forgetProfile();
    }
  }, [accountId]);

  // Every opening of the tab is a new visit: the gallery starts on Newest.
  useEffect(() => {
    plusTabOpened();
  }, []);

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
    return <VisualizersSignedOut onSignIn={onSignIn} />;
  }

  const ownName = profile?.displayName || account.identity?.name || '';
  const ownHandle = profile?.handle ?? account.identity?.email ?? '';

  // A place remembered from an add-on that is not loaded is the gallery, and
  // so is Plus's page once main has said there is no Plus to be had.
  const addon = isAddonPlace(view) ? addonForPlace(view) : undefined;
  const gone =
    (isAddonPlace(view) && !addon) ||
    (view === 'plus' && plus !== undefined && !plusShown(plus));
  const shown: TPlusPlace = gone ? 'visualizers' : view;

  const openPlace = (place: TPlusPlace) => {
    if (place !== shown) {
      setGalleryNotice(undefined);
    }
    openPlusPlace(place);
  };

  return (
    <div className="community community--plus">
      {/* The studio rail every page with one shares (`StudioRail`): the
          page's name beside the pin, folded to the places' glyphs by the pin
          or on a narrow card, and opened over the place while the pointer
          is on it. */}
      <StudioRail
        rail={rail}
        isPinned={pinned}
        onPinnedChange={setPlusRailPinned}
        heading={t('tabs.plus')}
      >
        <nav className="community__rail" aria-label={t('tabs.plus')}>
          <div className="community__channels">
            {PLACES.map((entry) => {
              const isActive = shown === entry.place;
              return (
                <Fragment key={entry.place}>
                  <button
                    type="button"
                    className={`community__channel${isActive ? ' is-active' : ''}`}
                    aria-current={isActive ? 'true' : undefined}
                    // What the place is for: the row is one line now, as the
                    // Library's shelves are, and this was its second.
                    title={t(entry.blurb)}
                    onClick={() => openPlace(entry.place)}
                  >
                    <span className="community__channel-mark">
                      <Glyph name={entry.glyph} />
                    </span>
                    <span className="community__channel-text studio-rail__word">
                      <span className="community__channel-name">
                        {t(entry.name)}
                      </span>
                      <span className="community__channel-blurb">
                        {t(entry.blurb)}
                      </span>
                    </span>
                  </button>
                  {/* Plus under the gallery whose scenes it plays. */}
                  {entry.place === 'visualizers' && (
                    <PlusRailRow
                      isActive={shown === 'plus'}
                      onOpen={() => openPlace('plus')}
                    />
                  )}
                </Fragment>
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
            {/* The visualizers' own What's New, apart from the sound's. */}
            <span className="community__rail-rule" aria-hidden="true" />
            <VisualsNewsEntry />
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
              <span className="community__account-text studio-rail__word">
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
              <span
                className="community__account-chevron studio-rail__word"
                aria-hidden="true"
              />
            </button>
            {/* The name the gallery credits published scenes with is chosen
                in the account panel; this is the way there from the tab. */}
            {!profile && loaded && (
              <button
                type="button"
                className="community__link community__choose studio-rail__word"
                // Straight onto the form (Ivan, 2026-11-14): the dialog's
                // own "Choose your name" was one more press away.
                onClick={() => requestAccountPanel('name')}
              >
                <Glyph name="mention" />
                {t('profile.name.choose')}
              </button>
            )}
          </div>
        </nav>
      </StudioRail>

      <section className="community__main">
        <VisualsNewsNotice />
        {shown === 'visualizers' && (
          <VisualizersView onShowGraph={onShowGraph} />
        )}
        {shown === 'plus' && <PlusPage />}
        {shown === 'studio' && <StudioPanel onShowGraph={onShowGraph} />}
        {shown === 'lighting' && <LightingPanel onShowGraph={onShowGraph} />}
        {isAddonPlace(shown) && addon?.Place && accountId && (
          <addon.Place place={shown} accountId={accountId} />
        )}
      </section>
    </div>
  );
}
