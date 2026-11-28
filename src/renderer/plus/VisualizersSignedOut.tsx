import type { TranslationKey } from 'common/i18n/en';
import { STARTER_CREDITS } from 'common/sceneStore';
import { requestAccountPanel } from '../account/accountPanel';
import Glyph, { type TCommunityGlyph } from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import { pluralCategory } from '../utils/pluralCategory';
import useShown from '../utils/useShown';
import ground from '../../../assets/plus/gallery-ground.jpg';
import hyperdrive from '../../../assets/plus/hyperdrive.jpg';
import lanternLake from '../../../assets/plus/lantern-lake.jpg';
import nebulaHeart from '../../../assets/plus/nebula-heart.jpg';
import neonHorizon from '../../../assets/plus/neon-horizon.jpg';
import prismBloom from '../../../assets/plus/prism-bloom.jpg';
import reefLight from '../../../assets/plus/reef-light.jpg';
import CreditCoin from './CreditCoin';
import { landInGalleryOnSignIn } from './signedOutLanding';
import SignedOutPlus from './SignedOutPlus';
import '../styles/VisualizersSignedOutOffer.scss';
import '../styles/VisualizersSignedOut.scss';

/**
 * Six of FluidEQ's scenes, as pictures: frames of the real scenes, shipped
 * as images, so the page needs no GPU and no server. The first leads the
 * wall. No scene's clip is shipped, and asking the server for one needs the
 * scene as the gallery lists it, which this page has not been given.
 */
const WALL: readonly { key: TranslationKey; picture: string }[] = [
  { key: 'plus.welcome.scene.neonHorizon', picture: neonHorizon },
  { key: 'plus.welcome.scene.nebulaHeart', picture: nebulaHeart },
  { key: 'plus.welcome.scene.lanternLake', picture: lanternLake },
  { key: 'plus.welcome.scene.hyperdrive', picture: hyperdrive },
  { key: 'plus.welcome.scene.reefLight', picture: reefLight },
  { key: 'plus.welcome.scene.prismBloom', picture: prismBloom },
];

/** Three of the wall's scenes for the offer's fan, left to right. */
const FAN = [WALL[1], WALL[0], WALL[4]];

const PLACES: readonly { glyph: TCommunityGlyph; key: TranslationKey }[] = [
  { glyph: 'graph-play', key: 'plus.signedOut.place.graph' },
  { glyph: 'monitor', key: 'plus.signedOut.place.desktop' },
  { glyph: 'lighting', key: 'plus.signedOut.place.lights' },
];

const POINTS: readonly {
  glyph: TCommunityGlyph;
  title: TranslationKey;
  body: TranslationKey;
}[] = [
  {
    glyph: 'looks',
    title: 'plus.signedOut.gallery.title',
    body: 'plus.signedOut.gallery.body',
  },
  {
    glyph: 'studio',
    title: 'plus.signedOut.studio.title',
    body: 'plus.signedOut.studio.body',
  },
  {
    glyph: 'general',
    title: 'plus.signedOut.forum.title',
    body: 'plus.signedOut.forum.body',
  },
];

const STEPS: readonly TranslationKey[] = [
  'plus.signedOut.step.create',
  'plus.signedOut.step.confirm',
  'plus.signedOut.step.pick',
];

/** Creating an account from here lands in the gallery once it is done. */
const createAccount = () => {
  landInGalleryOnSignIn();
  requestAccountPanel('signUp');
};

/** The loud way in, the reward in the button itself. */
function CreateButton({ size }: { size: 'l' | 'm' }) {
  const { t, locale } = useTranslation();
  const plural = pluralCategory(STARTER_CREDITS, locale);
  return (
    <button
      type="button"
      className={`button signed-out__create signed-out__create--${size}`}
      onClick={createAccount}
    >
      <span className="signed-out__create-main">
        {t('plus.signedOut.create')}
      </span>
      <span className="signed-out__create-sub">
        <Glyph name="credit" />
        {t(`plus.signedOut.createSub.${plural}` as TranslationKey, {
          count: String(STARTER_CREDITS),
        })}
      </span>
    </button>
  );
}

function SignInLink({ onSignIn }: { onSignIn: () => void }) {
  const { t } = useTranslation();
  return (
    <p className="signed-out__sign-in">
      {t('plus.signedOut.haveAccount')}{' '}
      <button
        type="button"
        className="account-link"
        onClick={() => {
          landInGalleryOnSignIn();
          onSignIn();
        }}
      >
        {t('account.signIn')}
      </button>
    </p>
  );
}

