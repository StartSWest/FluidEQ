/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A scene's page: the card beside the stage, the Official tag, and the
 * picture that stands in for the scene until its first frame.
 *
 * The picture is the part a suite passed without: the page used to swap the
 * picture for the scene the moment its download finished, and a large scene
 * compiled for the GPU for seconds after that, on black. Here the preview
 * reports frames the way the real one does, so "live" is held to the first
 * frame that shows and not to the download.
 */

import '@testing-library/jest-dom';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  FLUIDEQ_CREATOR_ID,
  type IGalleryScene,
} from '../../../common/plusGallery';
import type { ISceneFrame } from '../../../renderer/graph/sceneGl';
import { resetGalleryActions } from '../../../renderer/plus/galleryActions';
import { resetGalleryStore } from '../../../renderer/plus/galleryStore';
import {
  openGalleryPage,
  resetPlusNavigation,
} from '../../../renderer/plus/plusNavigation';
import VisualizersView from '../../../renderer/plus/VisualizersView';
import { resetPlusTrialStore } from '../../../renderer/plus/trialStore';
import { resetMemberSceneStore } from '../../../renderer/utils/memberScenes';
import { resetScenePackStore } from '../../../renderer/utils/scenePacks';

let mockDrawn: ((frame: ISceneFrame) => void) | undefined;

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));
jest.mock('../../../renderer/account/entitlementStore', () => ({
  useEntitlement: () => ({ state: 'active' }),
  subscribeEntitlement: () => () => undefined,
}));
jest.mock('../../../renderer/account/accountStore', () => ({
  useAccount: () => ({
    status: 'signed-in',
    identity: { id: 'member-account' },
  }),
  getAccountSnapshot: () => ({
    status: 'signed-in',
    identity: { id: 'member-account' },
  }),
  subscribeAccount: () => () => undefined,
}));
jest.mock('../../../renderer/graph/sceneHealth', () => ({
  isSceneRenderingAvailable: () => true,
}));
jest.mock('../../../renderer/utils/graphStyle', () => ({
  setGraphLook: () => undefined,
}));
// No WebGL in jsdom: a stand-in that hands the page its frame callback, so a
// test draws the frames the real preview would.
jest.mock('../../../renderer/plus/ScenePreview', () => ({
  __esModule: true,
  default: ({ onDrawn }: { onDrawn?: (frame: ISceneFrame) => void }) => {
    mockDrawn = onDrawn;
    return <div data-testid="scene-preview" />;
  },
}));
jest.mock('../../../renderer/plus/scenePictures', () => ({
  useScenePicture: () => ({ state: 'none' }),
}));

const frame = (fade: number): ISceneFrame => ({
  timeSeconds: 0,
  level: 0,
  beat: 0,
  bands: [0, 0, 0],
  musicAccent: [0, 0],
  musicRun: [0, 0],
  accent: [0, 0, 0],
  fade,
  spectrum: new Uint8Array(0),
  waveform: new Uint8Array(0),
  params: {},
});

const official: IGalleryScene = {
  official: true,
  lookId: 'premium:aurora',
  authorId: FLUIDEQ_CREATOR_ID,
  authorName: 'FluidEQ',
  authorHandle: null,
  sceneId: 'aurora',
  version: 2,
  category: 'nature',
  names: { en: 'Aurora' },
  swatch: ['#050a1a', '#00e5cf'],
  hasPhoto: false,
  likes: 0,
  likesWeek: 0,
  adds: 0,
  updatedAt: '2026-09-10T12:00:00Z',
  liked: false,
  added: false,
};
const member: IGalleryScene = {
  ...official,
  official: undefined,
  lookId: 'member:9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d:neon-city',
  authorId: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
  authorName: 'Mei Tanaka',
  authorHandle: 'mei',
  sceneId: 'neon-city',
  category: 'cities',
  names: { en: 'Neon City' },
  likes: 12,
  likesWeek: 2,
  adds: 5,
};
const pack = {
  id: 'aurora',
  version: 2,
  names: official.names,
  swatch: official.swatch,
  fallbackStyle: 'bars' as const,
};

const bridge = {
  listGallery: jest.fn(),
  previewGalleryScene: jest.fn(),
  addGalleryScene: jest.fn(),
  likeMemberScene: jest.fn(),
  reportGalleryScene: jest.fn(),
  listMemberScenes: jest.fn(),
  onMemberScenesChanged: jest.fn(),
  listScenePacks: jest.fn(),
  refreshScenePacks: jest.fn(),
  onScenePacksChanged: jest.fn(),
  leaderboardBoard: jest.fn(),
  getPlusTrialOffer: jest.fn(),
};

