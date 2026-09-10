import { useEffect, useMemo, useState } from 'react';
import type { IEntitlementStatus } from 'main/account/entitlement';
import type { TBillingFailure } from 'main/account/billingClient';
import type { TranslationKey } from 'common/i18n/en';
import { ACCOUNT_CONFIG, isCheckoutConfigured } from 'common/accountConfig';
import { useTranslation } from '../utils/I18nContext';
import {
  isMembershipSimulatorAvailable,
  openSubscriptionPortal,
  refreshEntitlement,
  simulateMembership,
  type TMembershipSimulation,
} from './entitlementStore';

interface IPlusCardProps {
  entitlement: IEntitlementStatus;
  /** Show the terms, with the agreement that leads to the checkout. */
  onUpgrade: () => void;
  /** The checkout was opened from the terms and is waiting in the browser. */
  checkoutOpened: boolean;
}

const ERROR_KEYS: Record<TBillingFailure, TranslationKey> = {
  network: 'account.error.network',
  signed_out: 'account.error.expired',
  rejected: 'account.plus.error.rejected',
  terms_outdated: 'terms.error.outdated',
};

/**
 * The subscription, inside the account panel.
 *
 * One card, three states, and it is absent entirely when there is nothing to
 * buy — a build with accounts but no price configured is every build until a
 * merchant account exists, and an offer with no way to accept it is a broken
 * button with a paragraph attached.
 *
 * The loud button appears exactly once, on the upgrade. Managing an existing
 * subscription and re-checking a doubtful one are things a person is already
 * committed to; neither needs encouraging.
 *
 * The upgrade does not open the checkout: it opens the terms, and the
 * agreement at their foot does. Nobody pays without having been shown what
 * the app sends and what they are agreeing to.
 *
 * The management page is minted by the server on request, so a press is a
 * round trip before the browser opens. The button says so while it waits — a
 * click that visibly does nothing for a second reads as broken — and a
 * failure is named where it happened rather than left to the silence.
 */
export default function PlusCard({
  entitlement,
  onUpgrade,
  checkoutOpened,
}: IPlusCardProps) {
  const { t, locale } = useTranslation();
  const [opening, setOpening] = useState<
    'portal' | TMembershipSimulation | undefined
  >();
  const [error, setError] = useState<TBillingFailure | undefined>();
  // Development only. Asked once; every packaged build answers no, and the
  // strip below never exists there.
  const [simulator, setSimulator] = useState(false);
  useEffect(() => {
    let alive = true;
    isMembershipSimulatorAvailable()
      .then((available) => {
        if (alive) {
          setSimulator(available);
        }
        return undefined;
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  // The reader's own calendar conventions, from the same locale that chose the
  // words around the date. `dateStyle: 'medium'` is the one that fits on a row
  // in every one of the ten languages without wrapping.
  const dates = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }),
    [locale],
  );
  const format = (epochMs: number | undefined) =>
    epochMs === undefined ? '' : dates.format(new Date(epochMs));

  const open = async (
    which: 'portal' | TMembershipSimulation,
    run: () => Promise<{ ok: boolean; failure?: TBillingFailure }>,
  ) => {
    setOpening(which);
    setError(undefined);
    try {
      const outcome = await run();
      if (!outcome.ok) {
        setError(outcome.failure ?? 'rejected');
      }
    } finally {
      setOpening(undefined);
    }
  };

  if (entitlement.state === 'none' && !isCheckoutConfigured()) {
    return null;
  }

  const manage = (
    <button
      type="button"
      className="button small subtle"
      disabled={opening !== undefined}
      onClick={() => {
        open('portal', openSubscriptionPortal).catch(() => undefined);
      }}
    >
      {opening === 'portal'
        ? t('account.plus.opening')
        : t('account.plus.manage')}
    </button>
  );

  return (
    <section
      className={`plus-card plus-card--${entitlement.state}`}
      aria-labelledby="plus-card-title"
    >
      <div className="plus-card__head">
        <span id="plus-card-title" className="plus-card__eyebrow">
          {t('account.plus.eyebrow')}
        </span>
        {entitlement.state === 'active' && (
          <span className="plus-card__badge">{t('account.plus.active')}</span>
        )}
      </div>

      {entitlement.state === 'none' && (
        <>
          <p className="plus-card__pitch">{t('account.plus.pitch')}</p>
          <p className="plus-card__price">{ACCOUNT_CONFIG.plusPrice}</p>
          <div className="plus-card__actions">
            <button
              type="button"
              className="button small"
              disabled={opening !== undefined}
              onClick={onUpgrade}
            >
              {t('account.plus.upgrade')}
            </button>
          </div>
          {checkoutOpened ? (
            <p className="plus-card__line" role="status">
              {t('account.plus.checkoutOpened')}
            </p>
          ) : (
            <p className="plus-card__hint">{t('account.plus.checkoutHint')}</p>
          )}
        </>
      )}

      {entitlement.state === 'active' && (
        <>
          {/* The development override carries no period; a "Renews" with
              nothing after it read as a broken card. */}
          {entitlement.periodEndsAt !== undefined && (
            <p className="plus-card__line">
              {t(
                entitlement.renewing
                  ? 'account.plus.renews'
                  : 'account.plus.ends',
                { date: format(entitlement.periodEndsAt) },
              )}
            </p>
          )}
          <div className="plus-card__actions">{manage}</div>
        </>
      )}

      {entitlement.state === 'grace' && (
        <>
          <p className="plus-card__line plus-card__line--grace" role="status">
            {t('account.plus.grace', { date: format(entitlement.graceEndsAt) })}
          </p>
          <div className="plus-card__actions">
            <button
              type="button"
              className="button small subtle"
              onClick={() => {
                refreshEntitlement().catch(() => undefined);
              }}
            >
              {t('account.plus.checkAgain')}
            </button>
            {manage}
          </div>
        </>
      )}

      {error && (
        <p className="account__error" role="alert">
          {t(ERROR_KEYS[error])}
        </p>
      )}

      {/* The pretend membership, in development only: the merchant's own
          signed events sent to the real server, so everything after the card
          runs for real. One button for the state the account is not in, so
          it always reads as "switch to the other side". */}
      {simulator && (
        <div className="plus-card__dev">
          <span className="plus-card__dev-label">{t('account.dev.label')}</span>
          {entitlement.state === 'none' ? (
            <button
              type="button"
              className="button small subtle"
              disabled={opening !== undefined}
              onClick={() => {
                open('started', () => simulateMembership('started')).catch(
                  () => undefined,
                );
              }}
            >
              {opening === 'started'
                ? t('account.dev.working')
                : t('account.dev.start')}
            </button>
          ) : (
            <button
              type="button"
              className="button small subtle"
              disabled={opening !== undefined}
              onClick={() => {
                open('cancelled', () => simulateMembership('cancelled')).catch(
                  () => undefined,
                );
              }}
            >
              {opening === 'cancelled'
                ? t('account.dev.working')
                : t('account.dev.cancel')}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