/**
 * The Scenes tab before signing in: the gallery behind, and over it one flat
 * modal, the Library's card (Ivan, 2026-11-25, mockup A of three: "a single
 * modal like the library screen", "with only the divider"). The scenes and
 * what they do on the left; the offer of the starter credit as the one loud
 * way in on the right, with what an account opens under it, so the two
 * halves end together. Narrow, it folds to one column: the way in moves
 * under the headline and the offer follows the scenes.
 *
 * The lead picture's drift and the coin's motion stand still while nobody
 * can see them (`useShown`), and with the app's Animations switch.
 */
export default function VisualizersSignedOut({
  onSignIn,
}: {
  onSignIn: () => void;
}) {
  const { t, locale } = useTranslation();
  const plural = pluralCategory(STARTER_CREDITS, locale);
  const count = { count: String(STARTER_CREDITS) };
  const [leadRef, leadShown] = useShown<HTMLElement>();
  const [fanRef, fanShown] = useShown<HTMLDivElement>();
  return (
    <div className="signed-out">
      <img className="signed-out__ground" src={ground} alt="" />
      <span className="signed-out__veil" aria-hidden="true" />
      {/* Only the modal scrolls; the gallery stays put behind it. */}
      <div className="signed-out__scroll">
        <div className="signed-out__modal">
          <section
            className="signed-out__story"
            aria-labelledby="signed-out-title"
          >
            <span className="signed-out__eyebrow">
              <Glyph name="looks" />
              {t('tabs.plus')}
            </span>
            <h2 className="signed-out__title" id="signed-out-title">
              {t(`plus.signedOut.title.${plural}` as TranslationKey, count)}
            </h2>
            <p className="signed-out__line">{t('plus.signedOut.line')}</p>

            {/* What needs no account and what one is for: words and a glyph
                each, no tile. The account's glyph is lit, as the side being
                offered. */}
            <div className="signed-out__sides">
              <div className="signed-out__side">
                <Glyph name="music" className="signed-out__glyph" />
                <b>{t('plus.signedOut.free.title')}</b>
                <span>{t('plus.signedOut.free.body')}</span>
              </div>
              <div className="signed-out__side is-account">
                <Glyph name="person" className="signed-out__glyph" />
                <b>{t('plus.signedOut.account.title')}</b>
                <span>{t('plus.signedOut.account.body')}</span>
              </div>
            </div>

            <div className="signed-out__quick">
              <CreateButton size="m" />
              <SignInLink onSignIn={onSignIn} />
            </div>

            <div className="signed-out__wall">
              {WALL.map((scene, index) => (
                <figure
                  key={scene.key}
                  ref={index === 0 ? leadRef : undefined}
                  className={`signed-out__scene${
                    index === 0 ? ` is-lead${leadShown ? '' : ' is-still'}` : ''
                  }`}
                >
                  <img src={scene.picture} alt="" />
                  <figcaption>{t(scene.key)}</figcaption>
                </figure>
              ))}
            </div>

            <div className="signed-out__places">
              <span className="signed-out__places-title">
                {t('plus.signedOut.places')}
              </span>
              <ul className="signed-out__place-list">
                {PLACES.map((place) => (
                  <li key={place.key}>
                    <Glyph name={place.glyph} className="signed-out__glyph" />
                    {t(place.key)}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <aside
            className="signed-out__offer"
            aria-labelledby="signed-out-offer"
          >
            {/* The three scenes the credit is for, fanned like a hand of
                cards behind the coin. */}
            <div
              ref={fanRef}
              className={`signed-out__fan${fanShown ? '' : ' is-still'}`}
            >
              {FAN.map((scene) => (
                <img key={scene.key} src={scene.picture} alt="" />
              ))}
              <CreditCoin size="l" badge={STARTER_CREDITS} />
            </div>
            <h3 className="signed-out__offer-title" id="signed-out-offer">
              {t(
                `plus.signedOut.offerTitle.${plural}` as TranslationKey,
                count,
              )}
            </h3>
            <p className="signed-out__offer-body">
              {t('plus.signedOut.offerBody')}
            </p>
            <CreateButton size="l" />
            <ol className="signed-out__steps">
              {STEPS.map((step, index) => (
                <li key={step}>
                  <span className="signed-out__step-n">{index + 1}</span>
                  {t(step)}
                </li>
              ))}
            </ol>
            <SignInLink onSignIn={onSignIn} />

            {/* Plus, under the free offer that stays the lead: every scene,
                in both apps, got once signed in. */}
            <SignedOutPlus onSignIn={onSignIn} />

            {/* What an account opens, under the offer it is for: it fills
                what was the offer pane's empty middle, and the two halves
                end together. */}
            <ul className="signed-out__points">
              {POINTS.map((point) => (
                <li key={point.title}>
                  <Glyph name={point.glyph} className="signed-out__glyph" />
                  <span>
                    <b>{t(point.title)}</b>
                    <span>{t(point.body)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </div>
    </div>
  );
}
