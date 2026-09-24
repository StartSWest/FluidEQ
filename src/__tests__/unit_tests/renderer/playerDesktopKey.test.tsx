/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import DesktopKey from 'renderer/player/DesktopKey';
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

describe("the desktop key in the corner of the player's equalizer screen", () => {
  it('opens the monitors dialog for the scene behind the curve', () => {
    withState({});
    render(<DesktopKey lookId="premium:crystal" />);
    const key = screen.getByRole('button', {
      name: 'Set as desktop background',
    });
    expect(key).toHaveClass('player-eq-screen__desktop');
    expect(key).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(key);
    expect(openWallpaperDialog).toHaveBeenCalledWith('premium:crystal');
  });

  it('is lit while that scene is on a monitor, and not for another or a failed one', () => {
    withState({ screens: [screenFor('premium:crystal')] });
    const { rerender } = render(<DesktopKey lookId="premium:crystal" />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');

    rerender(<DesktopKey lookId="premium:alpine" />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');

    withState({ screens: [screenFor('premium:alpine', 'error')] });
    rerender(<DesktopKey lookId="premium:alpine" />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
  });

  it('is not drawn where the desktop cannot take a visualizer', () => {
    withState({ supported: false });
    const { container, rerender } = render(
      <DesktopKey lookId="premium:crystal" />,
    );
    expect(container).toBeEmptyDOMElement();
    withState({ displays: [] });
    rerender(<DesktopKey lookId="premium:crystal" />);
    expect(container).toBeEmptyDOMElement();
  });
});
