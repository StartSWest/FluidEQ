/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The project on the Studio's bench hands the window its palette as the
 * member edits it, only while the bench is on screen, and takes it back when
 * the bench leaves (`useStudioAppColours`); the Library's player reports a
 * pack it loaded, so the window follows a visualizer the graph never drew
 * (`useGraphScenePack`).
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import type { IScenePack } from 'common/scenePacks';
import type { ISceneTuning } from '../../../renderer/graph/sceneTuner';
import { rainbowFromPalette } from '../../../renderer/utils/rainbowPalette';

const mockSetStudio = jest.fn();
const mockReport = jest.fn();
let mockShown: ((shown: boolean) => void) | undefined;

jest.mock('../../../renderer/utils/sceneAppColours', () => ({
  ...jest.requireActual('../../../renderer/utils/sceneAppColours'),
  setStudioAppColours: (stops: unknown) => mockSetStudio(stops),
  reportSceneColourControls: (lookId: string, pack: unknown) =>
    mockReport(lookId, pack),
}));
jest.mock('../../../renderer/utils/observeShown', () => ({
  __esModule: true,
  default: (_element: Element, onChange: (shown: boolean) => void) => {
    mockShown = onChange;
    return () => undefined;
  },
}));
const mockPack = {
  id: 'forest',
  version: 1,
  names: { en: 'Forest' },
  params: [],
  palettes: [
    { id: 'colours', names: { en: 'C' }, stops: ['#2040ff', '#ff2020'] },
  ],
} as unknown as IScenePack;
jest.mock('../../../renderer/utils/graphStyle', () => ({
  useSceneLook: () => ({ lookId: 'premium:forest', id: 'forest', version: 1 }),
}));
jest.mock('../../../renderer/utils/scenePacks', () => ({
  loadScenePack: () => Promise.resolve(mockPack),
}));

/* eslint-disable import/first -- the mocks above have to be in place first */
import useGraphScenePack from '../../../renderer/player/useGraphScenePack';
import useStudioAppColours from '../../../renderer/studio/useStudioAppColours';
/* eslint-enable import/first */

const pack = {
  params: [],
  palettes: [
    { id: 'colours', names: { en: 'C' }, stops: ['#2040ff', '#ff2020'] },
  ],
} as unknown as IScenePack;

beforeEach(() => {
  mockSetStudio.mockClear();
  mockReport.mockClear();
  mockShown = undefined;
});

describe('the Studio project’s palette on the window', () => {
  const renderBench = (tuning: ISceneTuning) => {
    const bench = { current: document.createElement('div') };
    return renderHook(
      ({ edit }: { edit: ISceneTuning }) =>
        useStudioAppColours(pack, edit, bench),
      { initialProps: { edit: tuning } },
    );
  };

  it('is handed over once the bench is on screen, and follows each edit', () => {
    const { rerender } = renderBench({});
    expect(mockSetStudio).toHaveBeenLastCalledWith(undefined);
    act(() => mockShown?.(true));
    expect(mockSetStudio).toHaveBeenLastCalledWith(
      rainbowFromPalette({ stops: ['#2040ff', '#ff2020'] }),
    );
    rerender({
      edit: { palettes: { colours: { stops: ['#20d040', '#ffd000'] } } },
    });
    expect(mockSetStudio).toHaveBeenLastCalledWith(
      rainbowFromPalette({ stops: ['#20d040', '#ffd000'] }),
    );
  });

  it('is taken back when the bench leaves the screen and with the Studio', () => {
    const { unmount } = renderBench({});
    act(() => mockShown?.(true));
    act(() => mockShown?.(false));
    expect(mockSetStudio).toHaveBeenLastCalledWith(undefined);
    act(() => mockShown?.(true));
    unmount();
    expect(mockSetStudio).toHaveBeenLastCalledWith(undefined);
  });
});

describe('a visualizer the Library’s player loaded', () => {
  it('reports its colours for the window', async () => {
    renderHook(() => useGraphScenePack());
    await waitFor(() =>
      expect(mockReport).toHaveBeenCalledWith('premium:forest', mockPack),
    );
  });
});
