/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ISubscriptionState } from '../../../common/subscription';
import AccountPlusCard from '../../../renderer/account/AccountPlusCard';
import PlusNotOnSale from '../../../renderer/plus/PlusNotOnSale';
import SignedOutPlus from '../../../renderer/plus/SignedOutPlus';
import { resetPlusSubscriptionStore } from '../../../renderer/plus/plusSubscriptionStore';

// Every word shows as its key and its values, so a test reads which line
// stands and with what price.
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
const onSale: ISubscriptionState = {
  signedIn: true,
  plans,
  subscribed: false,
  manageable: false,
};
const member: ISubscriptionState = {
  signedIn: true,
  plans,
  subscribed: true,
  manageable: true,
  status: { plan: 'yearly', until, renewing: true },
};
/** Signed out: the prices this computer last heard on sale. */
const visitor: ISubscriptionState = {
  signedIn: false,
  plans,
  plansRemembered: true,
  subscribed: false,
  manageable: false,
};

const withPlus = (state: ISubscriptionState | undefined) => {
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      ipcRenderer: {
        getPlusState: () => Promise.resolve(state),
        onPlusChanged: () => () => {},
        onPlusReturned: () => () => {},
      },
    },
  });
};

const settle = () => act(async () => {});

const nodeEnv = process.env.NODE_ENV;
beforeEach(() => {
  resetPlusSubscriptionStore();
});
afterEach(() => {
  process.env.NODE_ENV = nodeEnv;
});

/**
 * Ivan, 2026-11-28: "if plus somenice plus thing if not plus to get plus
 * nice banner like in the gallery". The account panel, over the credits.
 */
describe('Plus in the account panel', () => {
  it('shows a member their pass: every scene theirs, the plan and when it renews, and Manage Plus', async () => {
    withPlus(member);
    render(<AccountPlusCard />);
    await settle();
    expect(screen.getByText('subscription.pass.member')).toBeInTheDocument();
    expect(screen.getByText('subscription.account.yours')).toBeInTheDocument();
    expect(
      screen.getByText(
        /^subscription\.plan\.yearly · subscription\.account\.renews:/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'subscription.manage' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'subscription.makeScenes' }),
    ).toHaveAttribute('href', 'https://fluidwallpapers.com/#download');
    // The control: no offer beside a pass.
    expect(screen.queryByText('subscription.banner.title')).toBeNull();
  });

  it('offers Plus to an account without it: the gallery’s block, its price and Get Plus', async () => {
    withPlus(onSale);
    render(<AccountPlusCard />);
    await settle();
    expect(
      screen.getByRole('heading', { name: 'subscription.banner.title' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('subscription.plan.perMonth:$7.99'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'subscription.banner.or:subscription.plan.perYear:$59.99',
      ),
    ).toBeInTheDocument();
    const get = screen.getByRole('button', { name: 'subscription.get' });
    expect(get).toHaveClass('button');
    expect(get).not.toHaveClass('subtle');
    expect(screen.queryByText('subscription.account.yours')).toBeNull();
  });

  it('shows nothing in a release build when nothing is on sale', async () => {
    process.env.NODE_ENV = 'production';
    withPlus({ ...onSale, plans: [] });
    const { container } = render(<AccountPlusCard />);
    await settle();
    expect(container).toBeEmptyDOMElement();
  });
});

/**
 * While Stripe is in test mode only the server's testers get a price, and
 * Plus hid itself everywhere else - read as Plus being gone (Ivan,
 * 2026-11-28). A development build says why; a release never does, because
 * there no price means nothing on sale.
 */
describe('the development note on why no Plus shows', () => {
  it('says why in a development build when no price came back', () => {
    process.env.NODE_ENV = 'development';
    render(<PlusNotOnSale plus={{ ...onSale, plans: [] }} />);
    expect(screen.getByRole('note')).toHaveTextContent(
      'subscription.dev.notOnSale',
    );
  });

  it('is never in a release build', () => {
    process.env.NODE_ENV = 'production';
    const { container } = render(
      <PlusNotOnSale plus={{ ...onSale, plans: [] }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('stays away in development once there is a price, or for a suspended account', () => {
    process.env.NODE_ENV = 'development';
    const { container, rerender } = render(<PlusNotOnSale plus={onSale} />);
    expect(container).toBeEmptyDOMElement();
    rerender(
      <PlusNotOnSale plus={{ ...onSale, plans: [], suspended: true }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

/**
 * The welcome for somebody without an account (Ivan, 2026-11-28: "also here
 * we need some indications of plus"): a band under the free offer, whose
 * button signs in, since Plus is got once signed in.
 */
describe('Plus on the signed-out welcome', () => {
  it('shows real scenes, what Plus is, the prices last heard, and signs in', async () => {
    withPlus(visitor);
    const onSignIn = jest.fn();
    render(<SignedOutPlus onSignIn={onSignIn} />);
    await settle();
    expect(screen.getByText('subscription.welcome.title')).toBeInTheDocument();
    expect(screen.getByText('subscription.welcome.body')).toBeInTheDocument();
    expect(
      document.querySelectorAll('.signed-out__plus-stills img'),
    ).toHaveLength(4);
    expect(
      screen.getByText(/^subscription\.plan\.perMonth:\$7\.99/),
    ).toBeInTheDocument();
    const signIn = screen.getByRole('button', {
      name: 'subscription.welcome.signIn',
    });
    // The free account stays the lead; this is the quiet way.
    expect(signIn).toHaveClass('subtle');
    await userEvent.click(signIn);
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  it('goes without a price when this computer never heard one', async () => {
    withPlus(undefined);
    render(<SignedOutPlus onSignIn={jest.fn()} />);
    await settle();
    expect(screen.getByText('subscription.welcome.title')).toBeInTheDocument();
    expect(screen.queryByText(/subscription\.plan\.per/)).toBeNull();
    expect(
      screen.getByRole('button', { name: 'subscription.welcome.signIn' }),
    ).toBeInTheDocument();
  });
});
