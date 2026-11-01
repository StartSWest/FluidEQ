/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The window's way to the core's Library player (`main/ipc/libraryPlayer.ts`):
 * only the app's own top frame is heard, an add is answered with how many
 * songs joined, and a page that goes puts its player away without having to
 * say so.
 */
import type { BrowserWindow, IpcMainEvent } from 'electron';
import { DSP_DEFAULTS } from 'common/dsp/chain';
import { PLAYER_RACK_CHANNEL } from 'common/library/playerRack';
import { LIBRARY_PLAYER_CHANNEL } from 'common/library/playerWire';
import { ErrorCode } from 'common/errors';
import registerLibraryPlayerIpc from 'main/ipc/libraryPlayer';
import onWindowMessage from 'main/ipc/windowMessages';
import type { ILibraryPlayer } from 'main/libraryPlayer/libraryPlayerTypes';

jest.mock('main/ipc/windowMessages', () => ({
  __esModule: true,
  default: jest.fn(() => () => undefined),
}));

type TPageListener = (...args: unknown[]) => void;

/** A page that can be made to go: its listeners, by event. */
const page = () => {
  const listeners = new Map<string, TPageListener[]>();
  const add = (name: string, listener: TPageListener) => {
    listeners.set(name, [...(listeners.get(name) ?? []), listener]);
  };
  return {
    mainFrame: {},
    on: jest.fn(add),
    once: jest.fn(add),
    fire: (name: string, ...args: unknown[]) =>
      (listeners.get(name) ?? []).forEach((listener) => listener(...args)),
  };
};

const RACK = {
  settings: { ...DSP_DEFAULTS, enabled: true },
  gate: { engine: 'fluid', eqEnabled: true, eqLoaded: true, engineOff: false },
};

const setUp = () => {
  (onWindowMessage as jest.Mock).mockClear();
  const webContents = page();
  const window = { webContents } as unknown as BrowserWindow;
  const player = {
    command: jest.fn(() => ({ joined: 2 })),
    deckReport: jest.fn(),
    rackCopy: jest.fn(),
    legacy: jest.fn(),
    away: jest.fn(),
    ask: jest.fn(),
  };
  registerLibraryPlayerIpc({
    getMainWindow: () => window,
    player: player as unknown as ILibraryPlayer,
  });
  const listeners = new Map(
    (onWindowMessage as jest.Mock).mock.calls as [
      string,
      (event: IpcMainEvent, ...args: unknown[]) => void,
    ][],
  );
  const send = (
    channel: string,
    args: unknown[],
    requestId?: number,
    from: { sender?: unknown; frame?: unknown } = {},
  ) => {
    const reply = jest.fn();
    const sender = from.sender ?? webContents;
    listeners.get(channel)?.(
      {
        sender,
        senderFrame: from.frame ?? webContents.mainFrame,
        reply,
      } as unknown as IpcMainEvent,
      args,
      requestId,
    );
    return reply;
  };
  return { player, send, webContents };
};

it('answers an add with how many songs joined', () => {
  const { player, send } = setUp();
  const reply = send(
    LIBRARY_PLAYER_CHANNEL.command,
    [{ kind: 'add', trackIds: ['a', 'b'] }],
    7,
  );
  expect(player.command).toHaveBeenCalledWith({
    kind: 'add',
    trackIds: ['a', 'b'],
  });
  expect(reply).toHaveBeenCalledWith(LIBRARY_PLAYER_CHANNEL.command, {
    result: 2,
  });
});

it('answers nothing to a press nobody waits on', () => {
  const { player, send } = setUp();
  const reply = send(LIBRARY_PLAYER_CHANNEL.command, [{ kind: 'stop' }]);
  expect(player.command).toHaveBeenCalledWith({ kind: 'stop' });
  expect(reply).not.toHaveBeenCalled();
});

it('refuses a press that is not whole, and says so to whoever waits', () => {
  const { player, send } = setUp();
  const reply = send(
    LIBRARY_PLAYER_CHANNEL.command,
    [{ kind: 'skip', direction: 2 }],
    8,
  );
  expect(player.command).not.toHaveBeenCalled();
  expect(reply).toHaveBeenCalledWith(LIBRARY_PLAYER_CHANNEL.command, {
    errorCode: ErrorCode.FAILURE,
  });
});

it('hears nothing from another page or a frame inside the window', () => {
  const { player, send } = setUp();
  const outsiders = [{ sender: page() }, { frame: {} }];
  outsiders.forEach((from) => {
    send(LIBRARY_PLAYER_CHANNEL.command, [{ kind: 'stop' }], undefined, from);
    send(
      LIBRARY_PLAYER_CHANNEL.deck,
      [{ kind: 'ended', trackId: 'a' }],
      undefined,
      from,
    );
    send(PLAYER_RACK_CHANNEL, [RACK], undefined, from);
    send(LIBRARY_PLAYER_CHANNEL.legacy, [{}], undefined, from);
    send(LIBRARY_PLAYER_CHANNEL.away, [], undefined, from);
    send(LIBRARY_PLAYER_CHANNEL.ask, [], undefined, from);
  });
  Object.values(player).forEach((call) => expect(call).not.toHaveBeenCalled());

  // POSITIVE CONTROL: the same from the app's own top frame reaches it all.
  send(LIBRARY_PLAYER_CHANNEL.command, [{ kind: 'stop' }]);
  send(LIBRARY_PLAYER_CHANNEL.deck, [{ kind: 'ended', trackId: 'a' }]);
  send(PLAYER_RACK_CHANNEL, [RACK]);
  send(LIBRARY_PLAYER_CHANNEL.legacy, [{}]);
  send(LIBRARY_PLAYER_CHANNEL.away, []);
  send(LIBRARY_PLAYER_CHANNEL.ask, []);
  Object.values(player).forEach((call) =>
    expect(call).toHaveBeenCalledTimes(1),
  );
});

describe('a page that goes', () => {
  it.each([
    ['is closed', 'destroyed', []],
    ['crashes', 'render-process-gone', []],
    [
      'reloads or loads another page',
      'did-start-navigation',
      [{}, 'x', false, true],
    ],
  ])('puts the player away when it %s', (_what, event, args) => {
    const { player, send, webContents } = setUp();
    send(PLAYER_RACK_CHANNEL, [RACK]);
    webContents.fire(event, ...args);
    expect(player.away).toHaveBeenCalledTimes(1);
  });

  it('is not gone when a frame inside it moves, or it moves within itself', () => {
    const { player, send, webContents } = setUp();
    send(PLAYER_RACK_CHANNEL, [RACK]);
    webContents.fire('did-start-navigation', {}, 'x', false, false);
    webContents.fire('did-start-navigation', {}, '#songs', true, true);
    expect(player.away).not.toHaveBeenCalled();
  });

  it('is watched once however many racks it hands over', () => {
    const { player, send, webContents } = setUp();
    send(PLAYER_RACK_CHANNEL, [RACK]);
    send(PLAYER_RACK_CHANNEL, [RACK]);
    expect(player.rackCopy).toHaveBeenCalledTimes(2);
    webContents.fire('render-process-gone');
    expect(player.away).toHaveBeenCalledTimes(1);
  });

  it('is not watched before it hands over a rack that can be read', () => {
    const { player, send, webContents } = setUp();
    send(PLAYER_RACK_CHANNEL, [{ settings: 'none' }]);
    webContents.fire('destroyed');
    expect(player.rackCopy).not.toHaveBeenCalled();
    expect(player.away).not.toHaveBeenCalled();
  });
});
