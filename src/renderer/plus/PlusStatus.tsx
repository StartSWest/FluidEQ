/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISubscriptionState } from 'common/subscription';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import GetPlusButton from './GetPlusButton';
import PlusMark from './PlusMark';
import { usePlusBackFromCheckout } from './plusSubscriptionStore';
import {
  planName,
  planNote,
  planPriceText,
  planSaving,
  plusDate,
} from './plusWords';

/** A member's Plus: the plan, the date it renews or ends, and what that means. */
function MemberStatus({ plus }: { plus: ISubscriptionState }) {
  const { t, locale } = useTranslation();
  const { status } = plus;
  const until = status?.until ? plusDate(status.until, locale) : undefined;
  const plan = status?.plan ? planName(t, status.plan) : undefined;
  const renewing = status?.renewing !== false;
  let title = t('subscription.status.member');
  if (plan && until) {
    title = t(
      renewing ? 'subscription.status.renews' : 'subscription.status.ends',
      { plan, date: until },
    );
  }
  return (
    <section className="plus-status plus-status--member">
      <div className="plus-status__words">
        <h3 className="plus-status__title">{title}</h3>
        <p className="plus-status__note">
          {/* The date is in the title already; the note says what it means. */}
          {t(
            renewing || !until
              ? 'subscription.status.renewsNote'
              : 'subscription.status.endsNote',
          )}
        </p>
        {status?.graceUntil && (
          <p className="plus-status__note plus-status__note--warn">
            <Glyph name="alert" />
            {t('subscription.status.grace', {
              date: plusDate(status.graceUntil, locale),
            })}
          </p>
        )}
      </div>
      <span className="plus-status__chip">
        {t('subscription.status.member')}
      </span>
    </section>
  );
}

/**
 * The plans on sale, side by side, each opening the sheet on itself: the
 * offer as the page makes it, where the account has no Plus.
 */
function PlanOffer({ plus }: { plus: ISubscriptionState }) {
  const { t, locale } = useTranslation();
  return (
    <section className="plus-offer" aria-label={t('subscription.sheet.choose')}>
      {plus.plans.map((plan) => {
        const saving = planSaving(t, plus.plans, plan);
        return (
          <div
            key={plan.id}
            className={`plus-offer__plan${saving ? ' is-saving' : ''}`}
          >
            <span className="plus-offer__name">{planName(t, plan.id)}</span>
            <span className="plus-offer__price">
              {planPriceText(t, plan, locale)}
            </span>
            <span className="plus-offer__note">
              {planNote(t, plan, locale)}
            </span>
            {saving && <span className="plus-offer__saving">{saving}</span>}
            <GetPlusButton
              plan={plan.id}
              label={t(
                plus.lapse ? 'subscription.getAgain' : 'subscription.get',
              )}
              className={`button small${saving ? '' : ' subtle'}`}
            />
          </div>
        );
      })}
    </section>
  );
}

/**
 * Where the account stands with Plus, at the head of Plus's page: a member's
 * plan and dates, the end of one, the plans on sale, or why there are none.
 */
export default function PlusStatus({ plus }: { plus: ISubscriptionState }) {
  const { t } = useTranslation();
  const backFromCheckout = usePlusBackFromCheckout();
  if (plus.subscribed) {
    return <MemberStatus plus={plus} />;
  }
  if (backFromCheckout) {
    return (
      <section className="plus-status" role="status">
        <span className="store-status__spinner" aria-hidden="true" />
        <p className="plus-status__note">{t('subscription.status.waiting')}</p>
      </section>
    );
  }
  if (plus.suspended) {
    return (
      <section className="plus-status">
        <p className="plus-status__note">{t('subscription.error.banned')}</p>
      </section>
    );
  }
  const onSale = plus.plans.length > 0;
  return (
    <>
      {plus.lapse && (
        <section className="plus-status plus-status--ended">
          <PlusMark className="plus-status__mark" />
          <div className="plus-status__words">
            <h3 className="plus-status__title">
              {t('subscription.status.ended.title')}
            </h3>
            <p className="plus-status__note">
              {t('subscription.status.ended.body')}
            </p>
          </div>
        </section>
      )}
      {onSale ? (
        <PlanOffer plus={plus} />
      ) : (
        <section className="plus-status">
          <p className="plus-status__note">
            {t('subscription.error.notOnSale')}
          </p>
        </section>
      )}
    </>
  );
}
