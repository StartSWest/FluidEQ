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

let mockSimulator = false;
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

jest.mock('../../../renderer/account/entitlementStore', () => ({
  openSubscriptionPortal: () => mockOpenPortal(),
  refreshEntitlement: () => mockRefresh(),
  // A packaged build unless a test says otherwise: no pretend-membership strip.
  isMembershipSimulatorAvailable: () => Promise.resolve(mockSimulator),
  simulateMembership: () => Promise.resolve({ ok: false }),
}));

const JUNE_FIRST = Date.UTC(2027, 5, 1, 12);

describe('the Plus card', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSimulator = false;
  });

  /**
   * Plus is not sold any more (credits replaced it): an account without a
   * membership is offered nothing here, not a price and not an upgrade.
   */
  it('is absent entirely for an account without Plus', () => {
    const { container } = render(<PlusCard entitlement={{ state: 'none' }} />);
    expect(container).toBeEmptyDOMElement();
  });

  // Positive control for the case above: the same render with a membership
  // draws the card, so an empty one is the rule and not a broken render.
  it('draws for an account with Plus, with no upgrade on it', () => {
    render(
      <PlusCard
        entitlement={{
          state: 'active',
          renewing: true,
          periodEndsAt: JUNE_FIRST,
        }}
      />,
    );
    expect(screen.getByText('account.plus.eyebrow')).toBeInTheDocument();
    expect(
      screen.queryByText(/account.plus.(upgrade|pitch|perMonth)/),
    ).toBeNull();
  });

  it('keeps the development strip for an account without Plus', async () => {
    mockSimulator = true;
    render(<PlusCard entitlement={{ state: 'none' }} />);
    expect(
      await screen.findByRole('button', { name: 'account.dev.start' }),
    ).toBeInTheDocument();
  });

  it('offers nothing to buy on a running free trial', () => {
    render(
      <PlusCard
        entitlement={{
          state: 'active',
          plan: 'trial',
          periodEndsAt: JUNE_FIRST,
        }}
      />,
    );
    expect(screen.getByText('trial.active.badge')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows an active subscription with its renewal date and a quiet manage button', async () => {
    render(
      <PlusCard
        entitlement={{
          state: 'active',
          renewing: true,
          periodEndsAt: JUNE_FIRST,
        }}
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

    await userEvent.click(manage);
    expect(mockOpenPortal).toHaveBeenCalled();
  });

  it('calls a gift a gift: no renewal, no merchant page, and an end only when one was given', () => {
    const { rerender } = render(
      <PlusCard
        entitlement={{
          state: 'active',
          plan: 'gift',
          renewing: true,
          // The server's stand-in for "until taken back" (premium 0021).
          periodEndsAt: Date.UTC(2999, 11, 31),
        }}
      />,
    );
    expect(screen.getByText('account.plus.gift')).toBeInTheDocument();
    // A gift no longer renews (the app stopped giving it paid grace), and
    // that must not turn its badge into the cancelled-subscription amber.
    const giftBadge = screen.getByText('account.plus.active');
    expect(giftBadge.className).not.toContain('plus-card__badge--ending');
    expect(screen.queryByText(/account.plus.renews/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'account.plus.manage' }),
    ).not.toBeInTheDocument();

    rerender(
      <PlusCard
        entitlement={{
          state: 'active',
          plan: 'gift',
          renewing: true,
          periodEndsAt: JUNE_FIRST,
        }}
      />,
    );
    expect(
      screen.getByText(/account.plus.giftUntil:.*2027/),
    ).toBeInTheDocument();
  });

  it('calls an earned month free: no renewal, no merchant page, no "Ending"', () => {
    // A month earned by publishing (server migration 0041) is the server's
    // own grant. Read as a subscription it wore "Ending" from its first day
    // and offered a merchant page that has nothing about it.
    render(
      <PlusCard
        entitlement={{
          state: 'active',
          plan: 'maker',
          renewing: false,
          periodEndsAt: JUNE_FIRST,
        }}
      />,
    );
    const badge = screen.getByText('account.maker.badge');
    expect(badge).toBeInTheDocument();
    // And not in the paint a cancelled subscription wears. Nothing renews an
    // earned month, so the amber would be on it from its first day — the
    // word was changed once and the colour left behind.
    expect(badge.className).not.toContain('plus-card__badge--ending');
    expect(screen.getByText(/account.maker.until:.*2027/)).toBeInTheDocument();
    expect(screen.queryByText('account.plus.ending')).not.toBeInTheDocument();
    expect(screen.queryByText(/account.plus.until/)).not.toBeInTheDocument();
    expect(screen.queryByText('account.plus.sorry')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'account.plus.manage' }),
    ).not.toBeInTheDocument();
  });

  /**
   * A cancellation is somebody leaving, and the card answers what they are
   * owed: that they are not being thrown out today, and until when. Nothing
   * about refunds — the terms stopped offering one in revision 8 — and not
   * the computer allowance either, which belongs to a membership that is
   * going on rather than to one that is ending.
   */
  it('sees a cancelled subscription out, and says what is left of it', () => {
    render(
      <PlusCard
        entitlement={{
          state: 'active',
          renewing: false,
          periodEndsAt: JUNE_FIRST,
        }}
      />,
    );
    expect(screen.getByText('account.plus.sorry')).toBeInTheDocument();
    expect(screen.getByText(/account\.plus\.until:/)).toBeInTheDocument();
    // The state it is in, not the state it was: "Active" over "Sorry to see
    // you go" read as the cancellation not having taken.
    expect(screen.getByText('account.plus.ending')).toBeInTheDocument();
    expect(screen.queryByText('account.plus.active')).toBeNull();
    expect(screen.queryByText(/account\.plus\.refund/)).toBeNull();
    expect(screen.queryByText(/account\.plus\.computers/)).toBeNull();
    // Still manageable: this is where somebody changes their mind.
    expect(
      screen.getByRole('button', { name: 'account.plus.manage' }),
    ).toHaveClass('subtle');
  });

  it('tells a renewing member the computers it covers', () => {
    render(
      <PlusCard
        entitlement={{
          state: 'active',
          renewing: true,
          periodEndsAt: JUNE_FIRST,
        }}
      />,
    );
    expect(screen.getByText(/account\.plus\.renews:/)).toBeInTheDocument();
    expect(screen.getByText(/account\.plus\.computers:/)).toBeInTheDocument();
    expect(screen.getByText('account.plus.active')).toBeInTheDocument();
    expect(screen.queryByText('account.plus.sorry')).toBeNull();
    expect(screen.queryByText(/account\.plus\.refund/)).toBeNull();
  });

  it('explains a grace period, names its end, and offers to check again', async () => {
    render(
      <PlusCard entitlement={{ state: 'grace', graceEndsAt: JUNE_FIRST }} />,
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
