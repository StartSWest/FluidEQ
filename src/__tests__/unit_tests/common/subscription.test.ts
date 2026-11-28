/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  formatPlanPrice,
  libraryPlanOfRow,
  minorUnitDigits,
  parseLibraryFields,
  parseLibraryMembership,
  parseLibraryPlans,
  planMonthlyCents,
  yearlySaving,
  type ILibraryPlan,
} from '../../../common/subscription';

// Plus's two fields in `my_store` (premium 0122) and the price rules the
// window shows them by. No amount is written anywhere in the app: these
// read Stripe's.

const MONTHLY: ILibraryPlan = {
  id: 'monthly',
  interval: 'month',
  priceCents: 799,
  currency: 'USD',
};
const YEARLY: ILibraryPlan = {
  id: 'yearly',
  interval: 'year',
  priceCents: 5999,
  currency: 'USD',
};

describe('libraryPlans', () => {
  it('is undefined from a server that sends none, which knows no Plus', () => {
    expect(parseLibraryPlans(undefined)).toBeUndefined();
    expect(parseLibraryPlans({})).toBeUndefined();
  });

  it('lists every plan that reads, month first, once each', () => {
    expect(
      parseLibraryPlans([YEARLY, MONTHLY, { ...MONTHLY, priceCents: 1 }]),
    ).toEqual([MONTHLY, YEARLY]);
    expect(parseLibraryPlans([])).toEqual([]);
  });

  it.each([
    ['an unknown plan', { ...MONTHLY, id: 'weekly' }],
    ['an interval that is not its plan’s', { ...MONTHLY, interval: 'year' }],
    ['a price that is not whole', { ...MONTHLY, priceCents: 7.99 }],
    ['a price of nothing', { ...MONTHLY, priceCents: 0 }],
    ['a currency in lower case', { ...MONTHLY, currency: 'usd' }],
    ['no currency', { ...MONTHLY, currency: undefined }],
    ['not a row', 'monthly'],
  ])('leaves out %s', (_label, row) => {
    expect(parseLibraryPlans([row, YEARLY])).toEqual([YEARLY]);
  });
});

describe('library', () => {
  it('is absent when the server sent none: not subscribed', () => {
    expect(parseLibraryMembership(undefined)).toEqual({ kind: 'absent' });
  });

  it('reads a subscription, its date written the one way', () => {
    expect(
      parseLibraryMembership({
        until: '2026-12-27T12:00:00+00:00',
        renewing: false,
        plan: 'yearly',
      }),
    ).toEqual({
      kind: 'present',
      membership: {
        until: '2026-12-27T12:00:00.000Z',
        renewing: false,
        plan: 'yearly',
      },
    });
  });

  it.each([
    ['null', null],
    [
      'a date that is not one',
      { until: 'soon', renewing: true, plan: 'monthly' },
    ],
    ['no renewal word', { until: '2026-12-27T12:00:00Z', plan: 'monthly' }],
    [
      'an unknown plan',
      { until: '2026-12-27T12:00:00Z', renewing: true, plan: 'x' },
    ],
  ])('reads %s as unreadable, never as not subscribed', (_label, value) => {
    expect(parseLibraryMembership(value)).toEqual({ kind: 'unreadable' });
  });

  it('reads both from one body, and nothing from one that is not an object', () => {
    expect(
      parseLibraryFields({ libraryPlans: [MONTHLY], balance: 3 }, 'live'),
    ).toEqual({ plans: [MONTHLY], membership: { kind: 'absent' } });
    expect(parseLibraryFields(null, 'live')).toEqual({
      plans: undefined,
      membership: { kind: 'absent' },
    });
  });
});

/**
 * Premium 0124 sells Plus in Stripe's test and live modes at once: live
 * plans to everybody in `libraryPlans`, test plans in `libraryTestPlans` to
 * whoever the server sells test mode to. A release reads the live ones exactly
 * as before; `pnpm dev` reads the test ones, so a try never charges a card.
 */
describe('the plans a build buys in its own Stripe mode', () => {
  const TEST_MONTHLY: ILibraryPlan = { ...MONTHLY, priceCents: 100 };
  const both = {
    libraryPlans: [MONTHLY, YEARLY],
    libraryTestPlans: [TEST_MONTHLY],
  };

  it('are the live plans in a release, whatever test plans came with them', () => {
    expect(parseLibraryFields(both, 'live').plans).toEqual([MONTHLY, YEARLY]);
  });

  it('are the test plans in a development build, never the live ones', () => {
    expect(parseLibraryFields(both, 'test').plans).toEqual([TEST_MONTHLY]);
    // No test plans sent: nothing is on sale here - and the live plans
    // beside them are not offered instead.
    expect(
      parseLibraryFields({ libraryPlans: [MONTHLY, YEARLY] }, 'test').plans,
    ).toEqual([]);
  });

  it('say the server knows no Plus in either mode when it sends no live plans', () => {
    expect(
      parseLibraryFields({ libraryTestPlans: [TEST_MONTHLY] }, 'test').plans,
    ).toBeUndefined();
    expect(parseLibraryFields({}, 'live').plans).toBeUndefined();
  });
});

describe('the row’s plan', () => {
  it('names Plus for its two plans alone', () => {
    expect(libraryPlanOfRow('library-monthly')).toBe('monthly');
    expect(libraryPlanOfRow('library-yearly')).toBe('yearly');
  });

  it.each(['plus', 'trial', 'gift', 'maker', '', 'constructor', undefined])(
    'names nothing for %p',
    (plan) => {
      expect(libraryPlanOfRow(plan)).toBeUndefined();
    },
  );
});

describe('prices', () => {
  it('formats Stripe’s amount in the plan’s money and the reader’s language', () => {
    expect(formatPlanPrice(799, 'USD', 'en')).toBe('$7.99');
    expect(formatPlanPrice(5999, 'USD', 'es')).toBe('59,99 US$');
    expect(formatPlanPrice(1200, 'JPY', 'en')).toBe('¥1,200');
    expect(formatPlanPrice(5000, 'KWD', 'en')).toBe('KWD 5.000');
  });

  it('knows each currency’s minor unit', () => {
    expect(minorUnitDigits('USD')).toBe(2);
    expect(minorUnitDigits('JPY')).toBe(0);
    expect(minorUnitDigits('BHD')).toBe(3);
  });

  it('says what a year costs a month', () => {
    expect(planMonthlyCents(MONTHLY)).toBe(799);
    expect(planMonthlyCents(YEARLY)).toBeCloseTo(499.92, 2);
  });

  it('works the yearly saving out from the two prices, rounded down', () => {
    // 12 × 7.99 = 95.88 against 59.99: 37.43% saved, said as 37.
    expect(yearlySaving([MONTHLY, YEARLY])).toEqual({ percent: 37 });
  });

  it.each([
    ['one plan only', [MONTHLY]],
    ['two currencies', [MONTHLY, { ...YEARLY, currency: 'EUR' }]],
    ['a year that saves under 1%', [MONTHLY, { ...YEARLY, priceCents: 9500 }]],
    [
      'a year dearer than twelve months',
      [MONTHLY, { ...YEARLY, priceCents: 9999 }],
    ],
  ])('promises no saving with %s', (_label, plans) => {
    expect(yearlySaving(plans)).toBeUndefined();
  });
});
