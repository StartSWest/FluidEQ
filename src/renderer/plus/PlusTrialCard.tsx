import { useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import type { IPlusTrialOffer } from 'common/plusTrial';
import { STARTER_CREDITS } from 'common/sceneStore';
import { useTranslation } from '../utils/I18nContext';
import Glyph from '../community/Glyph';
import '../styles/PlusTrial.scss';

const COPY: Record<
  'active' | 'ended',
  { title: TranslationKey; body: TranslationKey; fine: TranslationKey }
> = {
  active: {
    title: 'trial.active.title',
    body: 'trial.active.until',
    fine: 'trial.active.body',
  },
  ended: {
    title: 'trial.ended.title',
    body: 'trial.ended.body',
    fine: 'trial.ended.paid',
  },
};

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
 * A free trial already taken, in the gallery: while it runs, and once when it
 * has ended. Plus is not sold any more, so no trial is offered and an ended
 * one leads nowhere but back to the free app — the credits are what gets a
 * scene now.
 */
export function PlusTrialCard({
  offer,
  onKeepFree,
}: {
  offer: IPlusTrialOffer;
  onKeepFree?: () => void;
}) {
  const { t, locale } = useTranslation();
  const [dismissed, setDismissed] = useState<number>();
  if (offer.state !== 'active' && offer.state !== 'ended') {
    return null;
  }
  if (offer.state === 'ended' && dismissed === offer.endsAt) {
    return null;
  }
  const date =
    offer.endsAt === undefined
      ? ''
      : new Intl.DateTimeFormat(locale, {
          dateStyle: 'long',
          timeStyle: 'short',
        }).format(offer.endsAt);
  const ended = offer.state === 'ended';
  const copy = COPY[offer.state];
  return (
    <section className={`plus-trial plus-trial--${offer.state}`}>
      <span className="plus-trial__mark" aria-hidden="true">
        <Glyph name={ended ? 'check' : 'gift'} />
      </span>
      <div className="plus-trial__content">
        <h3>{t(copy.title)}</h3>
        <p>{t(copy.body, { date })}</p>
        <p className="plus-trial__fine">{t(copy.fine)}</p>
        {ended && (
          <div className="plus-trial__actions">
            <button
              type="button"
              className="button small"
              onClick={() => {
                setDismissed(offer.endsAt);
                onKeepFree?.();
              }}
            >
              {t('trial.ended.free')}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
