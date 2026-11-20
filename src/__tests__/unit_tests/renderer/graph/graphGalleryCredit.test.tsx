/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The gallery's bar along the graph's foot (Ivan, 2026-11-19): the heart on
 * every scene and on no standard look, a like given there reaching the
 * Scenes gallery too, the neighbours stepping the walk, and the place dots
 * kept, unlit, for a look out of the walk so the bar never changes width.
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { DEFAULT_GRAPH_LOOK_ID } from 'common/graphStyles';
import type { IScenePacksListing } from 'main/ipc/scenePacks';
import GraphGallery from 'renderer/graph/GraphGallery';
import { setSceneRenderingAvailableForTesting } from 'renderer/graph/sceneHealth';
import { setGraphLook } from 'renderer/utils/graphStyle';
import { I18nProvider } from 'renderer/utils/I18nContext';
import { resetMemberSceneStore } from 'renderer/utils/memberScenes';
import {
  adoptScenePackListingForTesting,
  resetScenePackStore,
} from 'renderer/utils/scenePacks';

const patchGalleryScene = jest.fn();
jest.mock('renderer/plus/galleryStore', () => ({
  ...jest.requireActual('renderer/plus/galleryStore'),
  patchGalleryScene: (...args: unknown[]) => patchGalleryScene(...args),
}));

const AURORA = {
  id: 'aurora',
  version: 3,
  revision: 'rev-a',
  names: { en: 'Aurora' },
  swatch: ['#00e5cf', '#ff3cac'],
} as IScenePacksListing['packs'][number];

const likes = { liked: false, likes: 128 };
const likeMemberScene = jest.fn(async (_lookId: string, liked: boolean) => {
  likes.liked = liked;
  likes.likes += liked ? 1 : -1;
  return { ...likes };
});

const show = (lookId: string, onStep = jest.fn()) =>
  render(
    <I18nProvider>
      <GraphGallery
        selectedLookId={lookId}
        isDisabled={false}
        isIdle={false}
        onStep={onStep}
        onChoose={jest.fn()}
        tools={<button type="button">Grid</button>}
      />
    </I18nProvider>,
  );

beforeEach(() => {
  window.localStorage.clear();
  resetScenePackStore();
  resetMemberSceneStore();
  patchGalleryScene.mockClear();
  likeMemberScene.mockClear();
  likes.liked = false;
  likes.likes = 128;
  window.electron = {
    ipcRenderer: {
      memberSceneLikeStatus: async () => ({ ...likes }),
      likeMemberScene,
    },
  } as unknown as typeof window.electron;
  setSceneRenderingAvailableForTesting(true);
  act(() => setGraphLook(DEFAULT_GRAPH_LOOK_ID));
});

afterEach(() => {
  setSceneRenderingAvailableForTesting(undefined);
});

it('likes one of FluidEQ’s scenes from the credit, and tells the Scenes gallery', async () => {
  act(() => adoptScenePackListingForTesting({ packs: [AURORA], locked: [] }));
  show('premium:aurora');
  const heart = await screen.findByRole('button', {
    pressed: false,
    name: /Aurora/,
  });
  await screen.findByText('128');
  await act(async () => {
    fireEvent.click(heart);
  });
  expect(likeMemberScene).toHaveBeenCalledWith('premium:aurora', true);
  expect(await screen.findByText('129')).toBeInTheDocument();
  expect(patchGalleryScene).toHaveBeenCalledWith('premium:aurora', {
    liked: true,
    likes: 129,
  });
});

it('carries no heart on a standard look', () => {
  show(DEFAULT_GRAPH_LOOK_ID);
  // The control: the credit is there, naming the look.
  expect(screen.getByRole('group')).toBeInTheDocument();
  expect(document.querySelector('.graph-like')).toBeNull();
});

it('steps the walk from its neighbours, back and on', () => {
  const onStep = jest.fn();
  show(DEFAULT_GRAPH_LOOK_ID, onStep);
  const [back, on] = document.querySelectorAll('.graph-gallery-edge');
  fireEvent.click(back);
  fireEvent.click(on);
  expect(onStep.mock.calls).toEqual([[-1], [1]]);
});

it('keeps its place dots, unlit and unsaid, for a look out of the walk', () => {
  show(DEFAULT_GRAPH_LOOK_ID);
  const inWalk = document.querySelector('.graph-gallery-credit__place');
  expect(inWalk).toHaveAttribute('role', 'img');
  const dots = inWalk?.querySelectorAll('i').length;
  expect(inWalk?.querySelectorAll('i.is-here:not(.is-unlit)')).toHaveLength(1);

  document.body.innerHTML = '';
  show('premium:not-here');
  const outOfWalk = document.querySelector('.graph-gallery-credit__place');
  expect(outOfWalk).toHaveAttribute('aria-hidden', 'true');
  expect(outOfWalk).not.toHaveAttribute('role');
  // As many dots, and the long one still there, so the bar keeps its width.
  expect(outOfWalk?.querySelectorAll('i')).toHaveLength(dots ?? -1);
  expect(outOfWalk?.querySelectorAll('i.is-here.is-unlit')).toHaveLength(1);
});
