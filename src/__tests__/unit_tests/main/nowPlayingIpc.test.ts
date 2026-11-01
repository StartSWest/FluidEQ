/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the window's players play, for the core's jobs that follow songs:
 * from the app's own top frame only, and checked as anything from a page is.
 */
import type { BrowserWindow, IpcMainEvent } from 'electron';
import NOW_PLAYING_CHANNEL from 'common/nowPlaying';
import registerNowPlayingIpc, { toSongIdentity } from 'main/ipc/nowPlaying';
import onWindowMessage from 'main/ipc/windowMessages';

jest.mock('main/ipc/windowMessages', () => ({
  __esModule: true,
  default: jest.fn(() => () => undefined),
}));

const mainFrame = {};
const webContents = { mainFrame };
const window = { webContents } as unknown as BrowserWindow;

const SONG = {
  key: 'library:C:\\Music\\First.flac',
  title: 'First',
  artist: 'Artist',
  source: 'library',
};

const setUp = () => {
  (onWindowMessage as jest.Mock).mockClear();
  const onNowPlaying = jest.fn();
  registerNowPlayingIpc({ getMainWindow: () => window, onNowPlaying });
  const [[channel, listener]] = (onWindowMessage as jest.Mock).mock.calls as [
    string,
    (event: IpcMainEvent, arg: unknown) => void,
  ][];
  expect(channel).toBe(NOW_PLAYING_CHANNEL);
  const send = (
    arg: unknown,
    sender: unknown = webContents,
    frame: unknown = mainFrame,
  ) => listener({ sender, senderFrame: frame } as unknown as IpcMainEvent, arg);
  return { onNowPlaying, send };
};

it('hears what the window’s players play, and nothing playing as nothing', () => {
  const { onNowPlaying, send } = setUp();
  send([SONG, true, true]);
  expect(onNowPlaying).toHaveBeenLastCalledWith({
    identity: SONG,
    isPlaying: true,
    isLibrary: true,
  });
  send([null, false, false]);
  expect(onNowPlaying).toHaveBeenLastCalledWith({
    identity: undefined,
    isPlaying: false,
    isLibrary: false,
  });
});

it.each([
  [
    'a name that is not one',
    [{ key: '', title: 'x', source: 'library' }, true, false],
  ],
  ['a source it does not know', [{ ...SONG, source: 'radio' }, true, false]],
  ['no word on whether it plays', [SONG, 'yes', false]],
  ['no word on which player plays it', [SONG, true, 'library']],
  [
    'text too long to be a name',
    [{ ...SONG, title: 'x'.repeat(4000) }, true, false],
  ],
])('ignores %s rather than reading it as a stop', (_what, arg) => {
  const { onNowPlaying, send } = setUp();
  send(arg);
  expect(onNowPlaying).not.toHaveBeenCalled();
});

it('keeps only the fields a song is named by', () => {
  expect(toSongIdentity({ ...SONG, extra: 'kept?' })).toEqual(SONG);
});

it('takes nothing from another page or a frame inside the window', () => {
  const { onNowPlaying, send } = setUp();
  send([SONG, true, false], { mainFrame: {} });
  send([SONG, true, false], webContents, {});
  expect(onNowPlaying).not.toHaveBeenCalled();
  // POSITIVE CONTROL: the same from the app's own top frame is taken.
  send([SONG, true, false]);
  expect(onNowPlaying).toHaveBeenCalledTimes(1);
});
