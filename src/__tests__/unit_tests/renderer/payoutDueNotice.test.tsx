/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Creators are paid every 15 days (Ivan, 2026-10-21: "cada 15"), by a press
 * of the admin's, never a clock — so the admin is told when the press is
 * owed. Only the admin is asked; a member's app asks nothing.
 */

import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ICreatorPayoutPreview } from '../../../common/creatorPayouts';
import PayoutDueNotice from '../../../renderer/components/PayoutDueNotice';
import { resetPayoutDueStore } from '../../../renderer/plus/payoutDue';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

let mockReview: { accountId?: string; notice: null; waiting?: number };
jest.mock('../../../renderer/plus/sceneReviewStore', () => ({
  useSceneReview: () => mockReview,
}));

const mockOpenSection = jest.fn();
jest.mock('../../../renderer/plus/plusNavigation', () => ({
  openAdminSection: (section: string) => mockOpenSection(section),
}));
jest.mock('../../../renderer/plus/plusTabRequest', () => ({
  requestPlusTab: jest.fn(),
}));

const DAY = 24 * 60 * 60 * 1000;
const preview = (over: Partial<ICreatorPayoutPreview> = {}) => ({
  due: [
    { creatorId: 'c1', readyCents: 2480 },
    { creatorId: 'c2', readyCents: 1215 },
  ],
  totalCents: 3695,
  pending: 0,
  payoutDays: 15,
  lastPaidAt: Date.now() - 16 * DAY,
  ...over,
});

const mockPreview = jest.fn();

beforeEach(() => {
  resetPayoutDueStore();
  mockPreview.mockReset();
  mockOpenSection.mockReset();
  mockReview = { accountId: 'admin-1', notice: null, waiting: 0 };
  Object.assign(window, {
    electron: { ipcRenderer: { previewCreatorPayouts: () => mockPreview() } },
  });
});

it('tells the admin creators are owed, and leads to the Payouts page', async () => {
  mockPreview.mockResolvedValue({ ok: true, value: preview() });
  render(<PayoutDueNotice />);
  expect(
    await screen.findByText('creator.notice.body:$36.95,2,15'),
  ).toBeInTheDocument();
  await userEvent.click(
    screen.getByRole('button', { name: 'creator.notice.open' }),
  );
  expect(mockOpenSection).toHaveBeenCalledWith('payouts');
  expect(screen.queryByText('creator.notice.title')).toBeNull();
});

it('says nothing before the 15 days are up', async () => {
  mockPreview.mockResolvedValue({
    ok: true,
    value: preview({ lastPaidAt: Date.now() - 3 * DAY }),
  });
  render(<PayoutDueNotice />);
  await waitFor(() => expect(mockPreview).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('says nothing when nobody is due', async () => {
  mockPreview.mockResolvedValue({
    ok: true,
    value: preview({ due: [], totalCents: 0, lastPaidAt: undefined }),
  });
  render(<PayoutDueNotice />);
  await waitFor(() => expect(mockPreview).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('never asks for a member', async () => {
  mockReview = { accountId: 'member-1', notice: null };
  mockPreview.mockResolvedValue({ ok: true, value: preview() });
  render(<PayoutDueNotice />);
  // The positive control beside it: the admin's render asks.
  mockReview = { accountId: 'admin-1', notice: null, waiting: 0 };
  render(<PayoutDueNotice />);
  await waitFor(() => expect(mockPreview).toHaveBeenCalledTimes(1));
});
