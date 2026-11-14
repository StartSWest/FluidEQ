/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * The gallery never lies empty under a filter nobody can see (Ivan,
 * 2026-11-13: "when they get into the gallery it appears empty, WTF, this
 * happens after login", "if I change the filters then they appear, but not
 * initially").
 *
 * Signing in from the signed-out page lands in the gallery with Not mine yet
 * on. The chip for it showed only once the server had sent a row carrying the
 * first-publish time, and an account that owns every scene - Ivan's - got no
 * rows back under Not mine yet, so the server was never learned, the chip
 * never showed, and the page said "You can already play every scene here"
 * under a toolbar that showed All lit. Held here: the filter shown is the
 * filter applied from the first render, an empty Not mine yet offers every
 * scene, and a plain sign-in lists scenes at once.
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { IGalleryQuery, IGalleryScene } from 'common/plusGallery';
import type { IAccountState } from 'main/account/session';
import type { TGalleryListOutcome } from 'main/ipc/plusGallery';
import {
  galleryServerViews,
  resetGalleryStore,
} from 'renderer/plus/galleryStore';
import GalleryView from 'renderer/plus/GalleryView';
import {
  openNotMineYet,
  resetPlusNavigation,
  usePlusNavigation,
} from 'renderer/plus/plusNavigation';
import { I18nProvider } from 'renderer/utils/I18nContext';

let mockAccount: IAccountState = { status: 'signed-out' };
const mockListeners = new Set<() => void>();

jest.mock('../../../renderer/account/accountStore', () => ({
  getAccountSnapshot: () => mockAccount,
  useAccount: () => mockAccount,
  subscribeAccount: (listener: () => void) => {
    mockListeners.add(listener);
    return () => mockListeners.delete(listener);
  },
}));

jest.mock('../../../renderer/account/entitlementStore', () => ({
  useEntitlement: () => ({ state: 'none' }),
  getEntitlementSnapshot: () => ({ state: 'none' }),
  subscribeEntitlement: () => () => undefined,
}));

jest.mock('../../../renderer/graph/sceneStill', () => ({
  renderSceneStill: async () => undefined,
  blobAsDataUrl: async () => 'data:image/webp;base64,ZHJhd24=',
}));

// The starter credits are their own subject (`starterWelcome.test.tsx`).
jest.mock('../../../renderer/plus/StarterCard', () => () => null);

const ME = 'a1b2c3d4-0000-4000-8000-000000000001';
const SOMEONE = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

const scene: IGalleryScene = {
  lookId: `member:${SOMEONE}:neon-city`,
  authorId: SOMEONE,
  sceneId: 'neon-city',
  authorName: 'Mei Tanaka',
  authorHandle: 'mei',
  version: 3,
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
};

/** What the server answers: nothing that is not already theirs, all of it otherwise. */
const asked: IGalleryQuery[] = [];
const lastAsked = (): IGalleryQuery | undefined => asked[asked.length - 1];
const listGallery = jest.fn(
  async (query: IGalleryQuery): Promise<TGalleryListOutcome> => {
    asked.push(query);
    return {
      ok: true,
      scenes: query.notMine ? [] : [scene],
      more: false,
    };
  },
);

const signIn = () => {
  mockAccount = {
    status: 'signed-in',
    identity: { id: ME, email: 'member@example.com' },
  };
  [...mockListeners].forEach((listener) => listener());
};

/** The gallery as the Plus tab mounts it, following the navigation. */
function Gallery() {
  usePlusNavigation();
  return (
    <I18nProvider>
      <GalleryView me={mockAccount.status === 'signed-in' ? ME : undefined} />
    </I18nProvider>
  );
}

const notMineChip = () =>
  screen.queryByRole('button', { name: /Not mine yet/ });

beforeEach(() => {
  resetPlusNavigation();
  resetGalleryStore();
  asked.length = 0;
  listGallery.mockClear();
  mockAccount = { status: 'signed-out' };
  mockListeners.clear();
  window.electron = {
    ipcRenderer: {
      listGallery,
      galleryPicture: jest.fn(async () => undefined),
      listScenePacks: jest.fn(async () => ({ packs: [], locked: [] })),
      listMemberScenes: jest.fn(async () => ({ scenes: [], locked: [] })),
      onMemberScenesChanged: jest.fn(() => () => undefined),
    },
  } as unknown as typeof window.electron;
});

it('shows Not mine yet lit when a sign-in lands under it, before the server has been learned', async () => {
  render(<Gallery />);
  await act(async () => undefined);
  // The landing's answer held: the first render after it is judged alone.
  let answer: (outcome: TGalleryListOutcome) => void = () => undefined;
  listGallery.mockImplementationOnce((query) => {
    asked.push(query);
    return new Promise((resolve) => {
      answer = resolve;
    });
  });
  await act(async () => {
    signIn();
    openNotMineYet();
  });

  // What was asked and what is shown are the same filter, from the start.
  expect(lastAsked()?.notMine).toBe(true);
  expect(galleryServerViews()).toBe(false);
  expect(notMineChip()).toHaveAttribute('aria-pressed', 'true');

  await act(async () => answer({ ok: true, scenes: [], more: false }));
  expect(
    screen.getByText('You can already play every scene here.'),
  ).toBeInTheDocument();
  // The answer, empty as it was, taught the server's views.
  expect(galleryServerViews()).toBe(true);
});

it('offers every scene from an empty Not mine yet, and lists them', async () => {
  render(<Gallery />);
  await act(async () => {
    signIn();
    openNotMineYet();
  });

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Show all scenes' }));
  });

  expect(lastAsked()?.notMine).toBeUndefined();
  expect(await screen.findByText('Neon City')).toBeInTheDocument();
  expect(notMineChip()).toHaveAttribute('aria-pressed', 'false');
});

it('lists scenes on the first answer after a plain sign-in, the last account’s Not mine yet gone', async () => {
  // A previous account left Not mine yet on.
  mockAccount = {
    status: 'signed-in',
    identity: { id: 'previous', email: 'previous@example.com' },
  };
  render(<Gallery />);
  await act(async () => openNotMineYet());
  expect(lastAsked()?.notMine).toBe(true);

  await act(async () => signIn());

  expect(lastAsked()?.notMine).toBeUndefined();
  expect(await screen.findByText('Neon City')).toBeInTheDocument();
  expect(
    screen.queryByText('You can already play every scene here.'),
  ).toBeNull();
});
