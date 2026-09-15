/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The admin's queue of reported scenes: the two lists, taking one down or
 * dismissing it, and a row that stays when the server refuses the answer.
 * Who is offered the page at all is the admin place's own gate
 * (`CommunityPanel`/`AdminView`, tested there); this component only draws
 * the queue it is handed.
 */

import '@testing-library/jest-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { IGalleryScene } from '../../../common/plusGallery';
import type { IReportedScene } from '../../../common/plusModeration';
import {
  refreshModeration,
  resetModerationStore,
} from '../../../renderer/plus/moderationStore';
import { resetPlusNavigation } from '../../../renderer/plus/plusNavigation';
import ReportedScenes from '../../../renderer/plus/ReportedScenes';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

const AUTHOR = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const ADMIN = 'admin-account';

const sceneNamed = (sceneId: string, name: string): IGalleryScene => ({
  lookId: `member:${AUTHOR}:${sceneId}`,
  authorId: AUTHOR,
  authorName: 'Mei Tanaka',
  authorHandle: 'mei',
  sceneId,
  version: 1,
  category: 'cities',
  names: { en: name },
  swatch: ['#050a1a', '#00e5cf'],
  hasPhoto: false,
  likes: 0,
  likesWeek: 0,
  adds: 3,
  updatedAt: '2026-09-10T12:00:00Z',
  liked: false,
  added: false,
});

const reported = (sceneId: string, name: string): IReportedScene => ({
  scene: sceneNamed(sceneId, name),
  authorBanned: false,
  reports: 4,
  reasons: { rights: 0, flashing: 3, offensive: 1, broken: 0 },
  lastReportedAt: '2026-09-12T21:14:00Z',
});

const bridge = {
  moderationStatus: jest.fn(),
  listReportedScenes: jest.fn(),
  moderateScene: jest.fn(),
};

beforeEach(async () => {
  jest.resetAllMocks();
  resetPlusNavigation();
  resetModerationStore();
  bridge.moderationStatus.mockResolvedValue({
    ok: true,
    status: { admin: true, open: 2 },
  });
  bridge.listReportedScenes.mockImplementation(async (list: string) => ({
    ok: true,
    scenes:
      list === 'open'
        ? [reported('neon-city', 'Neon City'), reported('storm', 'Storm')]
        : [],
  }));
  bridge.moderateScene.mockResolvedValue({ ok: true });
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: bridge },
  });
  // The badge the queue updates (`setOpenReports`) only takes while the
  // store already knows this account is the admin — the same gate
  // CommunityPanel asks before ReportedScenes is ever mounted.
  await refreshModeration(ADMIN);
});

describe('the queue for the admin', () => {
  it('takes a scene down only once confirmed, then drops its row and the count with it', async () => {
    render(<ReportedScenes me={ADMIN} />);
    const row = (await screen.findByText('Neon City')).closest('li');
    if (!row) {
      throw new Error('the reported scene has no row');
    }
    await userEvent.click(
      within(row).getByRole('button', { name: 'plus.moderation.takeDown' }),
    );
    expect(bridge.moderateScene).not.toHaveBeenCalled();
    expect(within(row).getByText('plus.moderation.confirm')).toBeVisible();

    await userEvent.click(
      within(row).getByRole('button', { name: 'plus.moderation.takeDown' }),
    );
    expect(bridge.moderateScene).toHaveBeenCalledWith(
      'take-down',
      AUTHOR,
      'neon-city',
    );
    await waitFor(() => expect(screen.queryByText('Neon City')).toBeNull());
    expect(screen.getByText('Storm')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /plus\.moderation\.list\.open/ }),
    ).toHaveTextContent('1');
  });

  it('keeps the row when the server does not take the answer', async () => {
    bridge.moderateScene.mockResolvedValue({ ok: false, reason: 'offline' });
    render(<ReportedScenes me={ADMIN} />);
    const row = (await screen.findByText('Storm')).closest('li');
    if (!row) {
      throw new Error('the reported scene has no row');
    }
    await userEvent.click(
      within(row).getByRole('button', { name: 'plus.moderation.dismiss' }),
    );
    await waitFor(() => expect(bridge.moderateScene).toHaveBeenCalled());
    expect(screen.getByText('Storm')).toBeInTheDocument();
  });

  it('switches to the taken-down list and back, asking the server each time', async () => {
    render(<ReportedScenes me={ADMIN} />);
    await screen.findByText('Neon City');
    expect(bridge.listReportedScenes).toHaveBeenCalledWith('open');

    await userEvent.click(
      screen.getByRole('button', { name: /plus\.moderation\.list\.takenDown/ }),
    );
    await waitFor(() =>
      expect(bridge.listReportedScenes).toHaveBeenCalledWith('taken-down'),
    );
    expect(screen.queryByText('Neon City')).toBeNull();

    await userEvent.click(
      screen.getByRole('button', { name: /plus\.moderation\.list\.open/ }),
    );
    await screen.findByText('Neon City');
  });

  it('says why the list could not be read, and tries again', async () => {
    bridge.listReportedScenes.mockResolvedValueOnce({
      ok: false,
      reason: 'forbidden',
    });
    render(<ReportedScenes me={ADMIN} />);
    expect(
      await screen.findByText('plus.moderation.forbidden'),
    ).toBeInTheDocument();

    bridge.listReportedScenes.mockResolvedValueOnce({
      ok: true,
      scenes: [reported('neon-city', 'Neon City')],
    });
    await userEvent.click(
      screen.getByRole('button', { name: 'plus.gallery.retry' }),
    );
    expect(await screen.findByText('Neon City')).toBeInTheDocument();
  });
});
