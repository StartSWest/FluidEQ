/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The admin's accounts by when they joined, and the trials that ended
 * without Plus with what each member answered (premium 0054).
 */

import '@testing-library/jest-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  joinedSince,
  type IAccountListPage,
} from '../../../common/adminAccounts';
import type { IAccountToDelete } from '../../../common/accountDeletion';
import AdminAccounts from '../../../renderer/plus/AdminAccounts';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

const DAY = 86_400_000;

const account = (over: Partial<IAccountToDelete> = {}): IAccountToDelete => ({
  userId: '3f1c2a4e-5b6d-4e7f-8a9b-0c1d2e3f4a5b',
  email: 'lapsed@example.com',
  createdAt: Date.now() - 20 * DAY,
  confirmed: true,
  admin: false,
  handle: 'lapsed',
  displayName: 'Lapsed One',
  published: 0,
  likes: 1,
  adds: 2,
  reports: 0,
  gifted: false,
  deleting: false,
  ...over,
});

const page = (
  accounts: IAccountToDelete[],
  over: Partial<IAccountListPage> = {},
): IAccountListPage => ({
  accounts,
  matched: accounts.length,
  paying: 0,
  listed: accounts.length,
  ...over,
});

const bridge = {
  listAccounts: jest.fn(),
  findAccountsToDelete: jest.fn(),
};

beforeEach(() => {
  jest.resetAllMocks();
  bridge.listAccounts.mockResolvedValue({
    ok: true,
    page: page([account()], { lapsed: 1 }),
  });
  bridge.findAccountsToDelete.mockResolvedValue({ ok: true, accounts: [] });
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: bridge },
  });
});

const lastAsk = () =>
  bridge.listAccounts.mock.calls[bridge.listAccounts.mock.calls.length - 1][0];

it('asks for the accounts that joined since the start of today, this week or this month', async () => {
  render(<AdminAccounts />);
  await screen.findByText('Lapsed One');
  expect(lastAsk()).not.toHaveProperty('since');

  const choose = async (window: 'today' | 'week' | 'month') => {
    const label = `plus.accounts.joined.${window}`;
    await userEvent.click(screen.getByRole('button', { name: label }));
    await waitFor(() =>
      expect(lastAsk()).toMatchObject({
        plan: 'all',
        offset: 0,
        since: joinedSince(window, new Date()),
      }),
    );
    expect(screen.getByRole('button', { name: label })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  };
  await choose('today');
  await choose('week');
  await choose('month');

  await userEvent.click(
    screen.getByRole('button', { name: 'plus.accounts.joined.ever' }),
  );
  await waitFor(() => expect(lastAsk()).not.toHaveProperty('since'));
});

it('keeps the window when the filter changes, and says when nobody joined in it', async () => {
  render(<AdminAccounts />);
  await screen.findByText('Lapsed One');
  bridge.listAccounts.mockResolvedValue({ ok: true, page: page([]) });
  await userEvent.click(
    screen.getByRole('button', { name: 'plus.accounts.joined.today' }),
  );
  expect(
    await screen.findByText('plus.accounts.empty.joined'),
  ).toBeInTheDocument();

  await userEvent.click(
    screen.getByRole('button', { name: /plus\.accounts\.filter\.lapsed/ }),
  );
  await waitFor(() =>
    expect(lastAsk()).toMatchObject({
      plan: 'lapsed',
      since: joinedSince('today', new Date()),
    }),
  );
  expect(
    await screen.findByText('plus.accounts.empty.lapsed'),
  ).toBeInTheDocument();
});

it('counts the trials that ended without Plus, and a dash from a server before it', async () => {
  const card = () =>
    screen.getByRole('button', { name: /plus\.accounts\.filter\.lapsed/ });
  const { unmount } = render(<AdminAccounts />);
  await screen.findByText('Lapsed One');
  expect(card()).toHaveTextContent('1');
  unmount();

  bridge.listAccounts.mockResolvedValue({ ok: true, page: page([account()]) });
  render(<AdminAccounts />);
  await screen.findByText('Lapsed One');
  expect(card()).toHaveTextContent('–');
});

it('shows why they did not take Plus, the silence last, over the lapsed list only', async () => {
  bridge.listAccounts.mockImplementation(
    async ({ plan }: { plan: string }) => ({
      ok: true,
      page: page([account()], {
        lapsed: 1,
        ...(plan === 'lapsed'
          ? {
              exitReasons: [
                { reason: 'none', answers: 9 },
                { reason: 'price', answers: 4 },
                { reason: 'free-is-enough', answers: 2 },
              ],
            }
          : {}),
      }),
    }),
  );
  render(<AdminAccounts />);
  await screen.findByText('Lapsed One');
  expect(
    screen.queryByText('plus.accounts.exit.title'),
  ).not.toBeInTheDocument();

  await userEvent.click(
    screen.getByRole('button', { name: /plus\.accounts\.filter\.lapsed/ }),
  );
  const panel = (await screen.findByText('plus.accounts.exit.title')).closest(
    'section',
  );
  if (!panel) {
    throw new Error('no reasons panel');
  }
  expect(
    within(panel).getByText('plus.accounts.exit.summary:6,15'),
  ).toBeVisible();
  const names = within(panel)
    .getAllByRole('listitem')
    .map(
      (item) => item.querySelector('.admin-favourites__kind-name')?.textContent,
    );
  expect(names).toEqual([
    'plus.accounts.exit.price',
    'plus.accounts.exit.free-is-enough',
    'plus.accounts.exit.none',
  ]);
});

it('puts when the trial ended and what the member said on their row', async () => {
  bridge.listAccounts.mockResolvedValue({
    ok: true,
    page: page(
      [
        account({
          trialEndedAt: Date.now() - 3 * DAY,
          exitReason: 'price',
          exitNote: 'A yearly price would help.',
        }),
        account({
          userId: 'b',
          displayName: 'Quiet One',
          trialEndedAt: Date.now() - DAY,
        }),
      ],
      { lapsed: 2 },
    ),
  });
  render(<AdminAccounts />);
  const head = await screen.findByRole('button', { name: /Lapsed One/ });
  expect(head).toHaveTextContent(/plus\.accounts\.trial\.ended:3 days ago/);
  expect(head).toHaveTextContent('plus.accounts.exit.price');

  await userEvent.click(head);
  const row = head.closest('li');
  if (!row) {
    throw new Error('no row');
  }
  expect(
    within(row).getByText('plus.accounts.exit.said:plus.accounts.exit.price'),
  ).toBeInTheDocument();
  expect(
    within(row).getByText('A yearly price would help.'),
  ).toBeInTheDocument();

  const quiet = screen.getByRole('button', { name: /Quiet One/ });
  expect(quiet).toHaveTextContent(/plus\.accounts\.trial\.ended:yesterday/);
  await userEvent.click(quiet);
  expect(
    within(quiet.closest('li') as HTMLElement).getByText(
      'plus.accounts.exit.notSaid',
    ),
  ).toBeInTheDocument();
});
