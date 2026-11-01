/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The window's side of the Smart EQ song memory the core runs: the status
 * now, the clock while the core cannot hear, and the buttons — from the
 * app's own top frame only, and checked as anything from a page is.
 */
import type { BrowserWindow, IpcMainEvent } from 'electron';
import { SONG_EQ_CHANNEL } from 'common/songEqStatus';
import registerSongEqIpc from 'main/ipc/songEq';
import onWindowMessage from 'main/ipc/windowMessages';

jest.mock('main/ipc/windowMessages', () => ({
  __esModule: true,
  default: jest.fn(() => () => undefined),
}));

const mainFrame = {};
const webContents = { mainFrame, send: jest.fn() };
const window = { webContents } as unknown as BrowserWindow;
const STATUS = {
  isSaveOn: false,
  listenedMs: 0,
  willSave: false,
  needsClock: false,
};

const setUp = () => {
  (onWindowMessage as jest.Mock).mockClear();
  webContents.send.mockClear();
  const memory = {
    status: jest.fn(() => STATUS),
    tick: jest.fn(),
    act: jest.fn(),
  };
  registerSongEqIpc({ getMainWindow: () => window, memory });
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

it('answers the window that asks with the status now', () => {
  const { send } = setUp();
  send(SONG_EQ_CHANNEL.ask, []);
  expect(webContents.send).toHaveBeenCalledWith(SONG_EQ_CHANNEL.status, STATUS);
});

it('routes each button, and nothing that is not one', () => {
  const { memory, send } = setUp();
  const asked = [
    { kind: 'undo' },
    { kind: 'forget' },
    { kind: 'endNotice', id: 4 },
    { kind: 'setSaveOn', isSaveOn: true },
  ];
  asked.forEach((action) => send(SONG_EQ_CHANNEL.action, [action]));
  [
    { kind: 'endNotice', id: 'four' },
    { kind: 'endNotice', id: 1.5 },
    { kind: 'setSaveOn', isSaveOn: 'yes' },
    { kind: 'erase' },
    'undo',
    null,
  ].forEach((action) => send(SONG_EQ_CHANNEL.action, [action]));
  expect(memory.act.mock.calls.map(([action]) => action)).toEqual(asked);
});

it('takes the clock from the window', () => {
  const { memory, send } = setUp();
  send(SONG_EQ_CHANNEL.tick, []);
  expect(memory.tick).toHaveBeenCalledTimes(1);
});

it('takes nothing from another page or a frame inside the window', () => {
  const { memory, send } = setUp();
  send(SONG_EQ_CHANNEL.action, [{ kind: 'undo' }], webContents, {});
  send(SONG_EQ_CHANNEL.tick, [], { mainFrame: {} });
  send(SONG_EQ_CHANNEL.ask, [], { mainFrame: {} });
  expect(memory.act).not.toHaveBeenCalled();
  expect(memory.tick).not.toHaveBeenCalled();
  expect(webContents.send).not.toHaveBeenCalled();
  // POSITIVE CONTROL: the same from the app's own top frame is taken.
  send(SONG_EQ_CHANNEL.action, [{ kind: 'undo' }]);
  expect(memory.act).toHaveBeenCalledTimes(1);
});
