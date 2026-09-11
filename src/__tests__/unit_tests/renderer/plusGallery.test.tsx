/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { IGalleryScene } from '../../../common/plusGallery';
import { resetGalleryActions } from '../../../renderer/plus/galleryActions';
import { resetGalleryStore } from '../../../renderer/plus/galleryStore';
import { resetPlusNavigation } from '../../../renderer/plus/plusNavigation';
import VisualizersView from '../../../renderer/plus/VisualizersView';
import { resetMemberSceneStore } from '../../../renderer/utils/memberScenes';

const SOMEONE = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

let mockEntitled = true;

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

jest.mock('../../../renderer/account/entitlementStore', () => ({
  useEntitlement: () => ({ state: mockEntitled ? 'active' : 'none' }),
}));

jest.mock('../../../renderer/account/accountStore', () => ({
  useAccount: () => ({
    status: 'signed-in',
    identity: { id: '4f1c2b9e-8d3a-4e7b-9c11-2a6f0d5e7b30' },
  }),
}));

jest.mock('../../../renderer/graph/sceneHealth', () => ({
  isSceneRenderingAvailable: () => true,
}));

// The runner needs WebGL, which jsdom has none of; the page around it is what
// these tests are about.
jest.mock('../../../renderer/plus/ScenePreview', () => ({
  __esModule: true,
  default: ({ label }: { label: string }) => (
    <div data-testid="scene-preview">{label}</div>
  ),
}));

const scene = (over: Partial<IGalleryScene> = {}): IGalleryScene => ({
  lookId: `member:${SOMEONE}:neon-city`,
  authorId: SOMEONE,
  sceneId: 'neon-city',
  authorName: 'Mei Tanaka',
  authorHandle: 'mei',
  version: 1,
  category: 'cities',
  names: { en: 'Neon City' },
  swatch: ['#050a1a', '#00e5cf'],
  hasPhoto: false,
  likes: 12,
  likesWeek: 2,
  adds: 5,
  updatedAt: '2026-09-10T12:00:00Z',
  liked: false,
  added: false,
  ...over,
});

const bridge = {
  listGallery: jest.fn(),
  galleryPicture: jest.fn(),
  previewGalleryScene: jest.fn(),
  addGalleryScene: jest.fn(),
  reportGalleryScene: jest.fn(),
  likeMemberScene: jest.fn(),
  myPublishedScenes: jest.fn(),
  unpublishScene: jest.fn(),
  listMemberScenes: jest.fn(),
  onMemberScenesChanged: jest.fn(() => () => undefined),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockEntitled = true;
  resetPlusNavigation();
  resetGalleryStore();
  resetGalleryActions();
  resetMemberSceneStore();
  bridge.listGallery.mockResolvedValue({
    ok: true,
    scenes: [
      scene(),
      scene({
        lookId: `member:${SOMEONE}:deep-sea`,
        sceneId: 'deep-sea',
        names: { en: 'Deep Sea' },
        category: 'water',
      }),
    ],
    more: false,
  });
  bridge.galleryPicture.mockResolvedValue(undefined);
  bridge.listMemberScenes.mockResolvedValue({
    entitled: true,
    scenes: [],
    locked: [],
  });
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: bridge },
  });
});

const renderGallery = () => render(<VisualizersView onShowGraph={jest.fn()} />);

