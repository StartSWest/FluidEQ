import '@testing-library/jest-dom';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  FLUIDEQ_CREATOR_ID,
  type IGalleryScene,
} from '../../../common/plusGallery';
import { resetGalleryActions } from '../../../renderer/plus/galleryActions';
import {
  findGalleryScene,
  resetGalleryStore,
} from '../../../renderer/plus/galleryStore';
import { resetPlusNavigation } from '../../../renderer/plus/plusNavigation';
import VisualizersView from '../../../renderer/plus/VisualizersView';
import { resetMemberSceneStore } from '../../../renderer/utils/memberScenes';
import {
  adoptScenePackListingForTesting,
  resetScenePackStore,
} from '../../../renderer/utils/scenePacks';

let mockEntitled = true;
const mockSetGraphLook = jest.fn();

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));
jest.mock('../../../renderer/account/entitlementStore', () => ({
  useEntitlement: () => ({ state: mockEntitled ? 'active' : 'none' }),
  getEntitlementSnapshot: () => ({
    state: mockEntitled ? 'active' : 'none',
  }),
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
  setGraphLook: (lookId: string) => mockSetGraphLook(lookId),
}));
// WebGL is unavailable in jsdom; retain the real gallery and local scene stores.
jest.mock('../../../renderer/plus/ScenePreview', () => ({
  __esModule: true,
  default: () => <div data-testid="official-preview" />,
}));
jest.mock('../../../renderer/plus/scenePictures', () => ({
  useScenePicture: () => ({ state: 'none' }),
}));

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
const listing = { packs: [pack], locked: [] };
const bridge = {
  listGallery: jest.fn(),
  previewGalleryScene: jest.fn(),
  addGalleryScene: jest.fn(),
  likeMemberScene: jest.fn(),
  reportGalleryScene: jest.fn(),
  listMemberScenes: jest.fn(),
  onMemberScenesChanged: jest.fn(() => () => undefined),
  listScenePacks: jest.fn(),
  refreshScenePacks: jest.fn(),
  onScenePacksChanged: jest.fn(() => () => undefined),
};

beforeEach(() => {
  jest.resetAllMocks();
  mockEntitled = true;
  resetPlusNavigation();
  resetGalleryStore();
  resetGalleryActions();
  resetMemberSceneStore();
  resetScenePackStore();
  bridge.listGallery.mockImplementation(
    async (query: { authorId?: string }) => ({
      ok: true,
      scenes:
        query.authorId === FLUIDEQ_CREATOR_ID ? [official] : [official, member],
      more: false,
    }),
  );
  bridge.previewGalleryScene.mockResolvedValue({ ok: true, own: false, pack });
  // As main answers it: an Add installs the pack before it returns, so this
  // computer's own list holds it from then on.
  bridge.addGalleryScene.mockImplementation(async () => {
    bridge.listScenePacks.mockResolvedValue(listing);
    return { ok: true, lookId: official.lookId };
  });
  bridge.listMemberScenes.mockResolvedValue({
    scenes: [],
    locked: [],
  });
  bridge.listScenePacks.mockResolvedValue({
    packs: [],
    locked: [],
  });
  bridge.refreshScenePacks.mockResolvedValue(listing);
  bridge.onMemberScenesChanged.mockReturnValue(() => undefined);
  bridge.onScenePacksChanged.mockReturnValue(() => undefined);
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: bridge },
  });
});

const officialCard = () => {
  const card = screen
    .getByRole('button', { name: 'Aurora' })
    .closest('article');
  if (!card) {
    throw new Error('Official gallery card missing');
  }
  return within(card);
};
/**
 * A card whose scene is in the member's looks: it reads Added, and pressing it
 * removes this computer's copy (92d74a7fd), so its accessible name is Remove.
 */
const expectAdded = () => {
  const button = officialCard().getByRole('button', {
    name: 'plus.card.remove',
  });
  expect(button).toHaveTextContent('plus.card.added');
  expect(button).toBeEnabled();
};
const renderGallery = () => {
  const onShowGraph = jest.fn();
  return {
    ...render(<VisualizersView onShowGraph={onShowGraph} />),
    onShowGraph,
  };
};

