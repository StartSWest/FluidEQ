/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * A chosen scene is only ever shown as itself, or its own state is shown in
 * its place: never a standard look standing in for it (Ivan, 2026-11-14:
 * "we cannot have fallbacks ... code it so only the full scene can show,
 * always"). The selection used to land on the scene's fallback form whenever
 * it could not play - set aside after a failure, gone from the account, no
 * graphics - and the graph drew that form. Held here on the real graph store
 * and scene lists: the selection stays the scene, on screen and on disk, the
 * reason is the scene's own, and the chart never mounts the 2D drawing for it.
 */

import '@testing-library/jest-dom';
import { act, render, renderHook, screen } from '@testing-library/react';
import { graphLookId } from 'common/graphStyles';
import { memberLookId } from 'common/memberScenes';
import type { IMemberSceneSummary } from 'main/memberScenes/store';
import Chart from 'renderer/graph/Chart';
import type { ILiveCurveData } from 'renderer/graph/ChartController';
import { refuseLook, resetLookRefusal } from 'renderer/graph/lookRefusal';
import { useSceneTrouble } from 'renderer/graph/sceneTrouble';
import {
  getGraphLookId,
  setGraphLook,
  useSceneLook,
} from 'renderer/utils/graphStyle';
import {
  adoptMemberSceneListingForTesting,
  blockMemberScene,
  unblockMemberScene,
} from 'renderer/utils/memberScenes';
import { STORAGE_KEY } from 'renderer/utils/graphStorage';

let mockCanDraw = true;
jest.mock('renderer/graph/sceneHealth', () => ({
  ...jest.requireActual('renderer/graph/sceneHealth'),
  isSceneRenderingAvailable: () => mockCanDraw,
}));
// The two things the chart can put on its plot, as markers: which one it
// mounts is the whole question.
jest.mock('renderer/graph/LiveTraceCanvas', () => () => (
  <div data-testid="standard-look" />
));
jest.mock('renderer/graph/ScenePlot', () => () => (
  <div data-testid="scene-plot" />
));
// The chart reads one thing of the EQ's, and its genre pins read the EQ
// itself, which is no part of this.
jest.mock('renderer/utils/FluidEqContext', () => ({
  ...jest.requireActual('renderer/utils/FluidEqContext'),
  useFluidEqContext: () => ({ bandSetReplacement: 0 }),
}));
jest.mock('renderer/graph/GenrePins', () => ({
  __esModule: true,
  default: () => null,
  useGenrePinSpots: () => [],
}));
jest.mock('renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

const ME = '4f1c2b9e-8d3a-4e7b-9c11-2a6f0d5e7b30';
const LOOK = memberLookId(ME, 'alpine');
const ALPINE: IMemberSceneSummary = {
  lookId: LOOK,
  authorId: ME,
  packId: 'alpine',
  version: 3,
  names: { en: 'Alpine' },
  swatch: ['#102030', '#a0b0c0'],
  own: true,
};

const chart = () =>
  render(
    <Chart
      data={[]}
      dimensions={{
        width: 800,
        height: 300,
        margins: { top: 10, right: 10, bottom: 20, left: 30 },
      }}
      liveCurves={[{} as ILiveCurveData]}
      isLiveOutputForeground
    />,
  );

const trouble = () => renderHook(() => useSceneTrouble()).result;

beforeEach(() => {
  mockCanDraw = true;
  resetLookRefusal();
  // Not the store's reset: it would drop the graph store's own listener.
  unblockMemberScene(LOOK);
  act(() =>
    adoptMemberSceneListingForTesting({ scenes: [ALPINE], locked: [] }),
  );
  act(() => setGraphLook(LOOK));
});

it('draws the scene while it can, and says nothing', () => {
  expect(renderHook(() => useSceneLook()).result.current?.lookId).toBe(LOOK);
  expect(trouble().current).toBeUndefined();
  chart();
  expect(screen.getByTestId('scene-plot')).toBeInTheDocument();
  expect(screen.queryByTestId('standard-look')).toBeNull();
});

it('keeps the scene chosen when it is set aside, and says why in its place', () => {
  act(() => blockMemberScene(LOOK));
  act(() => refuseLook(LOOK, ALPINE.names, 'compile'));

  expect(getGraphLookId()).toBe(LOOK);
  expect(trouble().current).toMatchObject({ lookId: LOOK, reason: 'compile' });
  chart();
  expect(
    screen.getByText(
      // The line opens a sentence: its first letter is a capital.
      'Graph.look.refused.compile:Alpine',
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'graph.look.retry' }),
  ).toBeVisible();
  expect(screen.queryByTestId('standard-look')).toBeNull();
});

it('keeps it chosen, on disk too, when the account no longer has it', () => {
  act(() => adoptMemberSceneListingForTesting({ scenes: [], locked: [] }));

  expect(getGraphLookId()).toBe(LOOK);
  expect(window.localStorage.getItem(STORAGE_KEY)).toBe(LOOK);
  expect(trouble().current?.reason).toBe('gone');
  chart();
  expect(screen.queryByTestId('standard-look')).toBeNull();
  // Gone is not mended by trying again.
  expect(screen.queryByRole('button', { name: 'graph.look.retry' })).toBeNull();
});

it('names the graphics, never "gone", on a computer that can draw no scene', () => {
  mockCanDraw = false;
  act(() =>
    adoptMemberSceneListingForTesting({ scenes: [ALPINE], locked: [] }),
  );

  expect(getGraphLookId()).toBe(LOOK);
  expect(trouble().current?.reason).toBe('unavailable');
  chart();
  expect(
    screen.getByText('Graph.look.refused.unavailable:Alpine'),
  ).toBeInTheDocument();
  expect(screen.queryByTestId('standard-look')).toBeNull();
});

it('control: a standard look chosen is drawn by the 2D canvas, as always', () => {
  act(() => setGraphLook(graphLookId('horizon', 'auto')));
  expect(trouble().current).toBeUndefined();
  chart();
  expect(screen.getByTestId('standard-look')).toBeInTheDocument();
});
