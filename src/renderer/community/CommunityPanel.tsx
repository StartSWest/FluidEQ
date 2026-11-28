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
import Avatar from './Avatar';
import Glyph, { type TCommunityGlyph } from './Glyph';
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
import PlusMark from '../plus/PlusMark';
import { usePlusSubscription } from '../plus/plusSubscriptionStore';
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
  const { t, locale } = useTranslation();
  const account = useAccount();
  const accountKnown = useAccountKnown();
  const entitlementKnown = useEntitlementKnown();
  const { profile, loaded } = useProfile();
  const signedIn = account.status === 'signed-in';
  const { place: view } = usePlusNavigation();
  const pinned = usePlusRailPinned();
  const rail = useRailWidth(PLUS_RAIL_WIDTH_KEY);
  const accountId = signedIn ? account.identity?.id : undefined;
  const plus = usePlusSubscription();
  const member = plus?.subscribed === true;
  // Cancelled to end: the chip says until when, as every Plus surface does.
  // The date is held together, so a narrow rail wraps the line before it and
  // never between "27" and "déc.".
  const plusUntil =
    member && plus?.status?.renewing === false && plus.status.until
      ? new Intl.DateTimeFormat(locale, {
          month: 'short',
          day: 'numeric',
        })
          .format(new Date(plus.status.until))
          .replace(/\s/g, '\u00a0')
      : undefined;

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

  // A place remembered from an add-on that is not loaded is the gallery.
  const addon = isAddonPlace(view) ? addonForPlace(view) : undefined;
  const shown: TPlusPlace = isAddonPlace(view) && !addon ? 'visualizers' : view;

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
                <button
                  key={entry.place}
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
            {/* The member, calm (Ivan, 2026-11-28, of the card before:
                "tjhis mega sucks"): their colour on the picture alone, the
                name, and one quiet line under it. The whole card is the way
                to their account. */}
            <button
              type="button"
              className={`community__account${member ? ' is-plus' : ''}${plusUntil ? ' is-ending' : ''}`}
              title={t('account.menu')}
              onClick={() => requestAccountPanel()}
            >
              <Avatar handle={ownHandle} displayName={ownName} size="rail" />
              <span className="community__account-text studio-rail__word">
                {/* A role an add-on gives stands by the name as a small tag,
                    off the status line, which has no width to spare. */}
                <span className="community__account-head">
                  <span className="community__name">
                    {ownName || ownHandle}
                  </span>
                  {rendererAddons().map(
                    ({ name, AccountBadge }) =>
                      AccountBadge && <AccountBadge key={name} />,
                  )}
                </span>
                {/* One status: a member's pass and "Plus" in the window's
                    accent, then the handle; cancelled, when Plus ends, quiet
                    and without the handle, so the date is never the part
                    that is cut. Anybody else, the handle alone. */}
                <span className="community__account-line">
                  {member && (
                    <span className="community__plus">
                      <PlusMark />
                      <span className="community__plus-words">
                        {plusUntil
                          ? t('subscription.chip.until', { date: plusUntil })
                          : t('subscription.name')}
                      </span>
                    </span>
                  )}
                  {!plusUntil && (
                    <span className="community__handle">
                      {profile ? `@${profile.handle}` : t('account.menu')}
                    </span>
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
        {shown === 'studio' && <StudioPanel onShowGraph={onShowGraph} />}
        {shown === 'lighting' && <LightingPanel onShowGraph={onShowGraph} />}
        {isAddonPlace(shown) && addon?.Place && accountId && (
          <addon.Place place={shown} accountId={accountId} />
        )}
      </section>
    </div>
  );
}
