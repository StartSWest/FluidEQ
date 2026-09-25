/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Which scene's elements the window shows. One at a time: the Studio's project
 * while the Studio has the window in Ambient mode, even with the graph in
 * Ambient mode too; the graph's visualizer otherwise; nothing while neither
 * asked for it.
 */

import '@testing-library/jest-dom';
import { act, render, waitFor } from '@testing-library/react';
import type { IScenePack } from '../../../common/scenePacks';
import SceneAmbient from '../../../renderer/ambient/SceneAmbient';
import { loadScenePack } from '../../../renderer/utils/scenePacks';
import {
  useSceneTintMode,
  useStudioTintMode,
  useStudioTintSource,
} from '../../../renderer/utils/sceneTintStore';
import { useSceneLook } from '../../../renderer/utils/graphStyle';

jest.mock('../../../renderer/audio/LiveAudioContext', () => ({
  useLiveAudioControl: () => ({ readFrame: () => undefined, isPaused: true }),
}));
jest.mock('../../../renderer/utils/graphStyle', () => ({
  useSceneLook: jest.fn(),
}));
jest.mock('../../../renderer/utils/scenePacks', () => ({
  loadScenePack: jest.fn(),
}));
jest.mock('../../../renderer/utils/memberScenes', () => ({
  loadMemberScene: jest.fn(),
}));
// Which modes count as Ambient is the store's own rule, kept real.
jest.mock('../../../renderer/utils/sceneTintStore', () => ({
  isAmbientMode: jest.requireActual<
    typeof import('../../../renderer/utils/sceneTintStore')
  >('../../../renderer/utils/sceneTintStore').isAmbientMode,
  useSceneTintMode: jest.fn(),
  useStudioTintMode: jest.fn(),
  useStudioTintSource: jest.fn(),
}));

const withBirds = (id: string): IScenePack =>
  ({
    id,
    version: 1,
    params: [],
    source: '',
    ambient: {
      elements: [
        {
          id: 'gulls',
          shape: 'bird',
          colours: ['#dfe9ff'],
          count: 4,
          size: [14, 24],
          opacity: 0.7,
          motion: 'fly',
          speed: 0.3,
          area: 'top',
          flap: 0.7,
          turn: 0.3,
          music: 'none',
          react: 0,
        },
      ],
      params: [],
    },
  }) as unknown as IScenePack;

const plain = (id: string): IScenePack =>
  ({ id, version: 1, params: [], source: '' }) as unknown as IScenePack;

const layer = () => document.body.querySelector('canvas.scene-ambient');

beforeEach(() => {
  jest.clearAllMocks();
  // jsdom draws nothing; which layer is on screen is the question here.
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  jest.mocked(useSceneLook).mockReturnValue({
    id: 'alpine',
    version: 1,
    lookId: 'premium:alpine',
  } as ReturnType<typeof useSceneLook>);
  jest.mocked(loadScenePack).mockResolvedValue(withBirds('alpine'));
  jest.mocked(useSceneTintMode).mockReturnValue('pulse');
  jest.mocked(useStudioTintMode).mockReturnValue('pulse');
  jest.mocked(useStudioTintSource).mockReturnValue(undefined);
});

afterEach(() => jest.restoreAllMocks());

it('flies the graph visualizer’s elements while the graph is in Ambient mode', async () => {
  render(<SceneAmbient />);
  await waitFor(() => expect(layer()).toBeInTheDocument());
  expect(loadScenePack).toHaveBeenCalledWith('alpine');
});

it('flies them in the Backdrop too, which is Ambient with the scene behind the window', async () => {
  jest.mocked(useSceneTintMode).mockReturnValue('cover');
  render(<SceneAmbient />);
  await waitFor(() => expect(layer()).toBeInTheDocument());
  expect(loadScenePack).toHaveBeenCalledWith('alpine');
});

it('shows nothing of the graph’s while the graph is not in Ambient mode', async () => {
  jest.mocked(useSceneTintMode).mockReturnValue('tint');
  render(<SceneAmbient />);
  await act(async () => {
    await Promise.resolve();
  });
  expect(loadScenePack).not.toHaveBeenCalled();
  expect(layer()).not.toBeInTheDocument();
});

it('shows only the Studio’s project while the Studio is in Ambient mode, graph or no graph', async () => {
  jest.mocked(useStudioTintSource).mockReturnValue({
    project: 'alpine-project',
    playing: { build: 'launch:alpine#1', pack: withBirds('alpine-studio') },
  });
  render(<SceneAmbient />);
  await waitFor(() => expect(layer()).toBeInTheDocument());
  // The graph's visualizer was never even loaded for its elements.
  expect(loadScenePack).not.toHaveBeenCalled();
});

it('shows none of the graph’s when the Studio’s project brings none of its own', async () => {
  jest.mocked(useStudioTintSource).mockReturnValue({
    project: 'plain-project',
    playing: { build: 'launch:plain#1', pack: plain('plain-studio') },
  });
  render(<SceneAmbient />);
  await act(async () => {
    await Promise.resolve();
  });
  expect(loadScenePack).not.toHaveBeenCalled();
  expect(layer()).not.toBeInTheDocument();
});
