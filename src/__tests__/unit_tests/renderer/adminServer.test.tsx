/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The admin's Server page (Ivan, 2026-10-12: "we need to show the db
 * capacity and requests in the admin"): each free-plan limit as a share, its
 * tone turning amber and then red as it fills, the week's requests or why
 * they are missing, and Supabase's own page for the data sent.
 */

import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { IServerUsage, TRequestUsage } from '../../../common/serverUsage';
import AdminServer, { formatBytes } from '../../../renderer/plus/AdminServer';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

const MB = 1024 * 1024;

const usage = (over: Partial<IServerUsage> = {}): IServerUsage => ({
  databaseBytes: 63 * MB,
  tables: [
    { name: 'public.scene_packs', bytes: 38 * MB },
    { name: 'auth.users', bytes: 0.2 * MB },
  ],
  buckets: [{ bucket: 'member-scenes', files: 212, bytes: 170 * MB }],
  accounts: 1384,
  activeAccounts: 611,
  measuredAt: Date.now(),
  dashboardUrl: 'https://supabase.com/dashboard/project/abcdefghijklmnopqrst',
  ...over,
});

const show = (server: IServerUsage, requests: TRequestUsage) => {
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      ipcRenderer: {
        adminServerUsage: jest.fn(async () => ({ ok: true, value: server })),
        adminRequestUsage: jest.fn(async () => ({ ok: true, value: requests })),
      },
    },
  });
  return render(<AdminServer />);
};

const gaugeOf = (label: string) => {
  const heading = screen.getByRole('heading', { name: label });
  const gauge = heading.closest('section');
  if (!gauge) {
    throw new Error(`no gauge for ${label}`);
  }
  return gauge;
};

describe('how full the server is', () => {
  it('shows each limit as what is used, of how much, and the share', async () => {
    show(usage(), { state: 'unconfigured' });
    await screen.findByRole('heading', { name: 'insights.server.database' });
    const database = gaugeOf('insights.server.database');
    expect(database).toHaveTextContent('63 MB');
    expect(database).toHaveTextContent('insights.server.of:500 MB');
    expect(
      within(database).getByRole('meter', { name: 'insights.server.database' }),
    ).toHaveAttribute('aria-valuenow', '13');
    expect(gaugeOf('insights.server.files')).toHaveTextContent('170 MB');
    expect(gaugeOf('insights.server.active')).toHaveTextContent(
      'insights.server.activeNote:1,384',
    );
  });

  it('turns a limit amber from 60% and red from 85%', async () => {
    show(usage({ databaseBytes: 450 * MB, activeAccounts: 31_000 }), {
      state: 'unconfigured',
    });
    await screen.findByRole('heading', { name: 'insights.server.database' });
    expect(gaugeOf('insights.server.database')).toHaveClass('is-full');
    expect(gaugeOf('insights.server.active')).toHaveClass('is-warn');
    expect(gaugeOf('insights.server.files')).toHaveClass('is-ok');
  });

  it('lists the largest tables and the folders of files with their sizes', async () => {
    show(usage(), { state: 'unconfigured' });
    const tables = (
      await screen.findByRole('heading', { name: 'insights.server.tables' })
    ).closest('section');
    expect(tables).toHaveTextContent('public.scene_packs38 MB');
    const folders = screen
      .getByRole('heading', { name: 'insights.server.buckets' })
      .closest('section');
    expect(folders).toHaveTextContent('member-scenes');
    expect(folders).toHaveTextContent('insights.server.bucketFiles:212');
  });
});

describe('the week’s requests', () => {
  it('adds the week up and splits it by kind', async () => {
    show(usage(), {
      state: 'ready',
      points: [
        {
          at: Date.now() - 86_400_000,
          rest: 900_000,
          auth: 40_000,
          storage: 60_000,
          realtime: 0,
        },
        { at: Date.now(), rest: 100_000, auth: 0, storage: 0, realtime: 0 },
      ],
    });
    const requests = await screen.findByRole('heading', {
      name: 'insights.server.requests',
    });
    const gauge = requests.closest('section');
    expect(gauge).toHaveTextContent('1.1M');
    expect(gauge).toHaveTextContent('insights.server.kind.rest 1M');
  });

  it('says how to add a usage key, and that a refused one needs making again', async () => {
    const { unmount } = show(usage(), { state: 'unconfigured' });
    expect(
      await screen.findByText('insights.server.noToken'),
    ).toBeInTheDocument();
    unmount();
    show(usage(), { state: 'token' });
    expect(
      await screen.findByText('insights.server.tokenRefused'),
    ).toBeInTheDocument();
  });
});

describe('the data sent', () => {
  it('opens the project’s own page on supabase.com', async () => {
    const open = jest.spyOn(window, 'open').mockImplementation(() => null);
    show(usage(), { state: 'unconfigured' });
    await userEvent.click(
      await screen.findByRole('button', {
        name: 'insights.server.openSupabase',
      }),
    );
    expect(open).toHaveBeenCalledWith(
      'https://supabase.com/dashboard/project/abcdefghijklmnopqrst',
      '_blank',
      'noopener',
    );
    open.mockRestore();
  });
});

describe('a size, in the reader’s units', () => {
  it('picks the unit that keeps the number short', () => {
    expect(formatBytes(512, 'en')).toBe('512 byte');
    expect(formatBytes(640 * 1024, 'en')).toBe('640 kB');
    expect(formatBytes(1.5 * MB, 'en')).toBe('1.5 MB');
    expect(formatBytes(1024 * MB, 'en')).toBe('1 GB');
  });
});
