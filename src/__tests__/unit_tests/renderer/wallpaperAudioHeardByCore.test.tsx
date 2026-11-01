/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The window holds no capture for the desktop backgrounds while the core
 * hears their music: a capture held here is Chromium's, and the whole window
 * kept awake behind a minimise with it. It holds one where the core cannot
 * hear, as it always did, and tells main when what it shows is what this
 * computer sends to another.
 */
import { render } from '@testing-library/react';
import type { IWallpaperState } from 'common/wallpaper';
import WallpaperAudio from 'renderer/wallpaper/WallpaperAudio';

const mockCapture = jest.fn();
let mockSharing = false;
let mockState: IWallpaperState;

jest.mock('renderer/audio/LiveAudioContext', () => ({
  useLiveAudioCapture: (wanted: boolean, kind: string) =>
    mockCapture(wanted, kind),
  useLiveAudioControl: () => ({
    isPaused: false,
    isSharingAudio: mockSharing,
    readBackgroundFrame: () => Promise.resolve(undefined),
  }),
}));
jest.mock('renderer/wallpaper/wallpaperStore', () => ({
  useWallpaperState: () => mockState,
}));

const following: IWallpaperState['screens'][number] = {
  displayId: 2,
  lookId: 'premium:alpine',
  wave: { height: 1, position: 0 },
  motion: 'music',
  phase: 'running',
};

const stateWith = (heardByCore: boolean | undefined): IWallpaperState => ({
  supported: true,
  displays: [],
  screens: [following],
  pauseOnBattery: true,
  ...(heardByCore === undefined ? {} : { heardByCore }),
});

const setSoundFromWindow = jest.fn();

beforeEach(() => {
  mockCapture.mockClear();
  setSoundFromWindow.mockClear();
  mockSharing = false;
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: { setWallpaperSoundFromWindow: setSoundFromWindow } },
  });
});

afterEach(() => {
  Reflect.deleteProperty(window, 'electron');
});

describe('the window’s part in the backgrounds’ music', () => {
  it('holds no capture for them while the core hears it', () => {
    mockState = stateWith(true);
    render(<WallpaperAudio />);

    expect(mockCapture).toHaveBeenLastCalledWith(false, 'work');
  });

  it('holds one where the core cannot hear, or main never said', () => {
    mockState = stateWith(false);
    const { unmount } = render(<WallpaperAudio />);
    expect(mockCapture).toHaveBeenLastCalledWith(true, 'work');
    unmount();

    mockState = stateWith(undefined);
    render(<WallpaperAudio />);
    expect(mockCapture).toHaveBeenLastCalledWith(true, 'work');
  });

  it('tells main whether it shows what this computer sends', () => {
    mockState = stateWith(true);
    mockSharing = true;
    const { rerender } = render(<WallpaperAudio />);
    expect(setSoundFromWindow).toHaveBeenLastCalledWith(true);

    mockSharing = false;
    rerender(<WallpaperAudio />);
    expect(setSoundFromWindow).toHaveBeenLastCalledWith(false);
  });
});
