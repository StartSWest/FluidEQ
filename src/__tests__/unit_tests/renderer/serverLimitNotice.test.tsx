/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The admin told when the server nears a limit of Supabase's free plan, so
 * the plan is paid for before it fills (Ivan, 2026-10-21: "we need to know
 * when we are on the supabase limit so we pay it"). Only the admin is ever
 * measured; a member's app asks nothing.
 */

import '@testing-library/jest-dom';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  FREE_PLAN,
  limitLevelOf,
  nearestLimit,
  type IServerUsage,
} from '../../../common/serverUsage';
import ServerLimitNotice from '../../../renderer/components/ServerLimitNotice';
import {
  adoptServerLimit,
  resetServerLimitStore,
} from '../../../renderer/plus/serverLimit';

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

const MB = 1024 * 1024;
const usage = (over: Partial<IServerUsage> = {}): IServerUsage => ({
  databaseBytes: 63 * MB,
  tables: [],
  buckets: [{ bucket: 'member-scenes', files: 10, bytes: 100 * MB }],
  accounts: 1000,
  activeAccounts: 600,
  measuredAt: 0,
  ...over,
});

const mockUsage = jest.fn();

beforeEach(() => {
  resetServerLimitStore();
  mockUsage.mockReset();
  mockOpenSection.mockReset();
  mockReview = { accountId: 'admin-1', notice: null, waiting: 0 };
  Object.assign(window, {
    electron: { ipcRenderer: { adminServerUsage: () => mockUsage() } },
  });
});

describe('the nearest limit', () => {
  it('is the free-plan limit closest to full', () => {
    expect(nearestLimit(usage({ databaseBytes: 450 * MB }))).toEqual({
      limit: 'database',
      share: 450 / 500,
    });
    expect(
      nearestLimit(usage({ activeAccounts: FREE_PLAN.activeAccounts * 0.7 })),
    ).toEqual({ limit: 'accounts', share: 0.7 });
  });

  it('turns amber at 60% and red at 85%', () => {
    expect(limitLevelOf(0.59)).toBe('ok');
    expect(limitLevelOf(0.6)).toBe('warn');
    expect(limitLevelOf(0.849)).toBe('warn');
    expect(limitLevelOf(0.85)).toBe('full');
  });
});

describe('the notice', () => {
  it('tells the admin which limit and how full, and leads to the Server page', async () => {
    mockUsage.mockResolvedValue({
      ok: true,
      value: usage({ databaseBytes: 460 * MB }),
    });
    render(<ServerLimitNotice />);
    expect(
      await screen.findByText('insights.server.limit.full'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'insights.server.limit.body:insights.server.limit.database,92%',
      ),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'insights.server.limit.open' }),
    );
    expect(mockOpenSection).toHaveBeenCalledWith('server');
    expect(screen.queryByText('insights.server.limit.full')).toBeNull();
  });

  it('says nothing while there is room', async () => {
    mockUsage.mockResolvedValue({ ok: true, value: usage() });
    render(<ServerLimitNotice />);
    await waitFor(() => expect(mockUsage).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('never measures for a member', async () => {
    mockReview = { accountId: 'member-1', notice: null };
    mockUsage.mockResolvedValue({
      ok: true,
      value: usage({ databaseBytes: 490 * MB }),
    });
    render(<ServerLimitNotice />);
    // The positive control beside it: the same render as the admin measures.
    mockReview = { accountId: 'admin-1', notice: null, waiting: 0 };
    render(<ServerLimitNotice />);
    await waitFor(() => expect(mockUsage).toHaveBeenCalledTimes(1));
  });

  it('put away while amber, comes back once it is red', async () => {
    mockUsage.mockResolvedValue({
      ok: true,
      value: usage({ databaseBytes: 350 * MB }),
    });
    const { rerender } = render(<ServerLimitNotice />);
    await userEvent.click(
      await screen.findByRole('button', {
        name: 'insights.server.limit.later',
      }),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    // The Server page measuring again, fuller.
    act(() => adoptServerLimit({ limit: 'database', share: 0.9 }));
    rerender(<ServerLimitNotice />);
    expect(
      await screen.findByText('insights.server.limit.full'),
    ).toBeInTheDocument();
  });
});
