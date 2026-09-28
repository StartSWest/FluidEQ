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

/**
 * What the offer allows right now, read the same way by the page and by its
 * foot: the two are drawn in different parts of the Account panel's frame,
 * and a page that offered the trial above a foot that had stopped offering it
 * would be two answers to one question.
 */
const useTrialAgreement = () => {
  const trial = usePlusTrial();
  const { offer, error } = trial;
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
  return { ...trial, eligible, terminal, refusal };
};

/**
 * The free trial's page of the Account panel: what it is, its conditions and
 * the full terms. The grant is a separate agreement from buying a
 * subscription, and it is agreed to in the panel's foot
 * (`PlusTrialConsent`).
 */
export default function PlusTrialAgreement({
  onClose,
}: {
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { offer, loading, terminal, refusal } = useTrialAgreement();
  return (
    <div className="plus-trial-agreement">
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
      {loading && !offer && <p role="status">{t('trial.consent.checking')}</p>}
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
  );
}

/**
 * The free trial's agreement, in the panel's foot: an unticked box, and the
 * start waiting for it. Keeping free is the quiet answer beside it — and the
 * only answer, filled, once there is nothing to start.
 */
export function PlusTrialConsent({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const id = useId();
  const [accepted, setAccepted] = useState(false);
  const { starting, eligible, terminal } = useTrialAgreement();
  return (
    <>
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
      <p className="dialog-frame__note">{t('trial.offer.fine')}</p>
      <div className="dialog-frame__actions">
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
    </>
  );
}
