import type { TranslationKey } from 'common/i18n/en';
import { STARTER_CREDITS } from 'common/sceneStore';
import { requestAccountPanel } from '../account/accountPanel';
import Glyph, { type TCommunityGlyph } from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import { pluralCategory } from '../utils/pluralCategory';
import ground from '../../../assets/plus/gallery-ground.jpg';
import hyperdrive from '../../../assets/plus/hyperdrive.jpg';
import lanternLake from '../../../assets/plus/lantern-lake.jpg';
import nebulaHeart from '../../../assets/plus/nebula-heart.jpg';
import neonHorizon from '../../../assets/plus/neon-horizon.jpg';
import prismBloom from '../../../assets/plus/prism-bloom.jpg';
import reefLight from '../../../assets/plus/reef-light.jpg';
import { landInGalleryOnSignIn } from './signedOutLanding';
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
 * The Visualizers tab before signing in, as Ivan approved it on 2026-11-13
 * (headline 1): the gallery itself behind the app's glass, what needs no
 * account beside what one is for, the scenes and what they do, and the offer
 * of the starter credits as the one loud way in. Narrow, the way in moves
 * under the headline and the offer follows at the end.
 */
export default function VisualizersSignedOut({
  onSignIn,
}: {
  onSignIn: () => void;
}) {
  const { t, locale } = useTranslation();
  const plural = pluralCategory(STARTER_CREDITS, locale);
  const count = { count: String(STARTER_CREDITS) };
  return (
    <div className="signed-out">
      <img className="signed-out__ground" src={ground} alt="" />
      <span className="signed-out__veil" aria-hidden="true" />
      {/* Only the panes scroll; the gallery stays put behind them. */}
      <div className="signed-out__scroll">
        <div className="signed-out__panes">
          <section
            className="signed-out__glass signed-out__main"
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

            <div className="signed-out__split">
              <div className="signed-out__side">
                <span className="signed-out__mark" aria-hidden="true">
                  <Glyph name="music" />
                </span>
                <b>{t('plus.signedOut.free.title')}</b>
                <span>{t('plus.signedOut.free.body')}</span>
              </div>
              <div className="signed-out__side is-account">
                <span className="signed-out__mark" aria-hidden="true">
                  <Glyph name="person" />
                </span>
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
                  className={`signed-out__scene${index === 0 ? ' is-lead' : ''}`}
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
              <ul className="signed-out__chips">
                {PLACES.map((place) => (
                  <li key={place.key} className="signed-out__chip">
                    <Glyph name={place.glyph} />
                    {t(place.key)}
                  </li>
                ))}
              </ul>
            </div>

            <ul className="signed-out__points">
              {POINTS.map((point) => (
                <li key={point.title}>
                  <span className="signed-out__mark" aria-hidden="true">
                    <Glyph name={point.glyph} />
                  </span>
                  <span>
                    <b>{t(point.title)}</b>
                    <span>{t(point.body)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <aside
            className="signed-out__glass signed-out__offer"
            aria-labelledby="signed-out-offer"
          >
            <span className="signed-out__coin" aria-hidden="true">
              <Glyph name="credit" />
              <span>{STARTER_CREDITS}</span>
            </span>
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
          </aside>
        </div>
      </div>
    </div>
  );
}
