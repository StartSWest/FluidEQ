import { STARTER_CREDITS } from 'common/sceneStore';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import { usePlusEntitled } from './GalleryParts';
import '../styles/GalleryIntro.scss';

/** What the free app is and how scenes are got: credits, the first ones free. */
export function PlusFreeIntro({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  return (
    <header
      className={`plus-free-intro${compact ? ' plus-free-intro--compact' : ''}`}
    >
      <h2>{t('trial.free.title')}</h2>
      <p>{t('trial.free.body', { starterCredits: String(STARTER_CREDITS) })}</p>
    </header>
  );
}

/**
 * At the head of the gallery; never interrupts the free app. How scenes are
 * got, for an account that does not already play every one of them.
 *
 * It carried a free trial's card too, while it ran and once it had ended.
 * Plus is not sold any more and nothing about a subscription is shown (Ivan,
 * 2026-10-21: "no more subs"), so the intro is all that is left.
 */
export default function GalleryIntro() {
  const entitled = usePlusEntitled();
  if (entitled) {
    return null;
  }
  return (
    <section className="gallery-intro">
      <div className="gallery-intro__message">
        <span className="gallery-intro__mark" aria-hidden="true">
          <Glyph name="headphones" />
        </span>
        <PlusFreeIntro compact />
      </div>
    </section>
  );
}
