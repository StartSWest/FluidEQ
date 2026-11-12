/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { IAccountSuspension } from '../../../common/accountSuspension';
import type { IMemberNotice } from '../../../common/memberNotices';
import type { ISceneStore } from '../../../common/sceneStore';
import SuspensionScreen from '../../../renderer/account/SuspensionScreen';
import MemberNotice from '../../../renderer/components/MemberNotice';

// What a suspended account and a told member see (premium 0105): the words
// are Ivan's, so each state is held to the key it says and the values it
// carries; the loud style goes to what is recommended.

const mockStore: { current?: ISceneStore } = {};
const mockAccount: { status: string } = { status: 'signed-in' };
const mockRequestRefund = jest.fn();
const mockDismiss = jest.fn();
const mockSignOut = jest.fn();

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join('|')}` : key,
  }),
}));
jest.mock('../../../renderer/plus/sceneStore', () => ({
  useSceneStore: () => ({ store: mockStore.current, loading: false }),
  requestSuspensionRefund: () => mockRequestRefund(),
  dismissMemberNotices: (ids: number[]) => mockDismiss(ids),
}));
jest.mock('../../../renderer/account/accountStore', () => ({
  useAccount: () => mockAccount,
  signOutAccount: () => mockSignOut(),
}));
jest.mock('../../../renderer/utils/noticeTurn', () => ({
  useNoticeTurn: (_claim: string, wants: boolean) => wants,
}));

const DAY = 24 * 60 * 60 * 1000;
const at = Date.now() - 3 * DAY;
const iso = (time: number) => new Date(time).toISOString();
const suspended = (
  more: Partial<IAccountSuspension> = {},
): IAccountSuspension => ({
  deletesAt: iso(at + 15 * DAY),
  windowFrom: iso(at - 15 * DAY),
  windowTo: iso(at),
  refundCents: 999,
  maker: false,
  ...more,
});
const withStore = (more: Partial<ISceneStore>) => {
  mockStore.current = {
    balance: 0,
    starterClaimed: true,
    owned: [],
    packs: [],
    ...more,
  };
};
const day = (time: number) =>
  new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric' }).format(
    new Date(time),
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockAccount.status = 'signed-in';
  mockRequestRefund.mockResolvedValue({ ok: true, store: {} });
  mockDismiss.mockResolvedValue(undefined);
  mockSignOut.mockResolvedValue(undefined);
});

describe('the suspension screen', () => {
  it('says why, the days a refund covers, the amount, and offers the ask as the loud button', async () => {
    withStore({ suspension: suspended() });
    render(<SuspensionScreen />);
    const screenBody = screen.getByRole('dialog', {
      name: 'account.suspended.title',
    });
    expect(screenBody).toHaveTextContent(
      `account.suspended.body:${day(at - 15 * DAY)}|${day(at)}|${day(at + 15 * DAY)}`,
    );
    expect(screenBody).toHaveTextContent('$9.99');
    expect(
      screen.getByText('account.suspended.daysLeft.other:12'),
    ).toBeInTheDocument();
    const ask = screen.getByRole('button', { name: 'account.suspended.ask' });
    expect(ask).not.toHaveClass('subtle');
    expect(screen.getByRole('button', { name: 'account.signOut' })).toHaveClass(
      'subtle',
    );
    // No way out but its own buttons.
    expect(screen.queryByRole('button', { name: /dismiss|close/i })).toBeNull();
    expect(screen.queryByText('account.suspended.maker')).toBeNull();

    await userEvent.click(ask);
    expect(mockRequestRefund).toHaveBeenCalledTimes(1);
  });

  it('once asked: the amount and the day it arrives, and signing out is all that is left', () => {
    withStore({
      suspension: suspended({ refundRequestedAt: iso(Date.now()) }),
    });
    render(<SuspensionScreen />);
    expect(screen.getByRole('status')).toHaveTextContent(
      `account.suspended.asked:$9.99|${day(at + 15 * DAY)}`,
    );
    expect(screen.getByText('account.suspended.bodyAsked')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'account.suspended.ask' }),
    ).toBeNull();
    expect(
      screen.getByRole('button', { name: 'account.signOut' }),
    ).not.toHaveClass('subtle');
  });

  it('with nothing paid in those days: no refund sentence and no ask', () => {
    withStore({ suspension: suspended({ refundCents: 0 }) });
    render(<SuspensionScreen />);
    expect(
      screen.getByText(`account.suspended.bodyNothing:${day(at + 15 * DAY)}`),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'account.suspended.ask' }),
    ).toBeNull();
    expect(screen.queryByText('account.suspended.paid')).toBeNull();
  });

  it('tells a maker that its scenes and unpaid money are gone', () => {
    withStore({ suspension: suspended({ maker: true }) });
    render(<SuspensionScreen />);
    expect(screen.getByText('account.suspended.maker')).toBeInTheDocument();
  });

  it('says so when the ask fails, and signs out on its button', async () => {
    mockRequestRefund.mockResolvedValue({ ok: false, reason: 'offline' });
    withStore({ suspension: suspended() });
    render(<SuspensionScreen />);
    await userEvent.click(
      screen.getByRole('button', { name: 'account.suspended.ask' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'account.suspended.failed',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'account.signOut' }),
    );
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('shows nothing to an account that is not suspended, or not signed in', () => {
    withStore({});
    const { container, rerender } = render(<SuspensionScreen />);
    expect(container).toBeEmptyDOMElement();
    withStore({ suspension: suspended() });
    mockAccount.status = 'signed-out';
    rerender(<SuspensionScreen />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('the member notice', () => {
  const names = { en: 'Neon Rain' };
  const showing = (
    notices: IMemberNotice[],
    more: Partial<ISceneStore> = {},
  ) => {
    withStore({ notices, ...more });
    return render(<MemberNotice />);
  };

  it('tells a buyer only that the scene is gone and the credit is back, and is put away once', async () => {
    showing([
      { id: 7, kind: 'scene-returned' },
      { id: 8, kind: 'scene-restored', names },
    ]);
    const notice = screen.getByRole('dialog', {
      name: 'store.notice.returned',
    });
    expect(notice).toHaveTextContent('store.notice.returnedBody');
    expect(notice).not.toHaveTextContent('Neon Rain');
    await userEvent.click(
      screen.getByRole('button', { name: 'review.notice.gotIt' }),
    );
    expect(mockDismiss).toHaveBeenCalledWith([7]);
  });

  it('tells a maker of a takedown and the block that came with it', () => {
    showing([
      {
        id: 9,
        kind: 'scene-taken-down',
        names,
        block: { days: 30, scope: 'scene' },
      },
    ]);
    const notice = screen.getByRole('dialog', {
      name: 'store.notice.takenDown:Neon Rain',
    });
    expect(notice).toHaveTextContent('store.notice.takenDownBody:Neon Rain');
    expect(notice).toHaveTextContent('store.notice.blockScene:30');
  });

  it('says no block when none was chosen, and the whole account when it was', () => {
    const { unmount } = showing([{ id: 10, kind: 'scene-taken-down', names }]);
    expect(screen.queryByText(/store\.notice\.block/)).toBeNull();
    unmount();
    showing([
      {
        id: 11,
        kind: 'scene-taken-down',
        names,
        block: { days: 15, scope: 'account' },
      },
    ]);
    expect(
      screen.getByText('store.notice.blockAccount:15'),
    ).toBeInTheDocument();
  });

  it('tells a maker of a restore and of a refunded buy', () => {
    const { unmount } = showing([{ id: 12, kind: 'scene-restored', names }]);
    expect(
      screen.getByRole('dialog', { name: 'store.notice.restored:Neon Rain' }),
    ).toBeInTheDocument();
    unmount();
    showing([{ id: 13, kind: 'purchase-refunded', names }]);
    expect(
      screen.getByRole('dialog', { name: 'store.notice.refunded' }),
    ).toHaveTextContent('store.notice.refundedBody:Neon Rain');
  });

  it('says nothing to a suspended account, which has its own screen', () => {
    const { container } = showing([{ id: 14, kind: 'scene-returned' }], {
      suspension: suspended(),
    });
    expect(container).toBeEmptyDOMElement();
  });
});

describe('a store that changes under the screen', () => {
  it('draws the asked state when the store comes back with the ask in it', () => {
    withStore({ suspension: suspended() });
    const { rerender } = render(<SuspensionScreen />);
    expect(
      screen.getByRole('button', { name: 'account.suspended.ask' }),
    ).toBeInTheDocument();
    act(() => {
      withStore({
        suspension: suspended({ refundRequestedAt: iso(Date.now()) }),
      });
    });
    rerender(<SuspensionScreen />);
    expect(
      screen.queryByRole('button', { name: 'account.suspended.ask' }),
    ).toBeNull();
  });
});
