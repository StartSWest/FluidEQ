/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import SceneKeys from 'renderer/player/SceneKeys';
import { openWallpaperDialog } from 'renderer/wallpaper/wallpaperDialogs';
import { useWallpaperState } from 'renderer/wallpaper/wallpaperStore';
import type { IWallpaperState } from 'common/wallpaper';

jest.mock('renderer/wallpaper/wallpaperDialogs', () => ({
  openWallpaperDialog: jest.fn(),
}));
jest.mock('renderer/wallpaper/wallpaperStore', () => ({
  useWallpaperState: jest.fn(),
}));
jest.mock('renderer/plus/GalleryParts', () => ({
  usePlusEntitled: () => true,
}));
jest.mock('renderer/lighting/lightingStore', () => ({
  setLightingSettings: jest.fn(),
  useLighting: () => ({
    loaded: true,
    state: {
      supported: true,
      searching: false,
      settings: {
        enabled: false,
        brightness: 0.85,
        pulse: 'full',
        muted: [],
        profiles: {},
      },
      devices: [],
      synapse: 'unknown',
      hasRazerDevices: false,
      heldByWindows: [],
      canOpenRazerChroma: false,
      live: false,
    },
  }),
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

describe("the scene's switches in the corner of the player's equalizer screen", () => {
  it("stand in the graph's order: the window's colour, the desk lights, the desktop", () => {
    withState({});
    const { container } = render(<SceneKeys lookId="premium:crystal" />);
    const keys = [...container.querySelectorAll('button')].map(
      (button) => button.className,
    );
    expect(keys).toHaveLength(3);
    expect(keys[0]).toContain('graph-scene-tint');
    expect(keys[1]).toContain('graph-lighting');
    expect(keys[2]).toContain('graph-wallpaper');
    expect(container.firstElementChild).toHaveClass('player-eq-screen__keys');
  });

  it('opens the monitors dialog for the scene behind the curve', () => {
    withState({});
    render(<SceneKeys lookId="premium:crystal" />);
    const key = screen.getByRole('button', {
      name: 'Set as desktop background',
    });
    expect(key).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(key);
    expect(openWallpaperDialog).toHaveBeenCalledWith('premium:crystal');
  });

  it('lights the desktop key while that scene is on a monitor, and not for another or a failed one', () => {
    withState({ screens: [screenFor('premium:crystal')] });
    const { rerender } = render(<SceneKeys lookId="premium:crystal" />);
    const desktop = () =>
      screen.getByRole('button', {
        name: /desktop background|desktop$/i,
      });
    expect(desktop()).toHaveAttribute('aria-pressed', 'true');

    rerender(<SceneKeys lookId="premium:alpine" />);
    expect(desktop()).toHaveAttribute('aria-pressed', 'false');

    withState({ screens: [screenFor('premium:alpine', 'error')] });
    rerender(<SceneKeys lookId="premium:alpine" />);
    expect(desktop()).toHaveAttribute('aria-pressed', 'false');
  });

  it('leaves the desktop key out where the desktop cannot take a visualizer', () => {
    withState({ supported: false });
    const { container } = render(<SceneKeys lookId="premium:crystal" />);
    expect(container.querySelector('.graph-wallpaper')).toBeNull();
    // The other two are still there: they do not depend on the desktop.
    expect(container.querySelectorAll('button')).toHaveLength(2);
  });
});
