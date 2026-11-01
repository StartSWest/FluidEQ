/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What Windows puts in front, handed to the core's game sound
 * (`gameSound.ts`): watched while the core has profiles to match or the
 * Games page asks, FluidEQ's own window never counted, and the card drawn
 * where the game is in the window's colours.
 */
import type { BrowserWindow, IpcMainEvent } from 'electron';
import type { IGameProgram } from 'common/games';
import { registerGamesIpc } from 'main/ipc/games';
import type { IGameWatch } from 'main/gameWatch';

type TMessage = (event: IpcMainEvent, arg: unknown) => void;
const mockMessages = new Map<string, TMessage>();

jest.mock('electron', () => ({
  ipcMain: {
    handle: () => undefined,
    on: (channel: string, listener: TMessage) =>
      mockMessages.set(channel, listener),
  },
  app: {
    on: () => undefined,
    getPath: () => 'C:\\Program Files\\FluidEQ\\FluidEQ.exe',
  },
  dialog: {},
}));

const OURS: IGameProgram = {
  name: 'FluidEQ',
  path: 'C:\\Program Files\\FluidEQ\\FluidEQ.exe',
  source: 'running',
  pid: 1,
};
const OVERWATCH: IGameProgram = {
  name: 'Overwatch',
  path: 'D:\\GAMES\\Overwatch.exe',
  source: 'running',
  pid: 4242,
  rect: '0,0,1920,1080',
};

const setUp = (coreWants = false) => {
  mockMessages.clear();
  let front: (program: IGameProgram) => void = () => undefined;
  let gone: (pid: number) => void = () => undefined;
  const watch: IGameWatch = {
    start: jest.fn(),
    stop: jest.fn(),
    running: jest.fn(async () => []),
    hold: jest.fn(),
    isWatching: () => false,
  };
  const send = jest.fn();
  const webContents = { send, isDestroyed: () => false };
  const window = {
    webContents,
    isDestroyed: () => false,
  } as unknown as BrowserWindow;
  const deps = {
    getMainWindow: () => window,
    scan: jest.fn(async () => []),
    makeWatch: (
      onFront: (program: IGameProgram) => void,
      onGone: (pid: number) => void,
    ) => {
      front = onFront;
      gone = onGone;
      return watch;
    },
    toasts: { show: jest.fn(), close: jest.fn() },
    onFront: jest.fn(),
    onGone: jest.fn(),
    coreWantsWatch: jest.fn(() => coreWants),
    sounding: jest.fn(() => ({ gameId: 'overwatch', presetId: 'gaming' })),
  };
  const games = registerGamesIpc(deps);
  const message = (channel: string, arg: unknown, sender = webContents) =>
    mockMessages.get(channel)?.({ sender } as unknown as IpcMainEvent, arg);
  return {
    deps,
    games,
    watch,
    send,
    message,
    front: (program: IGameProgram) => front(program),
    gone: (pid: number) => gone(pid),
  };
};

it('watches from the start where the core has profiles to match, window or none', () => {
  const { watch } = setUp(true);
  expect(watch.start).toHaveBeenCalled();
  // POSITIVE CONTROL: with nothing to match, nothing is watched.
  const idle = setUp(false);
  expect(idle.watch.start).not.toHaveBeenCalled();
});

it('watches while the Games page asks, and stops when it lets go and the core wants nothing', () => {
  const { watch, message, deps, games } = setUp(false);
  (watch.stop as jest.Mock).mockClear();
  message('game-watch', [true]);
  expect(watch.start).toHaveBeenCalledTimes(1);
  message('game-watch', [false]);
  expect(watch.stop).toHaveBeenCalledTimes(1);
  // The page letting go leaves the core's own watching alone.
  deps.coreWantsWatch.mockReturnValue(true);
  games.refreshWatch();
  message('game-watch', [false]);
  expect(watch.stop).toHaveBeenCalledTimes(1);
});

it('hands the core every program brought to the front but its own window, and tells the page', () => {
  const { deps, send, front } = setUp(true);
  front(OURS);
  expect(deps.onFront).not.toHaveBeenCalled();
  front(OVERWATCH);
  expect(deps.onFront).toHaveBeenCalledWith(OVERWATCH);
  expect(send).toHaveBeenCalledWith('game-foreground', OVERWATCH);
});

it('tells the core the held game ended', () => {
  const { deps, gone } = setUp(true);
  gone(4242);
  expect(deps.onGone).toHaveBeenCalledWith(4242);
});

it('draws the card where the game was, in the window’s colours as it last said them', () => {
  const { deps, games, message, front } = setUp(true);
  front(OVERWATCH);
  message('game-card-colours', [{ accent: '#0af', panel: 7 }]);
  games.showCard({ what: 'Loaded Gaming', game: 'for Overwatch' });
  expect(deps.toasts.show).toHaveBeenCalledWith({
    what: 'Loaded Gaming',
    game: 'for Overwatch',
    colors: { accent: '#0af' },
    rect: OVERWATCH.rect,
  });
});

it('takes the colours from the app’s own window only', () => {
  const { deps, games, message } = setUp(true);
  message('game-card-colours', [{ accent: '#f00' }], {
    send: jest.fn(),
    isDestroyed: () => false,
  });
  games.showCard({ what: 'Loaded Gaming', game: 'for Overwatch' });
  expect(deps.toasts.show).toHaveBeenCalledWith({
    what: 'Loaded Gaming',
    game: 'for Overwatch',
  });
});

it('answers a window that asks which game’s sound is on, and tells it of each change', () => {
  const { send, message, games } = setUp(true);
  message('game-sounding-ask', []);
  expect(send).toHaveBeenCalledWith('game-sounding', {
    gameId: 'overwatch',
    presetId: 'gaming',
  });
  games.tellSounding(undefined);
  expect(send).toHaveBeenLastCalledWith('game-sounding', null);
});
