/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { IAccountState } from '../../../main/account/session';
import type { TBillingOutcome } from '../../../main/ipc/account';
import {
  PLUS_MINIMUM_AGE,
  PLUS_TERMS_VERSION,
} from '../../../common/plusTerms';
import AccountDialog from '../../../renderer/account/AccountDialog';
import {
  TERMS_SECTIONS,
  TERMS_SENT_ROWS,
} from '../../../renderer/account/plusTermsContent';

let mockAccountState: IAccountState = {
  status: 'signed-in',
  identity: { id: 'u-1', name: 'Ada', email: 'ada@example.com' },
};
let mockEntitlement: { state: 'none' | 'active' } = { state: 'none' };
const mockOpenCheckout = jest.fn((_version: number): Promise<TBillingOutcome> =>
  Promise.resolve({ ok: true }),
);

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

jest.mock('../../../common/accountConfig', () => ({
  ACCOUNT_CONFIG: { plusPrice: '$3.99' },
  isCheckoutConfigured: () => true,
}));

jest.mock('../../../renderer/account/accountStore', () => ({
  useAccount: () => mockAccountState,
  signOutAccount: () => Promise.resolve(),
  signUpAccount: () => Promise.resolve(),
  signInAccount: () => Promise.resolve(),
  confirmAccountCode: () => Promise.resolve(),
  resendAccountCode: () => Promise.resolve(),
  forgotAccountPassword: () => Promise.resolve(),
  resetAccountPassword: () => Promise.resolve(),
  abandonAccountPending: () => Promise.resolve(),
}));

jest.mock('../../../renderer/account/entitlementStore', () => ({
  useEntitlement: () => mockEntitlement,
  openCheckout: (version: number) => mockOpenCheckout(version),
  openSubscriptionPortal: () => Promise.resolve({ ok: true }),
  refreshEntitlement: () => Promise.resolve(),
  isMembershipSimulatorAvailable: () => Promise.resolve(false),
  simulateMembership: () => Promise.resolve({ ok: false }),
}));

jest.mock('../../../renderer/usage/leaderboardStore', () => ({
  useLeaderboard: () => ({
    status: { optedIn: false, todayMinutes: 0, eligible: false },
  }),
}));

// The leaderboard card has its own suite; here it would only be noise.
jest.mock('../../../renderer/account/LeaderboardCard', () => () => null);

const agreeButton = () =>
  screen.getByRole('button', { name: 'terms.agree.continue' });

