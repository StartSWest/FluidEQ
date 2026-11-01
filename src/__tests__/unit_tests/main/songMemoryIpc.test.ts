/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The window's side of the song memory the core runs: the clock, the cards'
 * buttons and the switch — from the app's own top frame only, and checked as
 * anything from a page is. What the players play is `nowPlayingIpc.test.ts`.
 */
import type { BrowserWindow, IpcMainEvent } from 'electron';
import { SONG_MEMORY_CHANNEL } from 'common/songMemoryStatus';
import registerSongMemoryIpc from 'main/ipc/songMemory';
import onWindowMessage from 'main/ipc/windowMessages';

jest.mock('main/ipc/windowMessages', () => ({
  __esModule: true,
  default: jest.fn(() => () => undefined),
}));

const mainFrame = {};
const webContents = { mainFrame, send: jest.fn() };
const window = { webContents } as unknown as BrowserWindow;

const setUp = () => {
  (onWindowMessage as jest.Mock).mockClear();
  webContents.send.mockClear();
  const memory = {
    status: jest.fn(() => ({ isOn: true, needsClock: false })),
    tick: jest.fn(),
    undo: jest.fn(),
    dontSave: jest.fn(),
    forgetNoticed: jest.fn(),
    endNotice: jest.fn(),
    setOn: jest.fn(),
    handOver: jest.fn(),
  };
  registerSongMemoryIpc({ getMainWindow: () => window, memory });
  const listeners = new Map(
    (onWindowMessage as jest.Mock).mock.calls.map(([channel, listener]) => [
      channel,
      listener as (event: IpcMainEvent, arg: unknown) => void,
    ]),
  );
  const send = (
    channel: string,
    arg: unknown,
    sender: unknown = webContents,
    frame: unknown = mainFrame,
  ) =>
    listeners.get(channel)?.(
      { sender, senderFrame: frame } as unknown as IpcMainEvent,
      arg,
    );
  return { memory, send };
};

it('routes each of the cards’ buttons and the switch', () => {
  const { memory, send } = setUp();
  send(SONG_MEMORY_CHANNEL.action, [{ kind: 'undo' }]);
  send(SONG_MEMORY_CHANNEL.action, [{ kind: 'dontSave' }]);
  send(SONG_MEMORY_CHANNEL.action, [{ kind: 'forget' }]);
  send(SONG_MEMORY_CHANNEL.action, [{ kind: 'endNotice', id: 3 }]);
  send(SONG_MEMORY_CHANNEL.action, [{ kind: 'setOn', isOn: false }]);
  send(SONG_MEMORY_CHANNEL.action, [{ kind: 'endNotice', id: 'three' }]);
  send(SONG_MEMORY_CHANNEL.action, [{ kind: 'setOn', isOn: 'no' }]);
  expect(memory.undo).toHaveBeenCalledTimes(1);
  expect(memory.dontSave).toHaveBeenCalledTimes(1);
  expect(memory.forgetNoticed).toHaveBeenCalledTimes(1);
  expect(memory.endNotice).toHaveBeenCalledTimes(1);
  expect(memory.endNotice).toHaveBeenCalledWith(3);
  expect(memory.setOn).toHaveBeenCalledTimes(1);
  expect(memory.setOn).toHaveBeenCalledWith(false);
});

it('answers the window that asks with the status now', () => {
  const { send } = setUp();
  send(SONG_MEMORY_CHANNEL.ask, []);
  expect(webContents.send).toHaveBeenCalledWith(SONG_MEMORY_CHANNEL.status, {
    isOn: true,
    needsClock: false,
  });
});

it('takes the clock and an old switch from the window', () => {
  const { memory, send } = setUp();
  send(SONG_MEMORY_CHANNEL.tick, []);
  send(SONG_MEMORY_CHANNEL.handOver, [true]);
  send(SONG_MEMORY_CHANNEL.handOver, ['true']);
  expect(memory.tick).toHaveBeenCalledTimes(1);
  expect(memory.handOver).toHaveBeenCalledTimes(1);
  expect(memory.handOver).toHaveBeenCalledWith(true);
});

it('takes nothing from another page or a frame inside the window', () => {
  const { memory, send } = setUp();
  send(SONG_MEMORY_CHANNEL.action, [{ kind: 'undo' }], webContents, {});
  send(SONG_MEMORY_CHANNEL.tick, [], { mainFrame: {} });
  expect(memory.undo).not.toHaveBeenCalled();
  expect(memory.tick).not.toHaveBeenCalled();
  // POSITIVE CONTROL: the same from the app's own top frame is taken.
  send(SONG_MEMORY_CHANNEL.action, [{ kind: 'undo' }]);
  expect(memory.undo).toHaveBeenCalledTimes(1);
});