// FluidEQ's own scenes are liked like any member's (server 0048), but their
// adds go through the pack store, which counts nobody, so they show no adds.
// The scene page's own Get: the loud one, beside the cards' quiet ones.
const pageGet = async () => {
  await screen.findAllByText(/^store.scene./);
  const page = document.querySelector('.gallery-scene');
  if (!(page instanceof HTMLElement)) {
    throw new Error('the scene page is not open');
  }
  return within(page)
    .getAllByRole('button', { name: /^store.get:/ })
    .filter((button) => !button.classList.contains('subtle'));
};

it('lists official scenes by FluidEQ with a heart and no adds count, beside member controls', async () => {
  renderGallery();
  await screen.findByRole('button', { name: 'Aurora' });
  const card = officialCard();
  // Plus owns every scene while it lasts.
  expect(card.getByText('store.scene.yours')).toBeInTheDocument();
  expect(
    card.getByRole('button', { name: 'plus.card.by:FluidEQ' }),
  ).toBeInTheDocument();
  expect(card.queryByText(/plus.card.adds/)).not.toBeInTheDocument();
  expect(card.getByRole('button', { name: 'plus.card.add' })).toBeEnabled();
  expect(screen.getByText('plus.card.adds:5')).toBeInTheDocument();
  bridge.likeMemberScene.mockResolvedValue({ likes: 1, liked: true });
  await userEvent.click(
    card.getByRole('button', { name: 'plus.like.label:Aurora,0' }),
  );
  expect(bridge.likeMemberScene).toHaveBeenCalledWith(official.lookId, true);
  expect(
    card.getByRole('button', { name: 'plus.like.label:Aurora,1' }),
  ).toHaveAttribute('aria-pressed', 'true');
  bridge.likeMemberScene.mockResolvedValue({ likes: 13, liked: true });
  await userEvent.click(
    screen.getByRole('button', { name: 'plus.like.label:Neon City,12' }),
  );
  expect(bridge.likeMemberScene).toHaveBeenCalledWith(member.lookId, true);
  expect(
    screen.getByRole('button', { name: 'plus.like.label:Neon City,13' }),
  ).toHaveAttribute('aria-pressed', 'true');
});

it('reads this computer’s packs again after card Add and plays the premium look from its details', async () => {
  const { onShowGraph } = renderGallery();
  await screen.findByRole('button', { name: 'Aurora' });
  const listedBefore = bridge.listScenePacks.mock.calls.length;
  await userEvent.click(
    officialCard().getByRole('button', { name: 'plus.card.add' }),
  );
  await waitFor(expectAdded);
  expect(bridge.addGalleryScene).toHaveBeenCalledWith(
    FLUIDEQ_CREATOR_ID,
    'aurora',
    2,
    official.updatedAt,
  );
  // The local list, not the server's: Add has already installed the pack.
  expect(bridge.listScenePacks.mock.calls.length).toBeGreaterThan(listedBefore);
  expect(bridge.refreshScenePacks).not.toHaveBeenCalled();
  expect(findGalleryScene(official.lookId)).toMatchObject({
    added: true,
    adds: 0,
  });
  await userEvent.click(screen.getByRole('button', { name: 'Aurora' }));
  await userEvent.click(
    await screen.findByRole('button', { name: 'plus.scene.play' }),
  );
  expect(mockSetGraphLook).toHaveBeenCalledWith(official.lookId);
  expect(onShowGraph).toHaveBeenCalledTimes(1);
});

it('uses official pack versions for Added and Update on the list and maker page', async () => {
  bridge.listScenePacks.mockResolvedValue({
    ...listing,
    packs: [{ ...pack, version: 1 }],
  });
  renderGallery();
  await screen.findByRole('button', { name: 'Aurora' });
  expect(
    officialCard().getByRole('button', { name: 'plus.card.updateTo:2' }),
  ).toBeEnabled();
  await userEvent.click(
    officialCard().getByRole('button', { name: 'plus.card.by:FluidEQ' }),
  );
  await screen.findByRole('heading', { name: 'FluidEQ' });
  await screen.findByRole('button', { name: 'Aurora' });
  expect(
    officialCard().getByRole('button', { name: 'plus.card.updateTo:2' }),
  ).toBeEnabled();
  await act(async () => adoptScenePackListingForTesting(listing));
  expectAdded();
});

