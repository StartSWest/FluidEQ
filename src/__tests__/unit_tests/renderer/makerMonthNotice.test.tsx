/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { IAccountState } from '../../../main/account/session';
import type { TMakerMonthOutcome } from '../../../common/makerMonth';
import MakerMonthNotice from '../../../renderer/components/MakerMonthNotice';
import { resetMakerMonthStore } from '../../../renderer/plus/makerMonthStore';

/**
 * The week's warning before a maker's earned Plus runs out. It exists because
 * an earned month renews itself no more than a gift does: without it, the
 * Plus somebody worked for would simply be gone one morning.
 */

const ME = 'c0ffee00-1111-4222-8333-444455556666';
const DAY = 24 * 60 * 60 * 1000;

let account: IAccountState = { status: 'signed-in', identity: { id: ME } };

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

jest.mock('../../../renderer/account/accountStore', () => ({
  useAccount: () => account,
}));

const mockOpenPlace = jest.fn();
jest.mock('../../../renderer/plus/plusNavigation', () => ({
  openPlusPlace: (place: string) => mockOpenPlace(place),
}));
jest.mock('../../../renderer/plus/plusTabRequest', () => ({
  requestPlusTab: jest.fn(),
}));

const mockMonth = jest.fn<Promise<TMakerMonthOutcome>, []>();

beforeEach(() => {
  resetMakerMonthStore();
  mockMonth.mockReset();
  mockOpenPlace.mockReset();
  sessionStorage.clear();
  account = { status: 'signed-in', identity: { id: ME } };
  Object.assign(window, {
    electron: { ipcRenderer: { getMakerMonth: () => mockMonth() } },
  });
});

const month = (over: Record<string, unknown>) => {
  mockMonth.mockResolvedValue({
    ok: true,
    month: {
      running: true,
      waiting: 0,
      earnedThisMonth: false,
      submissions: 0,
      allowed: 2,
      rejections: 0,
      refusalsAllowed: 2,
      maker: true,
      ...over,
    },
  } as TMakerMonthOutcome);
};

const show = async () => {
  render(<MakerMonthNotice />);
  await waitFor(() => expect(mockMonth).toHaveBeenCalled());
};

test('the last week is announced, with the days left', async () => {
  month({ until: new Date(Date.now() + 3 * DAY).toISOString() });
  await show();

  await waitFor(() =>
    expect(
      screen.getByText('account.maker.notice.endingTitle:3'),
    ).toBeInTheDocument(),
  );
  expect(
    screen.getByText('account.maker.notice.endingBody'),
  ).toBeInTheDocument();
});

test('a month with weeks to run says nothing at all', async () => {
  month({ until: new Date(Date.now() + 20 * DAY).toISOString() });
  await show();

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('somebody who has never published is never told about a month', async () => {
  month({ maker: false, until: new Date(Date.now() + 2 * DAY).toISOString() });
  await show();

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('a month that has run out says so, and offers the way back', async () => {
  month({ until: new Date(Date.now() - DAY).toISOString() });
  await show();

  await waitFor(() =>
    expect(
      screen.getByText('account.maker.notice.endedTitle'),
    ).toBeInTheDocument(),
  );
  await userEvent.click(
    screen.getByRole('button', { name: 'account.maker.notice.open' }),
  );
  expect(mockOpenPlace).toHaveBeenCalledWith('studio');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('put away, it stays away for the rest of the sitting', async () => {
  month({ until: new Date(Date.now() + 2 * DAY).toISOString() });
  await show();
  await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

  await userEvent.click(
    screen.getByRole('button', { name: 'account.maker.notice.later' }),
  );
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

  // A second window opening in the same sitting does not say it again.
  resetMakerMonthStore();
  render(<MakerMonthNotice />);
  await waitFor(() => expect(mockMonth).toHaveBeenCalledTimes(2));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('signed out, it asks nothing and shows nothing', async () => {
  account = { status: 'signed-out' };
  month({ until: new Date(Date.now() + 2 * DAY).toISOString() });
  render(<MakerMonthNotice />);

  expect(mockMonth).not.toHaveBeenCalled();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
