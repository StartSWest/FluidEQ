/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import type { ISubscriptionState } from '../../../common/subscription';
import AccountPlusCard from '../../../renderer/account/AccountPlusCard';
import PlusGalleryHead from '../../../renderer/plus/PlusGalleryHead';
import { resetPlusSubscriptionStore } from '../../../renderer/plus/plusSubscriptionStore';

// Every word shows as its key and its values, so a test reads which line is
// on screen and with what date.
jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

const plans: ISubscriptionState['plans'] = [
  { id: 'monthly', interval: 'month', priceCents: 799, currency: 'USD' },
  { id: 'yearly', interval: 'year', priceCents: 5999, currency: 'USD' },
];
const until = '2026-12-27T12:00:00Z';
const renewing: ISubscriptionState = {
  signedIn: true,
  plans,
  subscribed: true,
  manageable: true,
  status: { plan: 'monthly', until, renewing: true },
};
const cancelled: ISubscriptionState = {
  ...renewing,
  status: { plan: 'monthly', until, renewing: false },
};
const lapsed: ISubscriptionState = {
  signedIn: true,
  plans,
  subscribed: false,
  manageable: false,
  lapse: {
    id: 'lapse-1',
    at: '2026-12-27T13:00:00Z',
    scenes: [{ lookId: 'member:a:b', names: { en: 'Aurora' } }],
  },
};

let push: (next: ISubscriptionState) => void = () => {};
const managePlus = jest.fn(() => Promise.resolve('opened'));

const showWith = (first: ISubscriptionState) => {
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      ipcRenderer: {
        getPlusState: () => Promise.resolve(first),
        onPlusChanged: (listener: (next: ISubscriptionState) => void) => {
          push = listener;
          return () => {};
        },
        onPlusReturned: () => () => {},
        managePlus,
      },
    },
  });
  return render(
    <>
      <PlusGalleryHead />
      <AccountPlusCard />
    </>,
  );
};

const change = (next: ISubscriptionState) =>
  act(() => {
    push(next);
  });

beforeEach(() => {
  resetPlusSubscriptionStore();
  managePlus.mockClear();
});

/**
 * Ivan, 2026-11-28: "when user cancel sub fluid needs to know and show renew
 * etc". Main reads the cancellation (the webhook's row through my_store, or
 * the re-read on coming back from Stripe's portal with no push, held by
 * plusSubscriptionAccount's tests) and sends it; these hold what the window
 * then says, everywhere Plus shows, and that it follows every change
 * without a restart.
 */
describe('Plus cancelled, renewed and ended', () => {
  it('says "Renews on" and offers Manage Plus while Plus renews', async () => {
    showWith(renewing);
    expect(
      await screen.findAllByText(/subscription\.(line|account)\.renews:/),
    ).toHaveLength(2);
    expect(
      screen.getAllByRole('button', { name: 'subscription.manage' }),
    ).toHaveLength(2);
    expect(screen.queryByText(/\.ends:/)).toBeNull();
  });

  it('switches to "Ends on" with Renew Plus the moment it is cancelled, and Renew opens the portal', async () => {
    showWith(renewing);
    await screen.findAllByText(/\.renews:/);
    change(cancelled);
    expect(
      screen.getAllByText(/subscription\.(line|account)\.ends:/),
    ).toHaveLength(2);
    // Still every scene: the member's line and pass stay, no offer.
    expect(screen.getByText('subscription.account.yours')).toBeInTheDocument();
    expect(screen.queryByText('subscription.banner.title')).toBeNull();
    const renew = screen.getAllByRole('button', { name: 'subscription.renew' });
    expect(renew).toHaveLength(2);
    expect(
      screen.queryByRole('button', { name: 'subscription.manage' }),
    ).toBeNull();
    await act(async () => {
      renew[1].click();
    });
    expect(managePlus).toHaveBeenCalledTimes(1);
  });

  it('goes back to "Renews on" when it is renewed, without a restart', async () => {
    showWith(cancelled);
    await screen.findAllByText(/\.ends:/);
    change(renewing);
    expect(screen.getAllByText(/\.renews:/)).toHaveLength(2);
    expect(
      screen.queryByRole('button', { name: 'subscription.renew' }),
    ).toBeNull();
  });

  it('reads as ended once main confirms the end: Get Plus again in the panel, no member line', async () => {
    showWith(cancelled);
    await screen.findAllByText(/\.ends:/);
    change(lapsed);
    expect(screen.queryByText(/\.ends:/)).toBeNull();
    expect(screen.queryByText('subscription.account.yours')).toBeNull();
    // The gallery's head leaves the room to the lapse card; the panel offers
    // Plus again.
    expect(
      screen.getByRole('button', { name: 'subscription.getAgain' }),
    ).toBeInTheDocument();
  });
});
