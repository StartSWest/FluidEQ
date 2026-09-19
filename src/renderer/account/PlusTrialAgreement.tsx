import { useId, useState } from 'react';
import { PLUS_TERMS_VERSION } from 'common/plusTerms';
import {
  PLUS_TRIAL_TERMS_VERSION,
  type TPlusTrialFailure,
} from 'common/plusTrial';
import { useTranslation } from '../utils/I18nContext';
import {
  activatePlusTrial,
  refreshPlusTrial,
  usePlusTrial,
} from '../plus/trialStore';
import { PlusFreeIntro, PlusTrialCard } from '../plus/PlusTrialCard';
import TRIAL_ERRORS from '../plus/trialErrors';
import PlusTermsDocument from './PlusTermsDocument';

/** The grant is a separate agreement from buying a subscription. */
export default function PlusTrialAgreement({
  onClose,
}: {
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [accepted, setAccepted] = useState(false);
  const { offer, loading, starting, error } = usePlusTrial();
  const currentTerms =
    offer?.termsVersion === PLUS_TERMS_VERSION &&
    offer.trialTermsVersion === PLUS_TRIAL_TERMS_VERSION;
  const refusedActivation =
    error === 'terms-outdated' ||
    error === 'ineligible' ||
    error === 'unavailable' ||
    error === 'signed-out';
  const eligible =
    offer?.state === 'eligible' && currentTerms && !refusedActivation;
  const terminal = offer?.state === 'active' || offer?.state === 'ended';
  const refusal = ((): TPlusTrialFailure | undefined => {
    if (error) {
      return error;
    }
    if (offer?.state === 'ineligible') {
      return 'ineligible';
    }
    if (offer?.state === 'unavailable') {
      return 'unavailable';
    }
    return offer && !currentTerms ? 'terms-outdated' : undefined;
  })();
  return (
    <>
      <div className="about__body account__body account__terms plus-trial-agreement">
        <PlusFreeIntro compact />
        {terminal && offer ? (
          <PlusTrialCard offer={offer} onKeepFree={onClose} />
        ) : (
          <>
            <dl className="plus-trial-summary">
              <div>
                <dt>{t('trial.offer.title')}</dt>
                <dd>{t('trial.consent.period')}</dd>
              </div>
              <div>
                <dt>{t('trial.offer.fine')}</dt>
                <dd>{t('trial.consent.paid')}</dd>
              </div>
            </dl>
            <p>{t('trial.consent.after')}</p>
            <section className="plus-trial-conditions">
              <h3>{t('trial.terms.title')}</h3>
              <p>{t('trial.terms.body')}</p>
              <p>{t('trial.terms.record')}</p>
            </section>
            <details className="plus-trial-document">
              <summary>{t('trial.consent.fullTerms')}</summary>
              <PlusTermsDocument />
            </details>
          </>
        )}
        {loading && !offer && (
          <p role="status">{t('trial.consent.checking')}</p>
        )}
        {refusal && (
          <div className="plus-trial-error">
            <p className="account__error" role="alert">
              {t(TRIAL_ERRORS[refusal])}
            </p>
            {(refusal === 'offline' || refusal === 'server') && (
              <button
                type="button"
                className="button small subtle"
                disabled={loading}
                onClick={refreshPlusTrial}
              >
                {t('trial.retry')}
              </button>
            )}
          </div>
        )}
      </div>
      <footer className="plus-terms-agree">
        {eligible && !terminal && (
          <label
            className={`plus-terms-agree__check${accepted ? ' is-agreed' : ''}`}
            htmlFor={id}
          >
            <input
              id={id}
              type="checkbox"
              checked={accepted}
              disabled={starting}
              onChange={(event) => setAccepted(event.target.checked)}
            />
            <span>{t('trial.consent.checkbox')}</span>
          </label>
        )}
        <div className="plus-terms-agree__actions">
          <span className="plus-terms-agree__hint">
            {t('trial.offer.fine')}
          </span>
          <div className="plus-terms-agree__buttons">
            <button
              type="button"
              className={`button small${terminal || !eligible ? '' : ' subtle'}`}
              onClick={onClose}
            >
              {t(terminal ? 'account.close' : 'trial.ended.free')}
            </button>
            {!terminal && eligible && (
              <button
                type="button"
                className="button small"
                disabled={!accepted || starting}
                onClick={() => activatePlusTrial(accepted)}
              >
                {t(starting ? 'trial.consent.starting' : 'trial.consent.start')}
              </button>
            )}
          </div>
        </div>
      </footer>
    </>
  );
}
