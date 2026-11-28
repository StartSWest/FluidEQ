/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { Translate } from 'common/i18n';
import {
  formatPlanPrice,
  planMonthlyCents,
  yearlySaving,
  type ILibraryPlan,
  type TLibraryPlanId,
} from 'common/subscription';

/**
 * How Plus's prices and dates are said, the same way on every surface that
 * says them: the rail's page, the sheet, the gallery's strip and a scene's
 * page. Every amount is Stripe's own, never a number written here.
 */

/** "Monthly", "Yearly". */
export const planName = (t: Translate, plan: TLibraryPlanId): string =>
  t(
    plan === 'monthly'
      ? 'subscription.plan.monthly'
      : 'subscription.plan.yearly',
  );

/** "$7.99 a month", "$59.99 a year". */
export const planPriceText = (
  t: Translate,
  plan: ILibraryPlan,
  locale: string,
): string => {
  const price = formatPlanPrice(plan.priceCents, plan.currency, locale);
  return t(
    plan.interval === 'year'
      ? 'subscription.plan.perYear'
      : 'subscription.plan.perMonth',
    { price },
  );
};

/** "$7.99 a month or $59.99 a year", or the one plan on sale. */
export const plansText = (
  t: Translate,
  plans: readonly ILibraryPlan[],
  locale: string,
): string => {
  const monthly = plans.find((plan) => plan.id === 'monthly');
  const yearly = plans.find((plan) => plan.id === 'yearly');
  if (monthly && yearly) {
    return t('subscription.plan.both', {
      monthly: formatPlanPrice(monthly.priceCents, monthly.currency, locale),
      yearly: formatPlanPrice(yearly.priceCents, yearly.currency, locale),
    });
  }
  const only = monthly ?? yearly;
  return only ? planPriceText(t, only, locale) : '';
};

/**
 * The one price a line too short for both says: the month's, which is what
 * Plus costs to start, or the year's when it is the only plan on sale.
 */
export const startingPriceText = (
  t: Translate,
  plans: readonly ILibraryPlan[],
  locale: string,
): string => {
  const plan = plans.find((each) => each.id === 'monthly') ?? plans[0];
  return plan ? planPriceText(t, plan, locale) : '';
};

/**
 * Under a plan's price: what a year comes to a month, or that it stops
 * anytime. The month is rounded up — $59.99 a year is $4.9992 a month, said
 * as $5.00 — so the line never names less than the plan costs.
 */
export const planNote = (
  t: Translate,
  plan: ILibraryPlan,
  locale: string,
): string =>
  plan.interval === 'year'
    ? t('subscription.plan.monthlyEquivalent', {
        price: formatPlanPrice(
          Math.ceil(planMonthlyCents(plan)),
          plan.currency,
          locale,
        ),
      })
    : t('subscription.plan.cancelAnytime');

/** "Save 37%" on the year, when it saves; never more than it does. */
export const planSaving = (
  t: Translate,
  plans: readonly ILibraryPlan[],
  plan: ILibraryPlan,
): string | undefined => {
  const saving = plan.id === 'yearly' ? yearlySaving(plans) : undefined;
  return saving
    ? t('subscription.plan.save', { percent: String(saving.percent) })
    : undefined;
};

/** The plan a choice opens on: the year when it saves, else the first. */
export const initialPlan = (
  plans: readonly ILibraryPlan[],
): TLibraryPlanId | undefined =>
  yearlySaving(plans) && plans.some((plan) => plan.id === 'yearly')
    ? 'yearly'
    : plans[0]?.id;

/** A date as the reader writes it: "December 27, 2026". */
export const plusDate = (iso: string, locale: string): string =>
  new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date(iso));
