/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The plan's usage on the accounts card (`StudioChatLimits.tsx`). A window
 * whose reset has passed is not shown - the card once showed last week's
 * 31% days into a week at 12% (Ivan, 2026-10-24) - and an old reading says
 * its day as well as its time.
 */

import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import type { IStudioChatLimits } from '../../../common/studioChat';
import StudioChatLimits from '../../../renderer/studio/chat/StudioChatLimits';
import {
  checkStudioChat,
  resetStudioChatStore,
} from '../../../renderer/studio/chat/studioChatStore';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key} ${Object.values(vars).join(' ')}` : key,
  }),
}));

const HOUR = 3600 * 1000;
const EMAIL = 'member@example.com';

/** The card under a signed-in account, main answering with that account's reading. */
const showing = async (limits: IStudioChatLimits) => {
  resetStudioChatStore();
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      ipcRenderer: {
        studioChatAvailability: jest.fn(async () => ({
          state: 'ready',
          email: EMAIL,
        })),
        studioChatLimits: jest.fn(async () => ({
          limits: { ...limits, account: EMAIL },
          checking: false,
        })),
      },
    },
  });
  await checkStudioChat();
  // Main's answer lands inside the render's own act.
  await act(async () => {
    render(<StudioChatLimits />);
  });
};

it('shows both windows of a reading taken now, at its time alone', async () => {
  const now = Date.now();
  await showing({
    fiveHour: { used: 0.08, resetsAt: now + 2 * HOUR },
    week: { used: 0.12, resetsAt: now + 100 * HOUR },
    at: now,
  });
  expect(
    await screen.findByRole('meter', { name: 'studioChat.limits.week' }),
  ).toHaveAttribute('aria-valuenow', '12');
  expect(
    screen.getByRole('meter', { name: 'studioChat.limits.fiveHour' }),
  ).toHaveAttribute('aria-valuenow', '8');
  const time = new Intl.DateTimeFormat('en', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(now);
  expect(
    screen.getByText(`studioChat.limits.asOf ${time}`),
  ).toBeInTheDocument();
});

it('leaves out a window whose reset has passed, and dates an old reading', async () => {
  const now = Date.now();
  const at = now - 48 * HOUR;
  await showing({
    fiveHour: { used: 0.1, resetsAt: now + HOUR },
    week: { used: 0.31, resetsAt: now - HOUR },
    at,
  });
  await screen.findByRole('meter', { name: 'studioChat.limits.fiveHour' });
  expect(
    screen.queryByRole('meter', { name: 'studioChat.limits.week' }),
  ).toBeNull();
  const dayAndTime = new Intl.DateTimeFormat('en', {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(at);
  expect(
    screen.getByText(`studioChat.limits.asOf ${dayAndTime}`),
  ).toBeInTheDocument();
});

it('says there is no reading when every window has reset', async () => {
  const now = Date.now();
  await showing({
    fiveHour: { used: 0.4, resetsAt: now - HOUR },
    week: { used: 0.31, resetsAt: now - HOUR },
    at: now - 200 * HOUR,
  });
  expect(await screen.findByText('studioChat.limits.none')).toBeInTheDocument();
});
