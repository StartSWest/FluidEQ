/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Studio lends the window its scene's colours only while its bench is on
 * screen. It stays mounted behind every other page and behind the player, and
 * the player wore the Studio's colours instead of the visualizer it was
 * playing (Ivan, 2026-09-24: "studio override style only while on studio
 * page").
 */

import { act, renderHook } from '@testing-library/react';
import type { IScenePack } from 'common/scenePacks';

const mockSetSource = jest.fn();
let mockShown: ((shown: boolean) => void) | undefined;
const mockStopWatching = jest.fn();

jest.mock('../../../renderer/utils/sceneTintStore', () => ({
  setStudioTintSource: (source: unknown) => mockSetSource(source),
  useStudioTintEnabled: () => true,
}));
jest.mock('../../../renderer/utils/observeShown', () => ({
  __esModule: true,
  default: (_element: Element, onChange: (shown: boolean) => void) => {
    mockShown = onChange;
    return mockStopWatching;
  },
}));

// eslint-disable-next-line import/first -- the store and watcher mocks above have to be in place first.
import useStudioTint from '../../../renderer/studio/useStudioTint';

const pack = { id: 'scene' } as unknown as IScenePack;

const renderBench = () => {
  const bench = { current: document.createElement('div') };
  return renderHook(() => useStudioTint(pack, 'project', 3, true, bench));
};

beforeEach(() => {
  mockSetSource.mockClear();
  mockStopWatching.mockClear();
  mockShown = undefined;
});

describe("the Studio's colours on the window", () => {
  it('are claimed only once the bench is on screen', () => {
    renderBench();
    expect(mockSetSource).toHaveBeenLastCalledWith(undefined);
    act(() => mockShown?.(true));
    expect(mockSetSource).toHaveBeenLastCalledWith(
      expect.objectContaining({
        project: 'project',
        playing: expect.objectContaining({ pack }),
      }),
    );
  });

  it('go back to the graph the moment the bench leaves the screen', () => {
    renderBench();
    act(() => mockShown?.(true));
    act(() => mockShown?.(false));
    expect(mockSetSource).toHaveBeenLastCalledWith(undefined);
  });

  it('stop watching the bench with the Studio', () => {
    const { unmount } = renderBench();
    unmount();
    expect(mockStopWatching).toHaveBeenCalled();
    expect(mockSetSource).toHaveBeenLastCalledWith(undefined);
  });
});
