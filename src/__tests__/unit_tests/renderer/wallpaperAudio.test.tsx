/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { render } from '@testing-library/react';
import type { IWallpaperScreen } from '../../../common/wallpaper';
import { useLiveAudioCapture } from '../../../renderer/audio/LiveAudioContext';
import WallpaperAudio from '../../../renderer/wallpaper/WallpaperAudio';
import { useWallpaperState } from '../../../renderer/wallpaper/wallpaperStore';

jest.mock('../../../renderer/audio/LiveAudioContext', () => ({
  useLiveAudioCapture: jest.fn(),
  useLiveAudioControl: () => ({
    isPaused: false,
    readBackgroundFrame: async () => undefined,
  }),
}));
jest.mock('../../../renderer/wallpaper/wallpaperStore', () => ({
  useWallpaperState: jest.fn(),
}));

const withScreens = (screens: Partial<IWallpaperScreen>[]) =>
  jest.mocked(useWallpaperState).mockReturnValue({
    supported: true,
    displays: [],
    screens: screens as IWallpaperScreen[],
    pauseOnBattery: true,
  });

const captureHeld = () => {
  const { calls } = jest.mocked(useLiveAudioCapture).mock;
  return calls[calls.length - 1]?.[0];
};

beforeEach(() => jest.clearAllMocks());

describe('the capture a desktop background holds', () => {
  it('is held while a background follows the music', () => {
    withScreens([{ phase: 'running', motion: 'music' }]);
    render(<WallpaperAudio />);
    expect(captureHeld()).toBe(true);
  });

  // A calm background never hears the music, so nothing keeps the analyser
  // running for it while FluidEQ sits hidden.
  it('is not held for calm backgrounds alone, nor for ones paused or stopped', () => {
    withScreens([
      { phase: 'running', motion: 'calm' },
      { phase: 'paused', motion: 'music' },
      { phase: 'error', motion: 'music' },
    ]);
    render(<WallpaperAudio />);
    expect(captureHeld()).toBe(false);
  });
});