describe('the Plus terms', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEntitlement = { state: 'none' };
    mockAccountState = {
      status: 'signed-in',
      identity: { id: 'u-1', name: 'Ada', email: 'ada@example.com' },
    };
  });

  /**
   * Nobody pays without having been shown what they agree to: the upgrade
   * opens the terms, the loud button waits for the box, and the version
   * agreed to is what the checkout is opened with.
   */
  it('stand between the upgrade and the checkout, and open it only once agreed to', async () => {
    render(<AccountDialog onClose={jest.fn()} />);
    await userEvent.click(
      screen.getByRole('button', { name: 'account.plus.upgrade' }),
    );

    expect(
      screen.getByRole('heading', { name: 'terms.title' }),
    ).toBeInTheDocument();
    expect(screen.getByText('v1')).toBeInTheDocument();
    expect(screen.getByText(/^terms\.meta:1,/)).toBeInTheDocument();
    expect(screen.queryByText('v5')).not.toBeInTheDocument();
    expect(mockOpenCheckout).not.toHaveBeenCalled();
    expect(agreeButton()).toBeDisabled();
    expect(agreeButton()).not.toHaveClass('subtle');
    expect(screen.getByRole('button', { name: 'terms.back' })).toHaveClass(
      'subtle',
    );

    await userEvent.click(screen.getByLabelText('terms.agree.check'));
    expect(agreeButton()).toBeEnabled();
    await userEvent.click(agreeButton());

    expect(mockOpenCheckout).toHaveBeenCalledWith(PLUS_TERMS_VERSION);
    // Back on the account, saying where the payment is waiting.
    expect(await screen.findByRole('status')).toHaveTextContent(
      'account.plus.checkoutOpened',
    );
    expect(screen.queryByRole('heading', { name: 'terms.title' })).toBeNull();
  });

  it('names a refusal for outdated terms where it happened, and stays on them', async () => {
    mockOpenCheckout.mockResolvedValueOnce({
      ok: false,
      failure: 'terms_outdated',
    });
    render(<AccountDialog onClose={jest.fn()} initialPage="subscribe" />);
    await userEvent.click(screen.getByLabelText('terms.agree.check'));
    await userEvent.click(agreeButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'terms.error.outdated',
    );
    expect(
      screen.getByRole('heading', { name: 'terms.title' }),
    ).toBeInTheDocument();
  });

  it('names a refusal for an outdated price where it happened, and stays on the terms', async () => {
    mockOpenCheckout.mockResolvedValueOnce({
      ok: false,
      failure: 'price_outdated',
    });
    render(<AccountDialog onClose={jest.fn()} initialPage="subscribe" />);
    await userEvent.click(screen.getByLabelText('terms.agree.check'));
    await userEvent.click(agreeButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'terms.error.priceOutdated',
    );
    expect(
      screen.getByRole('heading', { name: 'terms.title' }),
    ).toBeInTheDocument();
  });

  it('go back agreeing to nothing', async () => {
    render(<AccountDialog onClose={jest.fn()} initialPage="subscribe" />);
    await userEvent.click(screen.getByRole('button', { name: 'terms.back' }));
    expect(mockOpenCheckout).not.toHaveBeenCalled();
    expect(
      screen.getByRole('heading', { name: 'account.title' }),
    ).toBeInTheDocument();
  });

  /** Every section, and every thing the app sends with when and who sees it. */
  it('list every section and everything the app sends, from the link on the account', async () => {
    const { container } = render(<AccountDialog onClose={jest.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'terms.link' }));

    // Read-only: a way back, and no agreement.
    expect(screen.queryByLabelText('terms.agree.check')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'terms.back' }),
    ).toBeInTheDocument();

    const sections = container.querySelectorAll('.plus-terms__section');
    expect(sections).toHaveLength(TERMS_SECTIONS.length);
    const rows = container.querySelectorAll('.plus-terms__sent-row');
    expect(rows).toHaveLength(TERMS_SENT_ROWS.length);
    TERMS_SENT_ROWS.forEach((row, index) => {
      const item = within(rows[index] as HTMLElement);
      expect(item.getByText(new RegExp(`^${row.what}`))).toBeInTheDocument();
      expect(item.getByText(new RegExp(`^${row.when}`))).toBeInTheDocument();
      expect(item.getByText(new RegExp(`^${row.who}`))).toBeInTheDocument();
    });
    // The numbers are filled from the code that keeps them, not typed in.
    expect(
      screen.getByText(/^terms\.membership\.p3:.*\b14\b/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        new RegExp(`^terms\\.account\\.p1:.*\\b${PLUS_MINIMUM_AGE}\\b`),
      ),
    ).toBeInTheDocument();
  });

  /**
   * Buy Me a Coffee, which takes the payment, requires every account holder
   * to be 18. Terms that let a younger person join promise a membership the
   * payment side will not sell.
   */
  it('never admit anyone younger than the payment side allows', () => {
    expect(PLUS_MINIMUM_AGE).toBeGreaterThanOrEqual(18);
  });

  it('ask for an account before any agreement, and show a member only the text', () => {
    mockAccountState = { status: 'signed-out' };
    const { unmount } = render(
      <AccountDialog onClose={jest.fn()} initialPage="subscribe" />,
    );
    expect(screen.queryByLabelText('terms.agree.check')).toBeNull();
    expect(
      screen.getByRole('heading', { name: 'account.title' }),
    ).toBeInTheDocument();
    unmount();

    mockAccountState = {
      status: 'signed-in',
      identity: { id: 'u-1', name: 'Ada' },
    };
    mockEntitlement = { state: 'active' };
    render(<AccountDialog onClose={jest.fn()} initialPage="subscribe" />);
    expect(
      screen.getByRole('heading', { name: 'terms.title' }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('terms.agree.check')).toBeNull();
  });
});
