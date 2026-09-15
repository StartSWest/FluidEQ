/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import type { IWallpaperState } from 'common/wallpaper';
import { requestAccountPanel } from 'renderer/account/accountPanel';
import { useEntitlement } from 'renderer/account/entitlementStore';
import { WallpaperSceneAction } from 'renderer/wallpaper/WallpaperControls';
import { openWallpaperDialog } from 'renderer/wallpaper/wallpaperDialogs';
import { useWallpaperState } from 'renderer/wallpaper/wallpaperStore';

jest.mock('renderer/account/accountPanel', () => ({
  requestAccountPanel: jest.fn(),
}));
jest.mock('renderer/account/entitlementStore', () => ({
  useEntitlement: jest.fn(),
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

const paying = (state: 'active' | 'none') =>
  jest
    .mocked(useEntitlement)
    .mockReturnValue({ state } as ReturnType<typeof useEntitlement>);

beforeEach(() => jest.clearAllMocks());

describe('the desktop background button on a scene page', () => {
  it('asks which monitors while the account pays', () => {
    withDesktop();
    paying('active');
    render(<WallpaperSceneAction lookId="premium:alpine" />);
    const button = screen.getByRole('button', {
      name: 'Set as desktop background',
    });
    fireEvent.click(button);
    expect(openWallpaperDialog).toHaveBeenCalledWith('premium:alpine');
    expect(requestAccountPanel).not.toHaveBeenCalled();
  });

  /**
   * A scene's file stays on disk when Plus lapses, and the page offers this
   * button from what is installed: without the check it reached accounts the
   * desktop manager then refused, at the end of the monitors dialog.
   */
  it('leads to Plus instead, without Plus, and never opens the dialog', () => {
    withDesktop();
    paying('none');
    render(<WallpaperSceneAction lookId="premium:alpine" />);
    const button = screen.getByRole('button', {
      name: 'Set as desktop background',
    });
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute(
      'title',
      'Set as desktop background, with FluidEQ Plus',
    );
    fireEvent.click(button);
    expect(requestAccountPanel).toHaveBeenCalledWith('subscribe');
    expect(openWallpaperDialog).not.toHaveBeenCalled();
  });

  it('is not there at all where the desktop cannot take a visualizer', () => {
    paying('none');
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
