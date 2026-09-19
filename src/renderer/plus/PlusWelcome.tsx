import type { TranslationKey } from 'common/i18n/en';
import { requestAccountPanel } from '../account/accountPanel';
import hyperdrive from '../../../assets/plus/hyperdrive.jpg';
import lanternLake from '../../../assets/plus/lantern-lake.jpg';
import nebulaHeart from '../../../assets/plus/nebula-heart.jpg';
import neonHorizon from '../../../assets/plus/neon-horizon.jpg';
import prismBloom from '../../../assets/plus/prism-bloom.jpg';
import reefLight from '../../../assets/plus/reef-light.jpg';
import Glyph, { type TCommunityGlyph } from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import PlusTrialOffer, { PlusFreeIntro } from './PlusTrialCard';
import '../styles/PlusWelcome.scss';

/**
 * Six Plus scenes, as pictures. Frames of the real scenes, taken once and
 * shipped as images: the page needs no GPU and no server, and the scenes'
 * own code stays in the Plus collection rather than in the free app.
 */
const SCENES: readonly { key: TranslationKey; picture: string }[] = [
  { key: 'plus.welcome.scene.neonHorizon', picture: neonHorizon },
  { key: 'plus.welcome.scene.nebulaHeart', picture: nebulaHeart },
  { key: 'plus.welcome.scene.lanternLake', picture: lanternLake },
  { key: 'plus.welcome.scene.hyperdrive', picture: hyperdrive },
  { key: 'plus.welcome.scene.reefLight', picture: reefLight },
  { key: 'plus.welcome.scene.prismBloom', picture: prismBloom },
];

/** What signing in opens, and which of it takes Plus. */
const PERKS: readonly {
  glyph: TCommunityGlyph;
  key: TranslationKey;
}[] = [
  { glyph: 'looks', key: 'trial.extras.scenes' },
  { glyph: 'studio', key: 'trial.extras.studio' },
  { glyph: 'lighting', key: 'trial.extras.desktop' },
  { glyph: 'headphones', key: 'trial.extras.room' },
  { glyph: 'board', key: 'trial.extras.board' },
];

/**
 * The Plus tab before signing in: one page — the scenes members make, what
 * an account opens and what Plus adds, and the way in.
 */
export default function PlusWelcome({ onSignIn }: { onSignIn: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="plus-welcome">
      <div className="plus-welcome__inner">
        <PlusFreeIntro />
        <div className="plus-welcome__scenes" aria-hidden="true">
          {/* The scenes' own light on the wall behind them: the lead
              picture again, blown up and blurred to a glow. */}
          <img className="plus-welcome__glow" src={SCENES[0].picture} alt="" />
          {SCENES.map((scene) => (
            <figure key={scene.key} className="plus-welcome__scene">
              <img src={scene.picture} alt="" />
              <figcaption>{t(scene.key)}</figcaption>
            </figure>
          ))}
        </div>
        <div className="plus-welcome__text">
          <span className="plus-welcome__brand">
            <span className="plus-welcome__brand-mark" aria-hidden="true">
              <Glyph name="plus" />
            </span>
            {t('account.plus.eyebrow')}
          </span>
          <h3 className="plus-welcome__title">{t('trial.extras.title')}</h3>
          <ul className="plus-welcome__perks">
            {PERKS.map((perk) => (
              <li key={perk.key}>
                <span className="plus-welcome__perk-mark" aria-hidden="true">
                  <Glyph name={perk.glyph} />
                </span>
                <span>{t(perk.key)}</span>
              </li>
            ))}
          </ul>
          <PlusTrialOffer />
          <p className="gallery-fine">{t('trial.browse')}</p>
          <button
            type="button"
            className="button subtle plus-welcome__button"
            onClick={onSignIn}
          >
            {t('account.signIn')}
          </button>
          <button
            type="button"
            className="account-link"
            onClick={() => requestAccountPanel('signUp')}
          >
            {t('plus.welcome.fine')}
          </button>
        </div>
      </div>
    </div>
  );
}
