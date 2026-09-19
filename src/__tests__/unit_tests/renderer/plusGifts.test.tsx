/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The admin's Plus gifts page: every gift with what it is doing, giving one,
 * editing one through the same form, and taking one back after saying so.
 */

import '@testing-library/jest-dom';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { IPlusGift } from '../../../common/plusGifts';
import type { TPlusGiftActOutcome } from '../../../main/ipc/plusGifts';
import PlusGifts, { endOfDay } from '../../../renderer/plus/PlusGifts';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

const mockNotice = jest.fn();
jest.mock('../../../renderer/plus/galleryActions', () => ({
  setGalleryNotice: (notice: unknown) => mockNotice(notice),
}));

const DAY = 86_400_000;
let gifts: IPlusGift[];
const givePlus = jest.fn(async (): Promise<TPlusGiftActOutcome> => ({
  ok: true,
}));
const takeBackPlus = jest.fn(async (): Promise<TPlusGiftActOutcome> => ({
  ok: true,
}));

beforeEach(() => {
  jest.clearAllMocks();
  gifts = [
    {
      email: 'friend@example.com',
      note: 'tester',
      createdAt: Date.now() - DAY,
      hasAccount: true,
      active: true,
    },
    {
      email: 'later@example.com',
      createdAt: Date.now() - DAY,
      hasAccount: false,
      active: true,
    },
    {
      email: 'old@example.com',
      until: Date.now() - DAY,
      createdAt: Date.now() - 30 * DAY,
      hasAccount: true,
      active: false,
    },
  ];
  window.electron = {
    ipcRenderer: {
      listPlusGifts: async () => ({ ok: true, gifts }),
      givePlus,
      takeBackPlus,
      getPlusTrialSettings: async () => ({
        ok: true,
        settings: { enabled: false, days: 30 },
      }),
    },
  } as unknown as typeof window.electron;
});

const renderPage = async () => {
  render(<PlusGifts />);
  return screen.findByRole('list', { name: 'plus.gifts.title' });
};

describe('the Plus gifts page', () => {
  it('says what each gift is doing: has Plus, waiting for an account, or ended', async () => {
    const list = await renderPage();
    const rows = within(list).getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('plus.gifts.status.active'),
      expect.stringContaining('plus.gifts.status.waiting'),
      expect.stringContaining('plus.gifts.status.ended'),
    ]);
    expect(rows[0]).toHaveTextContent('plus.gifts.forever');
  });

  it('gives Plus to a typed address with its note and the end of the chosen day', async () => {
    const user = userEvent.setup();
    await renderPage();
    const give = screen.getByRole('button', { name: 'plus.gifts.give' });
    expect(give).toBeDisabled();

    await user.type(
      screen.getByLabelText('plus.gifts.field.email'),
      'New@Example.com',
    );
    await user.type(
      screen.getByLabelText('plus.gifts.field.note'),
      'helped a lot',
    );
    const chosen = new Date(Date.now() + 10 * DAY);
    const day = `${chosen.getFullYear()}-${String(chosen.getMonth() + 1).padStart(2, '0')}-${String(chosen.getDate()).padStart(2, '0')}`;
    await user.type(screen.getByLabelText('plus.gifts.field.until'), day);
    await user.click(give);

    expect(givePlus).toHaveBeenCalledWith({
      email: 'new@example.com',
      note: 'helped a lot',
      until: endOfDay(day),
    });
    expect(mockNotice).toHaveBeenLastCalledWith({
      ok: true,
      key: 'plus.gifts.done.given',
      vars: { email: 'new@example.com' },
    });
  });

  it('edits a gift through the form, which then saves rather than gives', async () => {
    const user = userEvent.setup();
    const list = await renderPage();
    const [friend] = within(list).getAllByRole('listitem');
    await user.click(
      within(friend).getByRole('button', { name: 'plus.gifts.edit' }),
    );
    expect(screen.getByLabelText('plus.gifts.field.email')).toHaveValue(
      'friend@example.com',
    );
    expect(screen.getByLabelText('plus.gifts.field.note')).toHaveValue(
      'tester',
    );
    expect(
      screen.getByRole('button', { name: 'plus.gifts.save' }),
    ).toBeEnabled();
  });

  it('takes a gift back only after saying whose, and the row leaves', async () => {
    const user = userEvent.setup();
    const list = await renderPage();
    const [friend] = within(list).getAllByRole('listitem');
    await user.click(
      within(friend).getByRole('button', { name: 'plus.gifts.takeBack' }),
    );
    expect(takeBackPlus).not.toHaveBeenCalled();
    expect(friend).toHaveTextContent(
      'plus.gifts.confirmTakeBack:friend@example.com',
    );

    await act(async () => {
      within(friend)
        .getByRole('button', { name: 'plus.gifts.takeBack' })
        .click();
    });
    expect(takeBackPlus).toHaveBeenCalledWith('friend@example.com');
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
  });

  it('says the server refused an address instead of clearing the form', async () => {
    givePlus.mockResolvedValueOnce({ ok: false, reason: 'invalid' });
    const user = userEvent.setup();
    await renderPage();
    await user.type(screen.getByLabelText('plus.gifts.field.email'), 'x@y.zz');
    await user.click(screen.getByRole('button', { name: 'plus.gifts.give' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'plus.gifts.error.invalid',
    );
    expect(screen.getByLabelText('plus.gifts.field.email')).toHaveValue(
      'x@y.zz',
    );
  });
});
