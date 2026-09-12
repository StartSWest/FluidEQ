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
  plus: boolean;
}[] = [
  { glyph: 'looks', key: 'plus.welcome.browse', plus: false },
  { glyph: 'headphones', key: 'plus.welcome.play', plus: true },
  { glyph: 'studio', key: 'plus.welcome.studio', plus: true },
  { glyph: 'board', key: 'plus.welcome.board', plus: true },
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
          <h2 className="plus-welcome__title">{t('plus.welcome.title')}</h2>
          <ul className="plus-welcome__perks">
            {PERKS.map((perk) => (
              <li key={perk.key}>
                <span className="plus-welcome__perk-mark" aria-hidden="true">
                  <Glyph name={perk.glyph} />
                </span>
                <span>{t(perk.key)}</span>
                {perk.plus && (
                  <span className="community__role">
                    {t('graph.scene.badge')}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <dl className="plus-welcome__access">
            <div>
              <dt>{t('plus.welcome.account.label')}</dt>
              <dd>{t('plus.welcome.account.access')}</dd>
            </div>
            <div>
              <dt>{t('plus.welcome.paid.label')}</dt>
              <dd>{t('plus.welcome.paid.access')}</dd>
            </div>
          </dl>
          <button
            type="button"
            className="button plus-welcome__button"
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
