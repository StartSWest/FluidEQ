/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { act, render } from '@testing-library/react';
import type { ISubscriptionState } from '../../../common/subscription';
import { resetAccountStore } from '../../../renderer/account/accountStore';
import { resetEntitlementStore } from '../../../renderer/account/entitlementStore';
import {
  registerRendererAddon,
  resetRendererAddons,
} from '../../../renderer/addons';
import CommunityPanel from '../../../renderer/community/CommunityPanel';
import { resetPlusNavigation } from '../../../renderer/plus/plusNavigation';
import { resetPlusSubscriptionStore } from '../../../renderer/plus/plusSubscriptionStore';
import {
  resetProfileStore,
  useProfile,
} from '../../../renderer/plus/profileStore';

// Every word shows as its key and its values, so a test reads which line is
// on the card and with what date.
jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

// The places are whole views with their own tests; here only the card at the
// foot of the rail is under test.
jest.mock('../../../renderer/plus/VisualizersView', () => ({
  __esModule: true,
  default: () => <div>visualizers view</div>,
}));
jest.mock('../../../renderer/studio/StudioPanel', () => ({
  __esModule: true,
  default: () => <div>studio view</div>,
}));

const plans: ISubscriptionState['plans'] = [
  { id: 'monthly', interval: 'month', priceCents: 799, currency: 'USD' },
  { id: 'yearly', interval: 'year', priceCents: 5999, currency: 'USD' },
];
const until = '2026-12-27T12:00:00Z';
const none: ISubscriptionState = {
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
  status: { plan: 'monthly', until, renewing: true },
};
const cancelled: ISubscriptionState = {
  ...member,
  status: { plan: 'monthly', until, renewing: false },
};

const bridge = {
  getAccountState: jest.fn(),
  onAccountState: jest.fn(() => () => {}),
  getEntitlementStatus: jest.fn(),
  onEntitlementChanged: jest.fn(() => () => {}),
  plusProfile: jest.fn(),
  getPlusState: jest.fn(),
  onPlusChanged: jest.fn(() => () => {}),
  onPlusReturned: jest.fn(() => () => {}),
};

beforeEach(() => {
  jest.clearAllMocks();
  resetAccountStore();
  resetEntitlementStore();
  resetProfileStore();
  resetPlusNavigation();
  resetPlusSubscriptionStore();
  resetRendererAddons();
  bridge.getAccountState.mockResolvedValue({
    status: 'signed-in',
    identity: { id: 'acct-1', email: 'me@example.com', name: 'Me' },
  });
  bridge.getEntitlementStatus.mockResolvedValue({ state: 'active' });
  bridge.plusProfile.mockResolvedValue({
    ok: true,
    value: {
      userId: 'acct-1',
      handle: 'ivanc',
      displayName: 'Ivan Carmenates',
      role: 'member',
    },
  });
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: bridge },
  });
});

/** The rail's card, once the account, Plus and the profile have answered. */
const showCard = async (plus: ISubscriptionState) => {
  bridge.getPlusState.mockResolvedValue(plus);
  render(<CommunityPanel onSignIn={jest.fn()} onShowGraph={jest.fn()} />);
  await act(async () => {});
  const card = document.querySelector<HTMLElement>('.community__account');
  if (!card) {
    throw new Error('no account card at the foot of the rail');
  }
  const part = (selector: string) => card.querySelector(selector);
  return {
    card,
    head: part('.community__account-head'),
    line: part('.community__account-line'),
  };
};

/** The badge the private admin add-on gives the maker, markup and all. */
function MakerBadge() {
  const { profile } = useProfile();
  return profile?.role === 'admin' ? (
    <span className="community__role community__role--admin">Maker</span>
  ) : null;
}

/**
 * Ivan, 2026-11-28, of the card before: "tjhis mega sucks". Three colours on
 * one line - the name in its hue, Plus in the accent, the maker's tag in
 * pink caps - and on the narrowest rail the tag stood out of the card. Now
 * the name is ink, one status line goes under it, and a role stands beside
 * the name.
 */
describe('the account card at the foot of the Scenes rail', () => {
  it('says the handle alone for an account without Plus', async () => {
    const { card, head, line } = await showCard(none);
    expect(head).toHaveTextContent('Ivan Carmenates');
    expect(line).toHaveTextContent(/^@ivanc$/);
    expect(card).not.toHaveClass('is-plus');
    expect(card.querySelector('.plus-mark')).toBeNull();
    // The member's colour stays on the picture: neither the card nor the
    // name carries it any more.
    expect(card.getAttribute('style')).toBeNull();
    expect(head?.querySelector('.community__name--hued')).toBeNull();
  });

  it('puts Plus first on the line for a member, the handle after it', async () => {
    const { card, line } = await showCard(member);
    expect(card).toHaveClass('is-plus');
    expect(card).not.toHaveClass('is-ending');
    const plus = line?.querySelector('.community__plus');
    expect(plus).toHaveTextContent(/^subscription\.name$/);
    expect(plus?.querySelector('.plus-mark')).not.toBeNull();
    // Plus never gives way to the handle: it comes first, and the handle is
    // the part an ellipsis takes.
    expect(line?.firstElementChild).toBe(plus);
    expect(line?.lastElementChild).toHaveTextContent('@ivanc');
  });

  it('says until when once cancelled, the date whole, and no handle to crowd it', async () => {
    const { card, line } = await showCard(cancelled);
    expect(card).toHaveClass('is-plus');
    expect(card).toHaveClass('is-ending');
    const words = line?.querySelector('.community__plus-words');
    // Held together, so a narrow rail wraps before the date and never
    // between its words, as French did: "27 / déc.".
    expect(words?.textContent).toBe('subscription.chip.until:Dec\u00a027');
    expect(line?.querySelector('.community__handle')).toBeNull();
  });

  it('stands the maker’s badge beside the name, off the status line', async () => {
    bridge.plusProfile.mockResolvedValue({
      ok: true,
      value: {
        userId: 'acct-1',
        handle: 'ivanc',
        displayName: 'Ivan Carmenates',
        role: 'admin',
      },
    });
    registerRendererAddon({ name: 'admin', AccountBadge: MakerBadge });
    const { head, line } = await showCard(cancelled);
    expect(head?.querySelector('.community__role')).toHaveTextContent('Maker');
    expect(line?.querySelector('.community__role')).toBeNull();
    // Raw text: `toHaveTextContent` folds the joined date's space into an
    // ordinary one.
    expect(line?.textContent).toBe('subscription.chip.until:Dec\u00a027');
  });
});
