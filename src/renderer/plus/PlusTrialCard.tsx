import { useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import { isCheckoutConfigured } from 'common/accountConfig';
import type { IPlusTrialOffer } from 'common/plusTrial';
import { requestAccountPanel } from '../account/accountPanel';
import { useTranslation } from '../utils/I18nContext';
import Glyph from '../community/Glyph';
import { usePlusTrial } from './trialStore';
import '../styles/PlusTrial.scss';

const OFFER_COPY = {
  title: 'trial.offer.title',
  body: 'trial.offer.body',
  fine: 'trial.offer.fine',
} as const;
const COPY: Record<
  'active' | 'ended' | 'eligible' | 'sign-in',
  { title: TranslationKey; body: TranslationKey; fine: TranslationKey }
> = {
  eligible: OFFER_COPY,
  'sign-in': OFFER_COPY,
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
      <p>{t('trial.free.body')}</p>
    </header>
  );
}

/** The same state card in the welcome, gallery and confirmation page. */
export function PlusTrialCard({
  offer,
  onKeepFree,
}: {
  offer: IPlusTrialOffer;
  onKeepFree?: () => void;
}) {
  const { t, locale } = useTranslation();
  const [dismissed, setDismissed] = useState<number>();
  if (offer.state === 'unavailable' || offer.state === 'ineligible') {
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
  const active = offer.state === 'active';
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
        <div className="plus-trial__actions">
          {ended ? (
            <>
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
              {isCheckoutConfigured() && (
                <button
                  type="button"
                  className="button small subtle"
                  onClick={() => requestAccountPanel('subscribe')}
                >
                  {t('trial.ended.plans')}
                </button>
              )}
            </>
          ) : (
            !active && (
              <button
                type="button"
                className="button small"
                onClick={() => requestAccountPanel('trial')}
              >
                {t('trial.offer.action')}
              </button>
            )
          )}
        </div>
      </div>
    </section>
  );
}

export default function PlusTrialOffer({
  onKeepFree,
}: {
  onKeepFree?: () => void;
}) {
  const { offer, owner } = usePlusTrial();
  return offer ? (
    <PlusTrialCard key={owner} offer={offer} onKeepFree={onKeepFree} />
  ) : null;
}