it('shows official details with likes but no adds or reports', async () => {
  renderGallery();
  await userEvent.click(await screen.findByRole('button', { name: 'Aurora' }));
  expect(await screen.findByTestId('official-preview')).toBeInTheDocument();
  expect(screen.getByText('store.scene.yours')).toBeInTheDocument();
  expect(screen.getByText('plus.scene.likes')).toBeInTheDocument();
  expect(screen.getByText('plus.scene.week')).toBeInTheDocument();
  expect(screen.queryByText('plus.scene.adds')).not.toBeInTheDocument();
  expect(
    screen.getAllByRole('button', { name: 'plus.like.label:Aurora,0' }).length,
  ).toBeGreaterThan(0);
  expect(
    screen.queryByRole('button', { name: /plus.scene.report/ }),
  ).not.toBeInTheDocument();
  await userEvent.click(
    screen.getByRole('button', { name: 'plus.card.by:FluidEQ' }),
  );
  expect(
    await screen.findByRole('heading', { name: 'FluidEQ' }),
  ).toBeInTheDocument();
  await waitFor(() =>
    expect(bridge.listGallery).toHaveBeenCalledWith({
      sort: 'liked',
      authorId: FLUIDEQ_CREATOR_ID,
      offset: 0,
    }),
  );
  expect(screen.getByText('plus.maker.scenes')).toBeInTheDocument();
  ['plus.scene.likes', 'plus.scene.adds'].forEach((key) => {
    expect(screen.queryByText(key)).not.toBeInTheDocument();
  });
  expect(bridge.reportGalleryScene).not.toHaveBeenCalled();
});

it('adds from official details and switches to Play when the pack is usable', async () => {
  renderGallery();
  await userEvent.click(await screen.findByRole('button', { name: 'Aurora' }));
  await userEvent.click(
    await screen.findByRole('button', { name: 'plus.scene.add' }),
  );
  expect(
    await screen.findByRole('button', { name: 'plus.scene.play' }),
  ).toBeEnabled();
  expect(bridge.addGalleryScene).toHaveBeenCalledWith(
    FLUIDEQ_CREATOR_ID,
    'aurora',
    2,
    official.updatedAt,
  );
});

it('never asks the server for the pack list again when the change announcement already supplied the look', async () => {
  bridge.addGalleryScene.mockImplementation(async () => {
    adoptScenePackListingForTesting(listing);
    bridge.listScenePacks.mockResolvedValue(listing);
    return { ok: true, lookId: official.lookId };
  });
  renderGallery();
  await screen.findByRole('button', { name: 'Aurora' });
  await userEvent.click(
    officialCard().getByRole('button', { name: 'plus.card.add' }),
  );
  expectAdded();
  expect(bridge.refreshScenePacks).not.toHaveBeenCalled();
});

it('keeps failed official Adds retryable without inventing stats or a usable look', async () => {
  bridge.addGalleryScene.mockResolvedValue({
    ok: false,
    reason: 'unavailable',
  });
  renderGallery();
  await screen.findByRole('button', { name: 'Aurora' });
  await userEvent.click(
    officialCard().getByRole('button', { name: 'plus.card.add' }),
  );
  expect(
    await screen.findByText('plus.add.unavailable:Aurora'),
  ).toBeInTheDocument();
  expect(
    officialCard().getByRole('button', { name: 'plus.card.add' }),
  ).toBeEnabled();
  expect(bridge.refreshScenePacks).not.toHaveBeenCalled();
  expect(findGalleryScene(official.lookId)).toMatchObject({
    added: false,
    adds: 0,
  });
});

it('keeps official browsing available without Plus, with no Add and a passive heart', async () => {
  mockEntitled = false;
  const { container } = renderGallery();
  await screen.findByRole('button', { name: 'Aurora' });
  expect(officialCard().getByText('store.scene.keep')).toBeInTheDocument();
  expect(
    officialCard().queryByRole('button', { name: 'plus.card.add' }),
  ).not.toBeInTheDocument();
  // Without Plus a heart is a count alone, on FluidEQ's scenes as on members'.
  expect(
    officialCard().getByTitle('store.like.ownersOnly:0'),
  ).toBeInTheDocument();
  expect(container.querySelectorAll('.gallery-like.is-count')).toHaveLength(2);
  expect(
    screen.queryByRole('button', { name: /plus.like.label/ }),
  ).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Aurora' }));
  expect(await pageGet()).toHaveLength(1);
  expect(
    screen.queryByRole('button', { name: 'plus.scene.play' }),
  ).not.toBeInTheDocument();
});