describe('Visualizers', () => {
  it('shows members without Plus what it is, and asks the server nothing', () => {
    mockEntitled = false;
    renderGallery();
    expect(screen.getByText('plus.gate.title')).toBeInTheDocument();
    expect(bridge.listGallery).not.toHaveBeenCalled();
  });

  // The control: a Plus member sees the scenes the server lists.
  it('lists the scenes members published', async () => {
    renderGallery();
    expect(
      await screen.findByRole('button', { name: 'Neon City' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Deep Sea' }),
    ).toBeInTheDocument();
    expect(bridge.listGallery).toHaveBeenCalledWith({
      sort: 'liked',
      offset: 0,
    });
  });

  it('asks again for a category, and for a sort', async () => {
    renderGallery();
    await screen.findByRole('button', { name: 'Neon City' });
    await userEvent.click(
      screen.getByRole('button', { name: 'plus.category.water' }),
    );
    await waitFor(() =>
      expect(bridge.listGallery).toHaveBeenLastCalledWith({
        sort: 'liked',
        category: 'water',
        offset: 0,
      }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'plus.gallery.sort.new' }),
    );
    await waitFor(() =>
      expect(bridge.listGallery).toHaveBeenLastCalledWith({
        sort: 'new',
        category: 'water',
        offset: 0,
      }),
    );
  });

  it('asks one search at a time, and the latest text once the answer lands', async () => {
    let settle: (value: unknown) => void = () => undefined;
    renderGallery();
    await screen.findByRole('button', { name: 'Neon City' });
    bridge.listGallery.mockReturnValueOnce(
      new Promise((resolve) => {
        settle = resolve;
      }),
    );
    const search = screen.getByRole('searchbox', {
      name: 'plus.gallery.search',
    });
    await userEvent.type(search, 'neo');
    // Only the first letter went while its answer was on the way.
    expect(bridge.listGallery).toHaveBeenLastCalledWith({
      sort: 'liked',
      query: 'n',
      offset: 0,
    });
    const asked = bridge.listGallery.mock.calls.length;
    await act(async () => settle({ ok: true, scenes: [scene()], more: false }));
    await waitFor(() =>
      expect(bridge.listGallery).toHaveBeenLastCalledWith({
        sort: 'liked',
        query: 'neo',
        offset: 0,
      }),
    );
    expect(bridge.listGallery.mock.calls.length).toBe(asked + 1);
  });

  it('likes a scene at once, and keeps what the server says', async () => {
    let settle: (value: unknown) => void = () => undefined;
    bridge.likeMemberScene.mockReturnValue(
      new Promise((resolve) => {
        settle = resolve;
      }),
    );
    renderGallery();
    const heart = await screen.findByRole('button', {
      name: 'plus.like.label:Neon City,12',
    });
    await userEvent.click(heart);
    expect(bridge.likeMemberScene).toHaveBeenCalledWith(
      `member:${SOMEONE}:neon-city`,
      true,
    );
    const pressed = screen.getByRole('button', {
      name: 'plus.like.label:Neon City,13',
    });
    expect(pressed).toHaveAttribute('aria-pressed', 'true');
    await act(async () => settle({ likes: 40, liked: true }));
    expect(
      screen.getByRole('button', { name: 'plus.like.label:Neon City,40' }),
    ).toBeInTheDocument();
  });

  it('puts the heart back and says so when the like could not be sent', async () => {
    bridge.likeMemberScene.mockResolvedValue(undefined);
    renderGallery();
    await userEvent.click(
      await screen.findByRole('button', {
        name: 'plus.like.label:Neon City,12',
      }),
    );
    expect(await screen.findByText('plus.like.offline')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'plus.like.label:Neon City,12' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('a scene’s page', () => {
  const openNeonCity = async () => {
    renderGallery();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Neon City' }),
    );
  };

  it('plays the scene once the main process has verified it', async () => {
    bridge.previewGalleryScene.mockResolvedValue({
      ok: true,
      own: false,
      pack: { id: 'neon-city', version: 1, names: { en: 'Neon City' } },
    });
    await openNeonCity();
    expect(await screen.findByTestId('scene-preview')).toBeInTheDocument();
    expect(bridge.previewGalleryScene).toHaveBeenCalledWith(
      SOMEONE,
      'neon-city',
      1,
    );
    expect(
      screen.getByRole('heading', { name: 'Neon City' }),
    ).toBeInTheDocument();
  });

  it('says why a scene will not play', async () => {
    bridge.previewGalleryScene.mockResolvedValue({
      ok: false,
      reason: 'changed',
    });
    await openNeonCity();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'plus.scene.changed',
    );
  });

  it('adds the scene to the member’s looks and says so', async () => {
    bridge.previewGalleryScene.mockResolvedValue({
      ok: true,
      own: false,
      pack: { id: 'neon-city', version: 1, names: { en: 'Neon City' } },
    });
    bridge.addGalleryScene.mockResolvedValue({
      ok: true,
      lookId: `member:${SOMEONE}:neon-city`,
    });
    await openNeonCity();
    await userEvent.click(
      await screen.findByRole('button', { name: 'plus.scene.add' }),
    );
    expect(bridge.addGalleryScene).toHaveBeenCalledWith(
      SOMEONE,
      'neon-city',
      1,
    );
    expect(
      await screen.findByText('plus.add.done:Neon City'),
    ).toBeInTheDocument();
  });

  it('reports a scene with one of the four reasons', async () => {
    bridge.previewGalleryScene.mockResolvedValue({
      ok: false,
      reason: 'unavailable',
    });
    bridge.reportGalleryScene.mockResolvedValue(true);
    await openNeonCity();
    await userEvent.click(
      await screen.findByRole('button', { name: 'plus.scene.report' }),
    );
    const dialog = screen.getByRole('dialog');
    const send = within(dialog).getByRole('button', {
      name: 'plus.report.send',
    });
    // Nothing to send until a reason is chosen.
    expect(send).toBeDisabled();
    await userEvent.click(
      within(dialog).getByLabelText('plus.report.reason.flashing'),
    );
    await userEvent.click(send);
    expect(bridge.reportGalleryScene).toHaveBeenCalledWith(
      SOMEONE,
      'neon-city',
      'flashing',
    );
    expect(
      await screen.findByRole('button', { name: 'plus.scene.reported' }),
    ).toBeDisabled();
  });

  it('opens its maker’s page, which asks for that maker’s scenes', async () => {
    bridge.previewGalleryScene.mockResolvedValue({
      ok: false,
      reason: 'unavailable',
    });
    await openNeonCity();
    await userEvent.click(
      await screen.findByRole('button', { name: 'plus.card.by:Mei Tanaka' }),
    );
    await waitFor(() =>
      expect(bridge.listGallery).toHaveBeenLastCalledWith({
        sort: 'liked',
        authorId: SOMEONE,
        offset: 0,
      }),
    );
    // Back goes to the scene, and back again to the gallery.
    await userEvent.click(
      screen.getByRole('button', { name: 'plus.scene.back' }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Neon City' }),
    ).toBeInTheDocument();
  });
});

describe('the member’s own published scenes', () => {
  it('lists them and takes one down after asking', async () => {
    bridge.myPublishedScenes.mockResolvedValue({
      ok: true,
      scenes: [
        {
          sceneId: 'neon-city',
          version: 2,
          category: 'cities',
          names: { en: 'Neon City' },
          swatch: ['#050a1a', '#00e5cf'],
          likes: 7,
          adds: 3,
          publishedAt: '2026-09-01T00:00:00Z',
          updatedAt: '2026-09-10T00:00:00Z',
          blocked: false,
        },
      ],
    });
    bridge.unpublishScene.mockResolvedValue({ ok: true });
    renderGallery();
    await userEvent.click(
      await screen.findByRole('button', { name: 'plus.gallery.mine' }),
    );
    await userEvent.click(
      await screen.findByRole('button', { name: 'plus.mine.unpublish' }),
    );
    expect(bridge.unpublishScene).not.toHaveBeenCalled();
    expect(screen.getByText('plus.mine.confirm')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'plus.mine.confirmYes' }),
    );
    expect(bridge.unpublishScene).toHaveBeenCalledWith('neon-city');
    expect(
      await screen.findByText('plus.mine.unpublished:Neon City'),
    ).toBeInTheDocument();
    expect(screen.getByText('plus.mine.empty')).toBeInTheDocument();
  });
});
