/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TBillingOutcome } from '../../../main/ipc/account';
import PlusCard from '../../../renderer/account/PlusCard';

let mockCheckoutConfigured = true;
let mockPrice = '$3.99';
let mockYearlyPrice = '';
const mockOpenCheckout = jest.fn((): Promise<TBillingOutcome> =>
  Promise.resolve({ ok: true }),
);
const mockOpenPortal = jest.fn((): Promise<TBillingOutcome> =>
  Promise.resolve({ ok: true }),
);
const mockRefresh = jest.fn(() => Promise.resolve());

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

jest.mock('../../../common/accountConfig', () => ({
  get ACCOUNT_CONFIG() {
    return { plusPrice: mockPrice, plusYearlyPrice: mockYearlyPrice };
  },
  isCheckoutConfigured: () => mockCheckoutConfigured,
}));

jest.mock('../../../renderer/account/entitlementStore', () => ({
  openCheckout: () => mockOpenCheckout(),
  openSubscriptionPortal: () => mockOpenPortal(),
  refreshEntitlement: () => mockRefresh(),
  // A packaged build: the pretend-membership strip never appears.
  isMembershipSimulatorAvailable: () => Promise.resolve(false),
  simulateMembership: () => Promise.resolve({ ok: false }),
}));

const JUNE_FIRST = Date.UTC(2027, 5, 1, 12);
const onUpgrade = jest.fn();

describe('the Plus card', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckoutConfigured = true;
    mockPrice = '$3.99';
    mockYearlyPrice = '';
  });

  it('quotes the yearly plan beside the monthly one when the build has one', () => {
    mockPrice = '$5';
    mockYearlyPrice = '$40';
    render(
      <PlusCard
        entitlement={{ state: 'none' }}
        onUpgrade={onUpgrade}
        checkoutOpened={false}
      />,
    );
    expect(
      screen.getByText(
        'account.plus.priceChoice:account.plus.perMonth:$5,account.plus.perYear:$40',
      ),
    ).toBeInTheDocument();
  });

  /**
   * A build with accounts but nothing to buy is every build until a merchant
   * account exists. An offer with no way to accept it is a broken button with
   * a paragraph attached.
   */
  it('is absent entirely when there is nothing to buy', () => {
    mockCheckoutConfigured = false;
    const { container } = render(
      <PlusCard
        entitlement={{ state: 'none' }}
        onUpgrade={onUpgrade}
        checkoutOpened={false}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  /**
   * The upgrade leads to the terms, never straight to the checkout: nobody
   * pays without having been shown what they agree to and what is sent.
   */
  it('offers the upgrade with the loud style and the price, and asks for the terms rather than the checkout', async () => {
    render(
      <PlusCard
        entitlement={{ state: 'none' }}
        onUpgrade={onUpgrade}
        checkoutOpened={false}
      />,
    );

    expect(screen.getByText('account.plus.pitch')).toBeInTheDocument();
    // The amount as configured, the month in the reader's language.
    expect(screen.getByText('account.plus.perMonth:$3.99')).toBeInTheDocument();
    const upgrade = screen.getByRole('button', {
      name: 'account.plus.upgrade',
    });
    expect(upgrade).toHaveClass('button', 'small');
    expect(upgrade).not.toHaveClass('subtle');

    await userEvent.click(upgrade);
    expect(onUpgrade).toHaveBeenCalledTimes(1);
    expect(mockOpenCheckout).not.toHaveBeenCalled();
  });

  it('says the checkout is waiting in the browser once the terms opened it', () => {
    render(
      <PlusCard
        entitlement={{ state: 'none' }}
        onUpgrade={onUpgrade}
        checkoutOpened
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'account.plus.checkoutOpened',
    );
    expect(screen.queryByText('account.plus.checkoutHint')).toBeNull();
  });

  it('shows an active subscription with its renewal date and a quiet manage button', async () => {
    render(
      <PlusCard
        entitlement={{
          state: 'active',
          renewing: true,
          periodEndsAt: JUNE_FIRST,
        }}
        onUpgrade={onUpgrade}
        checkoutOpened={false}
      />,
    );

    expect(screen.getByText('account.plus.active')).toBeInTheDocument();
    // The date is rendered in the reader's own calendar conventions, so the
    // assertion is on the key and on the year rather than on one format.
    expect(
      screen.getByText(/account\.plus\.renews:.*2027/),
    ).toBeInTheDocument();
    const manage = screen.getByRole('button', { name: 'account.plus.manage' });
    expect(manage).toHaveClass('subtle');
    expect(
      screen.queryByRole('button', { name: 'account.plus.upgrade' }),
    ).not.toBeInTheDocument();

    await userEvent.click(manage);
    expect(mockOpenPortal).toHaveBeenCalled();
  });

  it('says a cancelled subscription ends rather than renews', () => {
    render(
      <PlusCard
        entitlement={{
          state: 'active',
          renewing: false,
          periodEndsAt: JUNE_FIRST,
        }}
        onUpgrade={onUpgrade}
        checkoutOpened={false}
      />,
    );
    expect(screen.getByText(/account\.plus\.ends:/)).toBeInTheDocument();
    // Still manageable: this is where somebody changes their mind.
    expect(
      screen.getByRole('button', { name: 'account.plus.manage' }),
    ).toHaveClass('subtle');
  });

  it('explains a grace period, names its end, and offers to check again', async () => {
    render(
      <PlusCard
        entitlement={{ state: 'grace', graceEndsAt: JUNE_FIRST }}
        onUpgrade={onUpgrade}
        checkoutOpened={false}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent(
      /account\.plus\.grace:.*2027/,
    );
    const again = screen.getByRole('button', {
      name: 'account.plus.checkAgain',
    });
    expect(again).toHaveClass('subtle');

    await userEvent.click(again);
    expect(mockRefresh).toHaveBeenCalled();
  });
});