beforeEach(() => {
  jest.resetAllMocks();
  mockDrawn = undefined;
  resetPlusTrialStore();
  resetPlusNavigation();
  resetGalleryStore();
  resetGalleryActions();
  resetMemberSceneStore();
  resetScenePackStore();
  bridge.listGallery.mockResolvedValue({
    ok: true,
    scenes: [official, member],
    more: false,
  });
  bridge.previewGalleryScene.mockResolvedValue({ ok: true, own: false, pack });
  bridge.listMemberScenes.mockResolvedValue({
    entitled: true,
    scenes: [],
    locked: [],
  });
  const listing = { entitled: true, packs: [pack], locked: [] };
  bridge.listScenePacks.mockResolvedValue(listing);
  bridge.refreshScenePacks.mockResolvedValue(listing);
  bridge.onMemberScenesChanged.mockReturnValue(() => undefined);
  bridge.onScenePacksChanged.mockReturnValue(() => undefined);
  bridge.leaderboardBoard.mockResolvedValue({ ok: false, failure: 'network' });
  bridge.getPlusTrialOffer.mockResolvedValue({
    ok: true,
    offer: {
      enabled: false,
      days: 30,
      state: 'unavailable',
      termsVersion: 8,
      trialTermsVersion: 1,
    },
  });
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: bridge },
  });
});

const openScene = async (scene: IGalleryScene) => {
  const view = render(<VisualizersView onShowGraph={jest.fn()} />);
  act(() => openGalleryPage({ kind: 'scene', scene }));
  await screen.findByTestId('scene-preview');
  const panel = view.container.querySelector('.gallery-scene__info');
  if (!(panel instanceof HTMLElement)) {
    throw new Error('the scene page has no panel');
  }
  return { ...view, panel: within(panel), panelElement: panel };
};

describe('the panel beside the stage', () => {
  it('names an official scene as FluidEQ’s: its category over the name, the brand, the Official tag, and where it went', async () => {
    const { panel, panelElement } = await openScene(official);
    expect(panel.getByText('plus.category.nature')).toHaveClass('eyebrow');
    expect(panel.getByRole('heading', { name: 'Aurora' })).toBeInTheDocument();
    expect(panelElement.querySelector('.gallery-scene__brand')).not.toBeNull();
    expect(panelElement.querySelector('.community__avatar')).toBeNull();
    expect(panel.getByText('plus.official.badge')).toHaveClass(
      'community__role',
    );
    // A fact said as a line with its mark, not a stretched pill.
    expect(panel.getByText('plus.official.included')).toHaveClass(
      'gallery-included',
    );
    expect(panel.getByText('plus.official.fine')).toBeInTheDocument();
    // FluidEQ's own scenes are Plus looks, not member scenes.
    expect(
      await panel.findByText('plus.scene.inLooksPlus'),
    ).toBeInTheDocument();
    expect(panel.queryByText('plus.scene.inLooks')).toBeNull();
  });

  it('keeps a member’s scene as the member’s: their picture, no Official tag, the member fine print and the way to report', async () => {
    const { panel, panelElement } = await openScene(member);
    expect(panel.getByText('plus.category.cities')).toHaveClass('eyebrow');
    expect(panelElement.querySelector('.gallery-scene__brand')).toBeNull();
    expect(panelElement.querySelector('.community__avatar')).not.toBeNull();
    expect(panel.queryByText('plus.official.badge')).toBeNull();
    expect(panel.getByText('plus.scene.fine')).toBeInTheDocument();
    expect(
      panel.getByRole('button', { name: 'plus.scene.report' }),
    ).toBeEnabled();
  });

  it('names both of a scene’s categories over its name', async () => {
    const both: IGalleryScene = { ...member, category2: 'water' };
    bridge.listGallery.mockResolvedValue({
      ok: true,
      scenes: [official, both],
      more: false,
    });
    const { panel } = await openScene(both);
    expect(
      panel.getByText('plus.category.cities · plus.category.water'),
    ).toHaveClass('eyebrow');
  });
});

describe('the Official tag on cards', () => {
  it('stands beside FluidEQ’s name on its cards, and nowhere a card shows its category instead', async () => {
    render(<VisualizersView onShowGraph={jest.fn()} />);
    const officialCard = (
      await screen.findByRole('button', { name: 'Aurora' })
    ).closest('article') as HTMLElement;
    const memberCard = screen
      .getByRole('button', { name: 'Neon City' })
      .closest('article') as HTMLElement;
    expect(
      within(officialCard).getByText('plus.official.badge'),
    ).toBeInTheDocument();
    expect(within(memberCard).queryByText('plus.official.badge')).toBeNull();

    // On FluidEQ's own page the cards name their category, and the page
    // already says whose they are.
    await userEvent.click(
      within(officialCard).getByRole('button', {
        name: 'plus.card.by:FluidEQ',
      }),
    );
    const onMaker = await screen.findByRole('heading', { name: 'FluidEQ' });
    const page = onMaker.closest('.gallery-maker') as HTMLElement;
    expect(within(page).getAllByText('plus.official.badge')).toHaveLength(1);
  });
});

