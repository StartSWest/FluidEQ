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
import PlusGalleryHead from '../../../renderer/plus/PlusGalleryHead';
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

  it.each(['production', 'development'])(
    'shows nothing when nothing is on sale, in a %s build alike',
    async (build) => {
      process.env.NODE_ENV = build;
      withPlus({ ...onSale, plans: [] });
      const { container } = render(<AccountPlusCard />);
      await settle();
      expect(container).toBeEmptyDOMElement();
    },
  );
});

/**
 * Ivan, 2026-11-28, of the admin's panel: "admin doesnt need to see renew
 * plus admin own all scenes". Main says so with `everyScene`; the panel
 * says what is true instead, and the gallery's head offers nothing.
 */
describe('the account that owns every scene', () => {
  const cancelled: ISubscriptionState = {
    ...member,
    status: { plan: 'monthly', until, renewing: false },
  };
  const owner: ISubscriptionState = {
    signedIn: true,
    plans: [],
    everyScene: true,
    subscribed: false,
    manageable: false,
  };

  it('gets no pass and no Renew, where a cancelled member gets both', async () => {
    withPlus(cancelled);
    const { unmount } = render(<AccountPlusCard />);
    await settle();
    expect(screen.getByText('subscription.pass.ending')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'subscription.renew' }),
    ).toBeInTheDocument();
    unmount();
    resetPlusSubscriptionStore();

    withPlus(owner);
    render(<AccountPlusCard />);
    await settle();
    expect(
      screen.getByRole('region', { name: 'subscription.everyScene.title' }),
    ).toHaveTextContent('subscription.everyScene.body');
    expect(screen.queryByText(/^subscription\.pass\./)).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(document.querySelector('.plus-mark')).toBeNull();
  });

  it('may still stop a subscription that renews, quietly', async () => {
    withPlus({ ...owner, manageable: true });
    render(<AccountPlusCard />);
    await settle();
    const manage = screen.getByRole('button', { name: 'subscription.manage' });
    expect(manage).toHaveClass('subtle');
  });

  it('finds no Plus offer at the gallery’s head', async () => {
    withPlus(owner);
    const { container } = render(<PlusGalleryHead />);
    await settle();
    expect(container).toBeEmptyDOMElement();
  });
});

/**
 * Ivan, 2026-11-28: "no more that crap dev is normal as prod just in test
 * env". A development build used to put a dashed note where Plus stood when
 * the server sent it no price; now it shows what a release shows - Plus from
 * the test prices, or nothing - and the only difference left is that its
 * Stripe pages are Stripe's test ones (`common/billingMode.ts`).
 */
describe('Plus in a development build', () => {
  it.each(['production', 'development'])(
    'puts the same Plus block at the gallery’s head in a %s build',
    async (build) => {
      process.env.NODE_ENV = build;
      withPlus(onSale);
      render(<PlusGalleryHead />);
      await settle();
      expect(
        screen.getByRole('heading', { name: 'subscription.banner.title' }),
      ).toBeInTheDocument();
    },
  );

  it('says nothing of why when no price came back, as a release does not', async () => {
    process.env.NODE_ENV = 'development';
    withPlus({ ...onSale, plans: [] });
    const { container } = render(<PlusGalleryHead />);
    await settle();
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('note')).toBeNull();
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
