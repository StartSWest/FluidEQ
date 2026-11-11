/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A look the graph had to put aside says why, on the graph (Ivan,
 * 2026-11-11: three of his scenes "didn't take", the graph quietly showed a
 * standard look, and the reason — a shader that would not compile — was only
 * in the log). The scene's loop is stood in for, so the test hands the
 * canvas its failures itself; the notice and Try again are the real ones.
 */

import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GraphLookRefusedNotice from '../../../renderer/graph/GraphLookRefusedNotice';
import {
  resetLookRefusal,
  useLookRefusal,
} from '../../../renderer/graph/lookRefusal';
import SceneCanvas from '../../../renderer/graph/SceneCanvas';
import type { ISceneSource } from '../../../renderer/graph/sceneRunnerTypes';
import type { IUsableMemberScene } from '../../../renderer/utils/memberScenes';

let mockSource: ISceneSource | undefined;
jest.mock('../../../renderer/graph/useSceneRunner', () => ({
  __esModule: true,
  default: (options: { source: ISceneSource }) => {
    mockSource = options.source;
    return { current: null };
  },
}));
jest.mock('../../../renderer/audio/LiveAudioContext', () => ({
  useLiveAudioCapture: jest.fn(),
}));
jest.mock('../../../renderer/graph/sceneUpdateStore', () => ({
  reportScenePlayed: () => Promise.resolve(),
}));
const mockSetLook = jest.fn();
jest.mock('../../../renderer/utils/graphStyle', () => ({
  ...jest.requireActual('../../../renderer/utils/graphStyle'),
  setGraphLook: (id: string) => mockSetLook(id),
}));
const mockUnblock = jest.fn();
jest.mock('../../../renderer/utils/memberScenes', () => ({
  ...jest.requireActual('../../../renderer/utils/memberScenes'),
  unblockMemberScene: (id: string) => mockUnblock(id),
  blockMemberScene: jest.fn(),
  reportMemberSceneFailure: () => Promise.resolve(),
}));
jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

const ME = '4f1c2b9e-8d3a-4e7b-9c11-2a6f0d5e7b30';
const LOOK = `member:${ME}:waveform-3d`;
const scene: IUsableMemberScene = {
  kind: 'member',
  lookId: LOOK,
  authorId: ME,
  packId: 'waveform-3d',
  version: 1,
  names: { en: 'Waveform 3D' },
  fallbackStyle: 'skyline',
  swatch: ['#102030', '#a0b0c0'],
  own: true,
};

let seen: ReturnType<typeof useLookRefusal>;
function Spy() {
  seen = useLookRefusal();
  return null;
}

const mount = () => {
  const target = document.createElement('div');
  document.body.appendChild(target);
  return render(
    <>
      <SceneCanvas scene={scene} target={target} plot={undefined} />
      <GraphLookRefusedNotice />
      <Spy />
    </>,
  );
};

const source = () => {
  if (!mockSource) {
    throw new Error('the graph handed the runner no source');
  }
  return mockSource;
};

beforeEach(() => {
  resetLookRefusal();
  mockSource = undefined;
  mockSetLook.mockClear();
  mockUnblock.mockClear();
});

afterEach(() => {
  document.body.innerHTML = '';
});

it('says nothing while the picked look plays', () => {
  mount();
  act(() => source().built?.());
  expect(seen).toBeUndefined();
  expect(screen.queryByRole('button', { name: 'graph.look.retry' })).toBeNull();
});

it('says on the graph that a look’s code would not build here, and tries it again', async () => {
  mount();
  act(() =>
    source().reportFailure('compile', "'uPalette_colours' : undeclared"),
  );
  expect(
    screen.getByText('graph.look.refused.compile:Waveform 3D'),
  ).toBeInTheDocument();
  await userEvent.click(
    screen.getByRole('button', { name: 'graph.look.retry' }),
  );
  expect(mockUnblock).toHaveBeenCalledWith(LOOK);
  expect(mockSetLook).toHaveBeenCalledWith(LOOK);
  expect(seen).toBeUndefined();
});

it('names each other reason the graph puts a look aside', () => {
  mount();
  act(() => source().tooSlow());
  expect(seen?.reason).toBe('heavy');
  act(() => source().block());
  expect(seen?.reason).toBe('unavailable');
  act(() => source().reportFailure('gpu-reset'));
  expect(seen?.reason).toBe('driver');
  expect(seen?.lookId).toBe(LOOK);
});

it('takes the notice away once the look draws after all', () => {
  mount();
  act(() => source().reportFailure('compile'));
  expect(seen?.reason).toBe('compile');
  act(() => source().built?.());
  expect(seen).toBeUndefined();
});

// A newer version that will not build is not the look failing: the one
// before it plays on, and the graph says nothing.
it('says nothing when only a newer version would not build', () => {
  mount();
  act(() => source().versionFailed?.('ERROR: 0:3'));
  expect(seen).toBeUndefined();
});

it('names one of FluidEQ’s own looks by its look id', () => {
  const target = document.createElement('div');
  document.body.appendChild(target);
  render(
    <>
      <SceneCanvas
        scene={{
          id: 'aurora',
          version: 1,
          lookId: 'premium:aurora',
          names: { en: 'Aurora' },
          fallbackStyle: 'skyline',
          swatch: ['#102030', '#a0b0c0'],
        }}
        target={target}
        plot={undefined}
      />
      <Spy />
    </>,
  );
  act(() => source().tooSlow());
  expect(seen).toMatchObject({ lookId: 'premium:aurora', reason: 'heavy' });
});
