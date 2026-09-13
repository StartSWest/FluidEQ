/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The admin's queue of reported scenes, as the admin meets it: the toolbar's
 * Reported button with its count, the two lists, and an answer leaving its
 * row. A member is never offered it — the server refuses them regardless.
 */

import '@testing-library/jest-dom';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { IGalleryScene } from '../../../common/plusGallery';
import type { IReportedScene } from '../../../common/plusModeration';
import { resetGalleryActions } from '../../../renderer/plus/galleryActions';
import { resetGalleryStore } from '../../../renderer/plus/galleryStore';
import { resetModerationStore } from '../../../renderer/plus/moderationStore';
import {
  openGalleryPage,
  resetPlusNavigation,
} from '../../../renderer/plus/plusNavigation';
import VisualizersView from '../../../renderer/plus/VisualizersView';
import { resetMemberSceneStore } from '../../../renderer/utils/memberScenes';
import { resetScenePackStore } from '../../../renderer/utils/scenePacks';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));
jest.mock('../../../renderer/account/entitlementStore', () => ({
  useEntitlement: () => ({ state: 'active' }),
}));
jest.mock('../../../renderer/account/accountStore', () => ({
  useAccount: () => ({
    status: 'signed-in',
    identity: { id: 'admin-account' },
  }),
}));
jest.mock('../../../renderer/graph/sceneHealth', () => ({
  isSceneRenderingAvailable: () => true,
}));
jest.mock('../../../renderer/utils/graphStyle', () => ({
  setGraphLook: () => undefined,
}));
jest.mock('../../../renderer/plus/ScenePreview', () => ({
  __esModule: true,
  default: () => <div data-testid="scene-preview" />,
}));
jest.mock('../../../renderer/plus/scenePictures', () => ({
  useScenePicture: () => ({ state: 'none' }),
}));

const AUTHOR = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

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
  listGallery: jest.fn(),
  listMemberScenes: jest.fn(),
  onMemberScenesChanged: jest.fn(),
  listScenePacks: jest.fn(),
  onScenePacksChanged: jest.fn(),
  moderationStatus: jest.fn(),
  listReportedScenes: jest.fn(),
  moderateScene: jest.fn(),
};

beforeEach(() => {
  jest.resetAllMocks();
  resetPlusNavigation();
  resetGalleryStore();
  resetGalleryActions();
  resetMemberSceneStore();
  resetScenePackStore();
  resetModerationStore();
  bridge.listGallery.mockResolvedValue({ ok: true, scenes: [], more: false });
  bridge.listMemberScenes.mockResolvedValue({
    entitled: true,
    scenes: [],
    locked: [],
  });
  bridge.listScenePacks.mockResolvedValue({
    entitled: true,
    packs: [],
    locked: [],
  });
  bridge.onMemberScenesChanged.mockReturnValue(() => undefined);
  bridge.onScenePacksChanged.mockReturnValue(() => undefined);
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
});

const reportedButton = () =>
  screen.findByRole('button', { name: /plus\.gallery\.reported/ });

describe('the queue for the admin', () => {
  it('offers the admin the Reported button with the count waiting', async () => {
    render(<VisualizersView onShowGraph={jest.fn()} />);
    const button = await reportedButton();
    expect(
      within(button).getByLabelText('plus.gallery.reportedOpen:2'),
    ).toHaveTextContent('2');
  });

  it('offers a member nothing', async () => {
    bridge.moderationStatus.mockResolvedValue({
      ok: true,
      status: { admin: false, open: 0 },
    });
    render(<VisualizersView onShowGraph={jest.fn()} />);
    await waitFor(() => expect(bridge.moderationStatus).toHaveBeenCalled());
    await screen.findByRole('button', { name: /plus\.gallery\.mine/ });
    expect(
      screen.queryByRole('button', { name: /plus\.gallery\.reported/ }),
    ).toBeNull();
  });

  it('takes a scene down only once confirmed, then drops its row and the count with it', async () => {
    render(<VisualizersView onShowGraph={jest.fn()} />);
    await userEvent.click(await reportedButton());
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
    render(<VisualizersView onShowGraph={jest.fn()} />);
    act(() => openGalleryPage({ kind: 'reported' }));
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
});
