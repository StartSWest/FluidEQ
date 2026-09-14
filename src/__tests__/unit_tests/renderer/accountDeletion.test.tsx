/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The admin's Accounts page: an address finds the account, the card says who
 * it is and what goes with it, and Delete takes a second press that names
 * them. What the server answers after that is what the page says.
 */

import '@testing-library/jest-dom';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { IAccountToDelete } from '../../../common/accountDeletion';
import type {
  TDeleteAccountOutcome,
  TFindAccountsOutcome,
} from '../../../main/ipc/accountDeletion';
import AccountDeletion from '../../../renderer/plus/AccountDeletion';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string>) =>
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

let findAnswer: (email: string) => Promise<TFindAccountsOutcome>;
const findAccountsToDelete = jest.fn((email: string) => findAnswer(email));
const deleteAccount = jest.fn(async (): Promise<TDeleteAccountOutcome> => ({
  ok: true,
  files: 12,
}));

beforeEach(() => {
  jest.clearAllMocks();
  findAnswer = async () => ({ ok: true, accounts: [account()] });
  window.electron = {
    ipcRenderer: { findAccountsToDelete, deleteAccount },
  } as unknown as typeof window.electron;
});

const find = async (address = 'leaving@example.com') => {
  const user = userEvent.setup();
  render(<AccountDeletion />);
  const button = screen.getByRole('button', { name: 'plus.accounts.find' });
  expect(button).toBeDisabled();
  await user.type(screen.getByLabelText('plus.accounts.field.email'), address);
  await user.click(button);
  return user;
};

describe('the Accounts page', () => {
  it('finds the account by the typed address and says who it is and what goes', async () => {
    await find('  Leaving@Example.COM ');
    expect(findAccountsToDelete).toHaveBeenCalledWith('leaving@example.com');
    const card = await screen.findByRole('article', { name: 'Leaving One' });
    expect(card).toHaveTextContent('@leaving_one');
    expect(card).toHaveTextContent('Leaving@Example.com');
    expect(card).toHaveTextContent('plus.accounts.plan.none');
    const facts = within(card)
      .getAllByRole('definition')
      .map((fact) => fact.textContent);
    expect(facts).toEqual(['6', '41', '128', '17', '0']);
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it('deletes only after the second press names the account, then says it is gone', async () => {
    const user = await find();
    const card = await screen.findByRole('article', { name: 'Leaving One' });
    await user.click(
      within(card).getByRole('button', { name: 'plus.accounts.delete' }),
    );
    expect(deleteAccount).not.toHaveBeenCalled();
    expect(card).toHaveTextContent('plus.accounts.confirm:Leaving One');

    await user.click(
      within(card).getByRole('button', { name: 'plus.accounts.confirmYes' }),
    );
    expect(deleteAccount).toHaveBeenCalledWith('Leaving@Example.com');
    expect(await screen.findByRole('status')).toHaveTextContent(
      'plus.accounts.done.title:Leaving@Example.com',
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'plus.accounts.done.body:12',
    );
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('keeps the account when Keep is pressed', async () => {
    const user = await find();
    const card = await screen.findByRole('article', { name: 'Leaving One' });
    await user.click(
      within(card).getByRole('button', { name: 'plus.accounts.delete' }),
    );
    await user.click(
      within(card).getByRole('button', { name: 'plus.accounts.keep' }),
    );
    expect(deleteAccount).not.toHaveBeenCalled();
    expect(
      within(card).getByRole('button', { name: 'plus.accounts.delete' }),
    ).toBeInTheDocument();
  });

  it('says a deletion that stopped part way, and offers to finish it', async () => {
    deleteAccount.mockResolvedValueOnce({ ok: false, reason: 'unfinished' });
    const user = await find();
    const card = await screen.findByRole('article', { name: 'Leaving One' });
    await user.click(
      within(card).getByRole('button', { name: 'plus.accounts.delete' }),
    );
    await user.click(
      within(card).getByRole('button', { name: 'plus.accounts.confirmYes' }),
    );
    expect(await within(card).findByRole('alert')).toHaveTextContent(
      'plus.accounts.error.unfinished',
    );
    expect(
      within(card).getByRole('button', { name: 'plus.accounts.finish' }),
    ).toBeInTheDocument();
  });

  it('offers no Delete on an admin account, and says why', async () => {
    findAnswer = async () => ({
      ok: true,
      accounts: [account({ admin: true, displayName: 'Ivan' })],
    });
    await find('ivancarmenates@gmail.com');
    const card = await screen.findByRole('article', { name: 'Ivan' });
    expect(card).toHaveTextContent('plus.accounts.note.admin');
    expect(within(card).queryByRole('button')).not.toBeInTheDocument();
  });

  it('finishes a deletion whose account is already gone, and says a gift stays', async () => {
    findAnswer = async () => ({
      ok: true,
      accounts: [
        account({
          createdAt: undefined,
          handle: undefined,
          displayName: undefined,
          email: 'leaving@example.com',
          published: 0,
          deleting: true,
          gifted: true,
        }),
      ],
    });
    const user = await find();
    const card = await screen.findByRole('article', {
      name: 'leaving@example.com',
    });
    expect(card).toHaveTextContent('plus.accounts.note.gone');
    await user.click(
      within(card).getByRole('button', { name: 'plus.accounts.finish' }),
    );
    await user.click(
      within(card).getByRole('button', { name: 'plus.accounts.confirmYes' }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      'plus.accounts.note.gift',
    );
  });

  it('says nobody has the address', async () => {
    findAnswer = async () => ({ ok: true, accounts: [] });
    await find('nobody@example.com');
    expect(
      await screen.findByText('plus.accounts.none:nobody@example.com'),
    ).toBeInTheDocument();
  });

  it('says a member was refused, and a failed search can be asked again', async () => {
    findAnswer = async () => ({ ok: false, reason: 'forbidden' });
    const user = await find();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'plus.accounts.error.forbidden',
    );
    findAnswer = async () => ({ ok: true, accounts: [account()] });
    await user.click(
      screen.getByRole('button', { name: 'plus.gallery.retry' }),
    );
    expect(
      await screen.findByRole('article', { name: 'Leaving One' }),
    ).toBeInTheDocument();
    expect(findAccountsToDelete).toHaveBeenLastCalledWith(
      'leaving@example.com',
    );
  });

  it('never shows an older search’s account under a newer address', async () => {
    const answers = new Map<string, (outcome: TFindAccountsOutcome) => void>();
    findAnswer = (email) =>
      new Promise((resolve) => {
        answers.set(email, resolve);
      });
    const user = await find('first@example.com');
    const field = screen.getByLabelText('plus.accounts.field.email');
    await user.clear(field);
    await user.type(field, 'second@example.com');
    await user.click(
      screen.getByRole('button', { name: 'plus.accounts.find' }),
    );

    await act(async () => {
      answers.get('second@example.com')?.({
        ok: true,
        accounts: [account({ displayName: 'Second' })],
      });
    });
    await act(async () => {
      answers.get('first@example.com')?.({
        ok: true,
        accounts: [account({ displayName: 'First' })],
      });
    });
    expect(screen.getByRole('article', { name: 'Second' })).toBeInTheDocument();
    expect(
      screen.queryByRole('article', { name: 'First' }),
    ).not.toBeInTheDocument();
  });
});
