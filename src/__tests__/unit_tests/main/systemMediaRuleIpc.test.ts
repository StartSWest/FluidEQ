/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The machine's other players, as main reads them (`ipc/systemMedia.ts`):
 * the rule between two of them runs on every reading, with or without a
 * window, and only the app's window may set its switch.
 *
 * @jest-environment node
 */
import { EventEmitter } from 'events';
import type { BrowserWindow } from 'electron';
import { SINGLE_PLAYER_CHANNEL } from '../../../common/singlePlayer';
import type { ISystemMediaSnapshot } from '../../../main/systemMedia';

const mockHandlers = new Map<string, (...args: unknown[]) => unknown>();
const mockMessages = new Map<string, (...args: unknown[]) => unknown>();
let mockNotify:
  ((snapshot: ISystemMediaSnapshot | undefined) => void) | undefined;
const mockPauseOthers = jest.fn((_exceptApp: string) => Promise.resolve());
const mockStop = jest.fn();

jest.mock('electron', () => ({
  app: { on: jest.fn() },
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) =>
      mockHandlers.set(channel, handler),
    on: (channel: string, listener: (...args: unknown[]) => unknown) =>
      mockMessages.set(channel, listener),
  },
}));
jest.mock('../../../main/systemMedia', () => ({
  getSystemMediaCover: jest.fn(),
  pauseOtherSystemPlayers: (exceptApp: string) => mockPauseOthers(exceptApp),
  sendSystemMediaCommand: jest.fn(),
  stopWatchingSystemMedia: () => mockStop(),
  watchSystemMedia: (
    notify: (snapshot: ISystemMediaSnapshot | undefined) => void,
  ) => {
    mockNotify = notify;
  },
}));
jest.mock('../../../main/mediaKeys', () => ({
  sendMediaTransportKey: jest.fn(),
}));
jest.mock('../../../main/groupMediaKeys', () => ({
  forwardGroupMediaCommand: jest.fn(),
}));

// eslint-disable-next-line import/first -- the Electron boundary is installed first
import registerSystemMediaIpc from '../../../main/ipc/systemMedia';

const reading = (...apps: string[]): ISystemMediaSnapshot => ({
  app: apps[0] ?? '',
  title: 'Song',
  artist: 'Band',
  isPlaying: apps.length > 0,
  positionMs: 0,
  durationMs: 0,
  canNext: false,
  canPrevious: false,
  canSeek: false,
  playing: apps,
  coverId: '',
});

const setUp = () => {
  mockHandlers.clear();
  mockMessages.clear();
  mockNotify = undefined;
  mockPauseOthers.mockClear();
  mockStop.mockClear();
  const page = Object.assign(new EventEmitter(), {
    isDestroyed: () => false,
    send: jest.fn(),
  });
  let window: BrowserWindow | null = {
    webContents: page,
    isDestroyed: () => false,
  } as unknown as BrowserWindow;
  const onMedia = jest.fn(() => Promise.resolve());
  registerSystemMediaIpc({ onMedia, getMainWindow: () => window });
  mockHandlers.get('system-media-watch')?.({ sender: page }, true);
  return {
    page,
    onMedia,
    letGo: () => {
      window = null;
    },
    switchFrom: (sender: unknown, isOn: unknown) =>
      mockMessages.get(SINGLE_PLAYER_CHANNEL)?.({ sender }, [isOn]),
  };
};

describe('the machine’s other players, read by main', () => {
  it('quietens the album for a video started over it, with no window', () => {
    const { letGo, onMedia } = setUp();
    letGo();
    mockNotify?.(reading('Spotify.exe'));
    mockNotify?.(reading('Spotify.exe', 'Chrome'));
    expect(mockPauseOthers).toHaveBeenCalledWith('Chrome');
    // The engine's song names keep coming too.
    expect(onMedia).toHaveBeenCalledTimes(2);
  });

  it('takes the one-player switch from the app’s window only', () => {
    const { page, switchFrom } = setUp();
    switchFrom(new EventEmitter(), false);
    mockNotify?.(reading('Spotify.exe'));
    mockNotify?.(reading('Spotify.exe', 'Chrome'));
    expect(mockPauseOthers).toHaveBeenCalledTimes(1);

    switchFrom(page, false);
    mockNotify?.(reading('Spotify.exe', 'Chrome', 'vlc.exe'));
    expect(mockPauseOthers).toHaveBeenCalledTimes(1);
    switchFrom(page, 'off');
    mockNotify?.(reading('Spotify.exe', 'Chrome', 'vlc.exe', 'Music.UI'));
    expect(mockPauseOthers).toHaveBeenCalledTimes(1);
  });

  it('pauses every other program when the window takes the sound', async () => {
    setUp();
    await mockHandlers.get('system-media-pause-others')?.({}, 'Chrome');
    expect(mockPauseOthers).toHaveBeenCalledWith('');
  });

  it('stops watching when the window asks, and not when it goes', () => {
    const { page, letGo } = setUp();
    letGo();
    page.emit('destroyed');
    expect(mockStop).not.toHaveBeenCalled();
    mockHandlers.get('system-media-watch')?.({ sender: page }, false);
    expect(mockStop).toHaveBeenCalledTimes(1);
  });
});