describe('the picture while the scene starts', () => {
  it('shows the scene’s picture and says it is starting until a frame shows, then lets the scene take over', async () => {
    const { container } = await openScene(official);
    const still = container.querySelector('.gallery-preview__still');
    expect(still).not.toBeNull();
    expect(still).not.toHaveClass('is-behind');
    // The same loader the download wears, in the middle of the stage: one
    // wait in two parts, not two different things happening.
    const starting = screen.getByRole('status');
    expect(starting).toHaveTextContent('plus.scene.starting');
    expect(starting).toHaveClass('gallery-preview__wait');
    expect(
      starting.querySelector('.gallery-preview__wait-mark svg'),
    ).not.toBeNull();
    expect(screen.queryByText('plus.scene.playing')).toBeNull();

    // A frame drawn at no strength is not on screen yet.
    act(() => mockDrawn?.(frame(0)));
    expect(screen.getByText('plus.scene.starting')).toBeInTheDocument();

    act(() => mockDrawn?.(frame(0.05)));
    expect(screen.queryByText('plus.scene.starting')).toBeNull();
    expect(screen.getByText('plus.scene.playing')).toBeInTheDocument();
    expect(container.querySelector('.gallery-preview__still')).toHaveClass(
      'is-behind',
    );
  });
});

describe('the stage while the scene downloads', () => {
  it('shows the Studio’s loader, with the download mark, the words and the scene’s name', async () => {
    // Never answers: the download is still under way.
    bridge.previewGalleryScene.mockReturnValue(new Promise(() => {}));
    const { container } = render(<VisualizersView onShowGraph={jest.fn()} />);
    act(() => openGalleryPage({ kind: 'scene', scene: official }));
    const loader = await screen.findByText('plus.scene.loading');
    const veil = loader.closest('.gallery-preview__wait');
    expect(veil).toHaveAttribute('role', 'status');
    expect(
      veil?.querySelector('.gallery-preview__wait-mark svg'),
    ).not.toBeNull();
    expect(
      container.querySelector('.gallery-preview__wait-name'),
    ).toHaveTextContent('Aurora');
  });

  // The permanent "won't be played here again" outcome is gone entirely: a
  // scene is never banned from disk after a failure, so the preview's
  // failure reasons are only ever the ordinary, retryable ones.
  it('shows the real reason a scene from the gallery could not be played', async () => {
    bridge.previewGalleryScene.mockResolvedValue({
      ok: false,
      reason: 'changed',
    });
    render(<VisualizersView onShowGraph={jest.fn()} />);
    act(() => openGalleryPage({ kind: 'scene', scene: official }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'plus.scene.changed',
    );
  });
});

describe('the versions on a scene’s page', () => {
  it('names this version, what is new in it, and folds the earlier ones away', async () => {
    const galleryVersions = jest.fn().mockResolvedValue({
      ok: true,
      versions: [
        {
          version: 3,
          note: 'Peaks stay whole',
          publishedAt: new Date().toISOString(),
        },
        { version: 2, publishedAt: '2026-09-01T12:00:00Z' },
        {
          version: 1,
          note: 'First light',
          publishedAt: '2026-08-20T12:00:00Z',
        },
      ],
    });
    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: { ipcRenderer: { ...bridge, galleryVersions } },
    });
    const updated: IGalleryScene = {
      ...official,
      version: 3,
      firstVersion: 1,
      versionNote: 'Peaks stay whole',
      updatedAt: new Date().toISOString(),
    };
    // The page follows the gallery's own copy of the scene, so it lists this one.
    bridge.listGallery.mockResolvedValue({
      ok: true,
      scenes: [updated, member],
      more: false,
    });
    const { panel, panelElement } = await openScene(updated);
    expect(
      panelElement.querySelector('.gallery-versions__line'),
    ).toHaveTextContent(/^plus\.version\.pageLine:3,/);
    expect(panel.getByText('plus.version.new')).toBeInTheDocument();
    expect(panel.getByText('plus.version.whatsNew:3')).toBeInTheDocument();
    expect(panel.getByText('Peaks stay whole')).toBeInTheDocument();
    // The earlier versions only: this one is already said above.
    expect(
      await panel.findByText('plus.version.earlier:2'),
    ).toBeInTheDocument();
    expect(panel.getByText('First light')).toBeInTheDocument();
    expect(panel.getByText('plus.version.noNote')).toBeInTheDocument();
    expect(galleryVersions).toHaveBeenCalledWith(FLUIDEQ_CREATOR_ID, 'aurora');
  });

  it('marks nothing new on a scene’s first version', async () => {
    const { panel } = await openScene({ ...official, firstVersion: 2 });
    expect(panel.queryByText('plus.version.new')).toBeNull();
    expect(panel.queryByText(/plus\.version\.earlier/)).toBeNull();
  });
});
