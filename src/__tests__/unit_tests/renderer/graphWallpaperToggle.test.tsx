/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import GraphWallpaperToggle from 'renderer/graph/GraphWallpaperToggle';
import { openWallpaperDialog } from 'renderer/wallpaper/wallpaperDialogs';
import { useWallpaperState } from 'renderer/wallpaper/wallpaperStore';
import type { IWallpaperState } from 'common/wallpaper';

jest.mock('renderer/wallpaper/wallpaperDialogs', () => ({
  openWallpaperDialog: jest.fn(),
}));
jest.mock('renderer/wallpaper/wallpaperStore', () => ({
  useWallpaperState: jest.fn(),
}));

const display = { id: 1 } as unknown as IWallpaperState['displays'][number];
const screenFor = (lookId: string, phase = 'running') =>
  ({
    displayId: 1,
    lookId,
    phase,
  }) as unknown as IWallpaperState['screens'][number];

const withState = (over: Partial<IWallpaperState>) =>
  jest.mocked(useWallpaperState).mockReturnValue({
    supported: true,
    displays: [display],
    screens: [],
    pauseOnBattery: false,
    ...over,
  });

beforeEach(() => jest.clearAllMocks());

describe('the desktop background switch on the graph', () => {
  it('opens the dialog for the scene on the graph rather than setting it itself', () => {
    withState({});
    render(<GraphWallpaperToggle lookId="premium:alpine" />);
    const button = screen.getByRole('button', {
      name: 'Set as desktop background',
    });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(button);
    expect(openWallpaperDialog).toHaveBeenCalledWith('premium:alpine');
  });

  it('is lit while this scene is on a monitor, and not for another scene or a failed one', () => {
    withState({ screens: [screenFor('premium:alpine')] });
    const { rerender } = render(
      <GraphWallpaperToggle lookId="premium:alpine" />,
    );
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');

    rerender(<GraphWallpaperToggle lookId="premium:aurora" />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');

    withState({ screens: [screenFor('premium:aurora', 'error')] });
    rerender(<GraphWallpaperToggle lookId="premium:aurora" />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
  });

  it('is not there where the desktop cannot take a visualizer', () => {
    withState({ supported: false });
    const { container, rerender } = render(
      <GraphWallpaperToggle lookId="premium:alpine" />,
    );
    expect(container).toBeEmptyDOMElement();
    withState({ displays: [] });
    rerender(<GraphWallpaperToggle lookId="premium:alpine" />);
    expect(container).toBeEmptyDOMElement();
  });
});
