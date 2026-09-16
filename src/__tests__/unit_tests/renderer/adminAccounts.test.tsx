/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The admin's Accounts page: the live list with its stats and search, a row
 * opening onto what an account holds and Delete behind a second press, and
 * an address that finds a leftover account the list does not carry.
 */

import '@testing-library/jest-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { IAccountListPage } from '../../../common/adminAccounts';
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
  email: 'Leaving@Example.com',
  createdAt: Date.now() - 90 * DAY,
  confirmed: true,
  admin: false,
  handle: 'leaving_one',
  displayName: 'Leaving One',
  published: 6,
  boardDays: 41,
  likes: 128,
  adds: 17,
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
  paying: accounts.filter((row) => row.plusUntil !== undefined).length,
  listed: accounts.length,
  ...over,
});

const bridge = {
  listAccounts: jest.fn(),
  findAccountsToDelete: jest.fn(),
  deleteAccount: jest.fn(),
};

beforeEach(() => {
  jest.resetAllMocks();
  bridge.listAccounts.mockResolvedValue({
    ok: true,
    page: page([account(), account({ userId: 'b', displayName: 'Second' })]),
  });
  bridge.findAccountsToDelete.mockResolvedValue({ ok: true, accounts: [] });
  bridge.deleteAccount.mockResolvedValue({ ok: true, files: 12 });
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: bridge },
  });
});

/** The row's own container, found by the name on its head button. */
const rowFor = async (name: string) => {
  const button = await screen.findByRole('button', {
    name: new RegExp(name),
  });
  const row = button.closest('li');
  if (!row) {
    throw new Error(`no row for ${name}`);
  }
  return row;
};

