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
}));
jest.mock('../../../renderer/account/accountStore', () => ({
  useAccount: () => ({
    status: 'signed-in',
    identity: { id: 'member-account' },
  }),
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
const listing = { entitled: true, packs: [pack], locked: [] };
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
  leaderboardBoard: jest.fn(),
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
  bridge.addGalleryScene.mockResolvedValue({
    ok: true,
    lookId: official.lookId,
  });
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
  bridge.refreshScenePacks.mockResolvedValue(listing);
  bridge.onMemberScenesChanged.mockReturnValue(() => undefined);
  bridge.onScenePacksChanged.mockReturnValue(() => undefined);
  bridge.leaderboardBoard.mockResolvedValue({ ok: false, failure: 'network' });
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
const renderGallery = () => {
  const onShowGraph = jest.fn();
  return {
    ...render(<VisualizersView onShowGraph={onShowGraph} />),
    onShowGraph,
  };
};

it('lists official scenes by FluidEQ without social counts or hearts alongside member controls', async () => {
  renderGallery();
  await screen.findByRole('button', { name: 'Aurora' });
  const card = officialCard();
  expect(card.getByText('plus.official.included')).toBeInTheDocument();
  expect(
    card.getByRole('button', { name: 'plus.card.by:FluidEQ' }),
  ).toBeInTheDocument();
  expect(card.queryByText(/plus.card.adds/)).not.toBeInTheDocument();
  expect(
    card.queryByRole('button', { name: /plus.like.label/ }),
  ).not.toBeInTheDocument();
  expect(card.getByRole('button', { name: 'plus.card.add' })).toBeEnabled();
  expect(screen.getByText('plus.card.adds:5')).toBeInTheDocument();
  bridge.likeMemberScene.mockResolvedValue({ likes: 13, liked: true });
  await userEvent.click(
    screen.getByRole('button', { name: 'plus.like.label:Neon City,12' }),
  );
  expect(bridge.likeMemberScene).toHaveBeenCalledWith(member.lookId, true);
  expect(
    screen.getByRole('button', { name: 'plus.like.label:Neon City,13' }),
  ).toHaveAttribute('aria-pressed', 'true');
});

it('refreshes the official store after card Add and plays the premium look from its details', async () => {
  const { onShowGraph } = renderGallery();
  await screen.findByRole('button', { name: 'Aurora' });
  await userEvent.click(
    officialCard().getByRole('button', { name: 'plus.card.add' }),
  );
  await waitFor(() =>
    expect(
      officialCard().getByRole('button', { name: 'plus.card.added' }),
    ).toBeDisabled(),
  );
  expect(bridge.addGalleryScene).toHaveBeenCalledWith(
    FLUIDEQ_CREATOR_ID,
    'aurora',
    2,
  );
  expect(bridge.refreshScenePacks).toHaveBeenCalledTimes(1);
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
    officialCard().getByRole('button', { name: 'plus.card.update' }),
  ).toBeEnabled();
  await userEvent.click(
    officialCard().getByRole('button', { name: 'plus.card.by:FluidEQ' }),
  );
  await screen.findByRole('heading', { name: 'FluidEQ' });
  await screen.findByRole('button', { name: 'Aurora' });
  expect(
    officialCard().getByRole('button', { name: 'plus.card.update' }),
  ).toBeEnabled();
  await act(async () => adoptScenePackListingForTesting(listing));
  expect(
    officialCard().getByRole('button', { name: 'plus.card.added' }),
  ).toBeDisabled();
});

it('shows official details and maker without reports, social stats, or leaderboard rank', async () => {
  renderGallery();
  await userEvent.click(await screen.findByRole('button', { name: 'Aurora' }));
  expect(await screen.findByTestId('official-preview')).toBeInTheDocument();
  expect(screen.getByText('plus.official.included')).toBeInTheDocument();
  ['plus.scene.likes', 'plus.scene.week', 'plus.scene.adds'].forEach((key) => {
    expect(screen.queryByText(key)).not.toBeInTheDocument();
  });
  expect(
    screen.queryByRole('button', { name: /plus.like.label|plus.scene.report/ }),
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
  ['plus.scene.likes', 'plus.scene.adds', 'plus.maker.rank'].forEach((key) => {
    expect(screen.queryByText(key)).not.toBeInTheDocument();
  });
  expect(bridge.leaderboardBoard).not.toHaveBeenCalled();
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
  );
});

it('does not refresh again when the official change announcement already supplied the returned look', async () => {
  bridge.addGalleryScene.mockImplementation(async () => {
    adoptScenePackListingForTesting(listing);
    return { ok: true, lookId: official.lookId };
  });
  renderGallery();
  await screen.findByRole('button', { name: 'Aurora' });
  await userEvent.click(
    officialCard().getByRole('button', { name: 'plus.card.add' }),
  );
  expect(
    officialCard().getByRole('button', { name: 'plus.card.added' }),
  ).toBeDisabled();
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

it('keeps official browsing available without Plus, with no Add or passive heart', async () => {
  mockEntitled = false;
  const { container } = renderGallery();
  await screen.findByRole('button', { name: 'Aurora' });
  expect(
    officialCard().getByText('plus.official.included'),
  ).toBeInTheDocument();
  expect(
    officialCard().queryByRole('button', { name: 'plus.card.add' }),
  ).not.toBeInTheDocument();
  // Positive control: the member card still has its passive heart/count.
  expect(container.querySelectorAll('.gallery-like.is-count')).toHaveLength(1);
  await userEvent.click(screen.getByRole('button', { name: 'Aurora' }));
  expect(
    await screen.findByRole('button', { name: 'plus.scene.getPlus' }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'plus.scene.play' }),
  ).not.toBeInTheDocument();
});
