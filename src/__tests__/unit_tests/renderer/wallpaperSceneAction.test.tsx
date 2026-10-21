/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * "Set as desktop background" on a scene's page: offered for a scene this
 * account owns, and only where the desktop can take a visualizer. A scene
 * not owned has the page's own Get as its way in, not a second lock here.
 */

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import type { IWallpaperState } from 'common/wallpaper';
import { useOwnsLook } from 'renderer/plus/sceneStore';
import { WallpaperSceneAction } from 'renderer/wallpaper/WallpaperControls';
import { openWallpaperDialog } from 'renderer/wallpaper/wallpaperDialogs';
import { useWallpaperState } from 'renderer/wallpaper/wallpaperStore';

jest.mock('renderer/plus/sceneStore', () => ({
  useOwnsLook: jest.fn(),
}));
jest.mock('renderer/wallpaper/wallpaperDialogs', () => ({
  openWallpaperDialog: jest.fn(),
  useWallpaperDialog: jest.fn(),
  closeWallpaperDialog: jest.fn(),
  openWallpaperManager: jest.fn(),
}));
jest.mock('renderer/wallpaper/wallpaperStore', () => ({
  useWallpaperState: jest.fn(),
  useWallpaperMutation: jest.fn(),
  stopWallpaper: jest.fn(),
}));

const display = { id: 1 } as unknown as IWallpaperState['displays'][number];

const withDesktop = (over: Partial<IWallpaperState> = {}) =>
  jest.mocked(useWallpaperState).mockReturnValue({
    supported: true,
    displays: [display],
    screens: [],
    pauseOnBattery: false,
    ...over,
  });

const owning = (owned: boolean) =>
  jest.mocked(useOwnsLook).mockReturnValue(owned);

beforeEach(() => jest.clearAllMocks());

describe('the desktop background button on a scene page', () => {
  it('asks which monitors for a scene this account owns', () => {
    withDesktop();
    owning(true);
    render(<WallpaperSceneAction lookId="premium:alpine" />);
    expect(useOwnsLook).toHaveBeenCalledWith('premium:alpine');
    fireEvent.click(
      screen.getByRole('button', { name: 'Set as desktop background' }),
    );
    expect(openWallpaperDialog).toHaveBeenCalledWith('premium:alpine');
  });

  /**
   * A scene's file stays on disk when it is no longer owned, and the page is
   * drawn from what is installed: without the check the button reached
   * accounts the desktop manager then refused, at the end of the dialog.
   */
  it('is not there for a scene this account does not own', () => {
    withDesktop();
    owning(false);
    const { container } = render(
      <WallpaperSceneAction lookId="premium:alpine" />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(openWallpaperDialog).not.toHaveBeenCalled();
  });

  it('is not there at all where the desktop cannot take a visualizer', () => {
    owning(true);
    withDesktop({ supported: false });
    const { container, rerender } = render(
      <WallpaperSceneAction lookId="premium:alpine" />,
    );
    expect(container).toBeEmptyDOMElement();
    withDesktop({ displays: [] });
    rerender(<WallpaperSceneAction lookId="premium:alpine" />);
    expect(container).toBeEmptyDOMElement();
  });
});