describe('the Accounts page', () => {
  it('lists every account with the stats and their share', async () => {
    bridge.listAccounts.mockResolvedValue({
      ok: true,
      page: page(
        [
          account(),
          account({
            userId: 'b',
            displayName: 'Second',
            plusUntil: undefined,
          }),
        ],
        { matched: 5, paying: 2, listed: 2 },
      ),
    });
    render(<AdminAccounts />);
    expect(await screen.findByText('Leaving One')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
    expect(bridge.listAccounts).toHaveBeenCalledWith({
      query: '',
      plan: 'all',
      offset: 0,
    });
    const all = screen.getByRole('button', {
      name: /plus\.accounts\.filter\.all/,
    });
    expect(all).toHaveTextContent('5');
    const plus = screen.getByRole('button', {
      name: /plus\.accounts\.filter\.plus/,
    });
    expect(plus).toHaveTextContent('2');
    expect(plus).toHaveTextContent('40%');
  });

  it('filters to Plus only when its stat is pressed', async () => {
    render(<AdminAccounts />);
    await screen.findByText('Leaving One');
    await userEvent.click(
      screen.getByRole('button', { name: /plus\.accounts\.filter\.plus/ }),
    );
    await waitFor(() =>
      expect(bridge.listAccounts).toHaveBeenLastCalledWith({
        query: '',
        plan: 'plus',
        offset: 0,
      }),
    );
  });

  it('searches with what was typed once the list is not asking', async () => {
    render(<AdminAccounts />);
    await screen.findByText('Leaving One');
    bridge.listAccounts.mockResolvedValue({
      ok: true,
      page: page([account({ displayName: 'Found' })]),
    });
    await userEvent.type(
      screen.getByRole('searchbox', { name: 'plus.accounts.search' }),
      'found',
    );
    await waitFor(() =>
      expect(bridge.listAccounts).toHaveBeenLastCalledWith({
        query: 'found',
        plan: 'all',
        offset: 0,
      }),
    );
    expect(await screen.findByText('Found')).toBeInTheDocument();
  });

  it('deletes only after the second press names the account, then drops the row and its stats', async () => {
    bridge.listAccounts.mockResolvedValue({
      ok: true,
      page: page([account()], { matched: 1, paying: 0, listed: 1 }),
    });
    render(<AdminAccounts />);
    const row = await rowFor('Leaving One');
    await userEvent.click(
      within(row).getByRole('button', { name: /Leaving One/ }),
    );
    await userEvent.click(
      within(row).getByRole('button', { name: 'plus.accounts.delete' }),
    );
    expect(bridge.deleteAccount).not.toHaveBeenCalled();
    expect(row).toHaveTextContent('plus.accounts.confirm:Leaving One');

    await userEvent.click(
      within(row).getByRole('button', { name: 'plus.accounts.confirmYes' }),
    );
    expect(bridge.deleteAccount).toHaveBeenCalledWith('Leaving@Example.com');
    await waitFor(() =>
      expect(screen.queryByText('Leaving One')).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole('button', { name: /plus\.accounts\.filter\.all/ }),
    ).toHaveTextContent('0');
  });

  it('keeps the account when Keep is pressed', async () => {
    render(<AdminAccounts />);
    const row = await rowFor('Leaving One');
    await userEvent.click(
      within(row).getByRole('button', { name: /Leaving One/ }),
    );
    await userEvent.click(
      within(row).getByRole('button', { name: 'plus.accounts.delete' }),
    );
    await userEvent.click(
      within(row).getByRole('button', { name: 'plus.accounts.keep' }),
    );
    expect(bridge.deleteAccount).not.toHaveBeenCalled();
    expect(
      within(row).getByRole('button', { name: 'plus.accounts.delete' }),
    ).toBeInTheDocument();
  });

  it('says a deletion that stopped part way, and offers to finish it', async () => {
    bridge.deleteAccount.mockResolvedValueOnce({
      ok: false,
      reason: 'unfinished',
    });
    render(<AdminAccounts />);
    const row = await rowFor('Leaving One');
    await userEvent.click(
      within(row).getByRole('button', { name: /Leaving One/ }),
    );
    await userEvent.click(
      within(row).getByRole('button', { name: 'plus.accounts.delete' }),
    );
    await userEvent.click(
      within(row).getByRole('button', { name: 'plus.accounts.confirmYes' }),
    );
    expect(await within(row).findByRole('alert')).toHaveTextContent(
      'plus.accounts.error.unfinished',
    );
    expect(
      within(row).getByRole('button', { name: 'plus.accounts.finish' }),
    ).toBeInTheDocument();
  });

  it('offers no Delete on an admin account, and says why', async () => {
    bridge.listAccounts.mockResolvedValue({
      ok: true,
      page: page([account({ admin: true, displayName: 'Ivan' })]),
    });
    render(<AdminAccounts />);
    const row = await rowFor('Ivan');
    await userEvent.click(within(row).getByRole('button', { name: /Ivan/ }));
    expect(row).toHaveTextContent('plus.accounts.note.admin');
    expect(
      within(row).queryByRole('button', {
        name: /plus\.accounts\.(delete|finish)/,
      }),
    ).not.toBeInTheDocument();
  });

  it('finds a leftover account an address search does not list, and says a gift stays', async () => {
    bridge.findAccountsToDelete.mockImplementation(async (email: string) =>
      email === 'gone@example.com'
        ? {
            ok: true,
            accounts: [
              account({
                createdAt: undefined,
                handle: undefined,
                displayName: undefined,
                email: 'gone@example.com',
                published: 0,
                deleting: true,
                gifted: true,
              }),
            ],
          }
        : { ok: true, accounts: [] },
    );
    render(<AdminAccounts />);
    await screen.findByText('Leaving One');
    await userEvent.type(
      screen.getByRole('searchbox', { name: 'plus.accounts.search' }),
      'gone@example.com',
    );
    const card = await screen.findByRole('article', {
      name: 'gone@example.com',
    });
    expect(card).toHaveTextContent('plus.accounts.note.gone');
    await userEvent.click(
      within(card).getByRole('button', { name: 'plus.accounts.finish' }),
    );
    await userEvent.click(
      within(card).getByRole('button', { name: 'plus.accounts.confirmYes' }),
    );
    expect(
      await screen.findByText(/plus\.accounts\.note\.gift/),
    ).toBeInTheDocument();
  });

  it('says the list was refused, and a retry asks again', async () => {
    bridge.listAccounts.mockResolvedValueOnce({
      ok: false,
      reason: 'forbidden',
    });
    render(<AdminAccounts />);
    expect(
      await screen.findByText('plus.accounts.error.list'),
    ).toBeInTheDocument();

    bridge.listAccounts.mockResolvedValueOnce({
      ok: true,
      page: page([account()]),
    });
    await userEvent.click(
      screen.getByRole('button', { name: 'plus.gallery.retry' }),
    );
    expect(await screen.findByText('Leaving One')).toBeInTheDocument();
  });

  it('says which FluidEQ each account runs and whether it is there now', async () => {
    bridge.listAccounts.mockResolvedValue({
      ok: true,
      page: page([
        account({ appVersion: '1.7.2', seenAt: Date.now() - 4 * 60_000 }),
        account({
          userId: 'b',
          displayName: 'Second',
          appVersion: '1.6.0',
          seenAt: Date.now() - 3 * DAY,
        }),
        account({ userId: 'c', displayName: 'Third' }),
      ]),
    });
    render(<AdminAccounts />);
    const rows = await screen.findAllByRole('listitem');

    // Within the hour, so it is here now; three days ago, so it is not.
    expect(within(rows[0]).getByText('plus.accounts.online')).toBeVisible();
    expect(within(rows[0]).getByText('1.7.2')).toBeVisible();
    expect(within(rows[1]).getByText(/^plus.accounts.lastSeen:/)).toBeVisible();
    expect(within(rows[1]).getByText('1.6.0')).toBeVisible();

    // An account the server says nothing about claims nothing: a row with no
    // session must not read as one that has never been used.
    expect(within(rows[2]).queryByText('plus.accounts.online')).toBeNull();
    expect(within(rows[2]).queryByText(/^plus.accounts.lastSeen:/)).toBeNull();
  });

  it('loads more accounts and adds them below the first page', async () => {
    bridge.listAccounts.mockResolvedValue({
      ok: true,
      page: page([account()], { matched: 2, paying: 0, listed: 2 }),
    });
    render(<AdminAccounts />);
    await screen.findByText('Leaving One');
    bridge.listAccounts.mockResolvedValue({
      ok: true,
      page: page([account({ userId: 'b', displayName: 'Second' })], {
        matched: 2,
        paying: 0,
        listed: 2,
      }),
    });
    await userEvent.click(
      screen.getByRole('button', { name: 'plus.gallery.more' }),
    );
    expect(bridge.listAccounts).toHaveBeenLastCalledWith({
      query: '',
      plan: 'all',
      offset: 1,
    });
    expect(await screen.findByText('Second')).toBeInTheDocument();
    expect(screen.getByText('Leaving One')).toBeInTheDocument();
  });
});
