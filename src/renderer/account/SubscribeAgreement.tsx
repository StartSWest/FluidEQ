import { useState } from 'react';
import type { TBillingFailure } from 'main/account/billingClient';
import type { TranslationKey } from 'common/i18n/en';
import { PLUS_TERMS_VERSION } from 'common/plusTerms';
import { useTranslation } from '../utils/I18nContext';
import { openCheckout } from './entitlementStore';

interface ISubscribeAgreementProps {
  /** Back to the account, having agreed to nothing. */
  onBack: () => void;
  /** The checkout is open in the browser. */
  onOpened: () => void;
}

const ERROR_KEYS: Record<TBillingFailure, TranslationKey> = {
  network: 'account.error.network',
  signed_out: 'account.error.expired',
  rejected: 'account.plus.error.rejected',
  terms_outdated: 'terms.error.outdated',
  price_outdated: 'terms.error.priceOutdated',
};

/**
 * The foot of the terms, when they stand between a person and paying.
 *
 * The box is unticked and the loud button waits for it: agreeing is something
 * a person does, not something a page assumes because it was scrolled past.
 * The version agreed to rides with the request, and the server records it as
 * it opens the checkout, so the record of what was agreed and the payment it
 * led to cannot come apart. Back is the quiet way out and agrees to nothing.
 */
export default function SubscribeAgreement({
  onBack,
  onOpened,
}: ISubscribeAgreementProps) {
  const { t } = useTranslation();
  const [agreed, setAgreed] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<TBillingFailure | undefined>();

  const agree = async () => {
    setOpening(true);
    setError(undefined);
    try {
      const outcome = await openCheckout(PLUS_TERMS_VERSION);
      if (outcome.ok) {
        onOpened();
        return;
      }
      setError(outcome.failure ?? 'rejected');
    } catch {
      // The bridge itself failed; to the person that is the same as the
      // server being out of reach.
      setError('network');
    } finally {
      setOpening(false);
    }
  };

  return (
    <footer className="plus-terms-agree">
      <label
        className={`plus-terms-agree__check${agreed ? ' is-agreed' : ''}`}
        htmlFor="plus-terms-agree"
      >
        <input
          id="plus-terms-agree"
          type="checkbox"
          checked={agreed}
          onChange={(event) => setAgreed(event.target.checked)}
        />
        <span>{t('terms.agree.check')}</span>
      </label>

      {error && (
        <p className="account__error" role="alert">
          {t(ERROR_KEYS[error])}
        </p>
      )}

      <div className="plus-terms-agree__actions">
        <span className="plus-terms-agree__hint">{t('terms.agree.hint')}</span>
        {/* One group, so a narrow panel wraps the sentence above the pair
            rather than splitting Back from the button it stands beside. */}
        <div className="plus-terms-agree__buttons">
          <button
            type="button"
            className="button small subtle"
            onClick={onBack}
          >
            {t('terms.back')}
          </button>
          <button
            type="button"
            className="button small"
            disabled={!agreed || opening}
            onClick={() => {
              agree().catch(() => setOpening(false));
            }}
          >
            {opening ? t('terms.agree.opening') : t('terms.agree.continue')}
          </button>
        </div>
      </div>
    </footer>
  );
}
