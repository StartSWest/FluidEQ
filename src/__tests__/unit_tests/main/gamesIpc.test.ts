/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the Games page is told is installed, and when that is read again.
 *
 * Every visit to the page ran the PowerShell registry scan, read every store's
 * manifests and drew an icon per game — moving between the app's own pages
 * included, where nothing can have been installed in between. A game is
 * installed from its launcher, with FluidEQ's window behind it, so the answer
 * is kept until the window has lost the front.
 */

import type { BrowserWindow } from 'electron';
import log from 'electron-log';
import type { IGameProgram } from 'common/games';
import { registerGamesIpc, type IGameProgramsAnswer } from 'main/ipc/games';
import type { IGameWatch } from 'main/gameWatch';

type THandler = () => Promise<IGameProgramsAnswer>;
const mockHandlers = new Map<string, THandler>();
const mockAppListeners = new Map<string, (...args: unknown[]) => void>();
const mockGetFileIcon = jest.fn();

jest.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: THandler) =>
      mockHandlers.set(channel, handler),
    on: () => undefined,
  },
  app: {
    on: (event: string, listener: (...args: unknown[]) => void) =>
      mockAppListeners.set(event, listener),
    getPath: () => 'C:\\Program Files\\FluidEQ\\FluidEQ.exe',
    getFileIcon: (...args: unknown[]) => mockGetFileIcon(...args),
  },
  dialog: {},
}));

const OVERWATCH: IGameProgram = {
  name: 'Overwatch',
  path: 'D:\\GAMES\\Overwatch.exe',
  source: 'battlenet',
};
const HALO: IGameProgram = {
  name: 'Halo Infinite',
  path: 'D:\\GAMES\\HaloInfinite.exe',
  source: 'steam',
};
const CHROME: IGameProgram = {
  name: 'Google Chrome',
  path: 'C:\\Program Files\\Google\\Chrome\\chrome.exe',
  source: 'running',
  pid: 5150,
};

const mainWindow = {} as BrowserWindow;
let scan: jest.Mock<Promise<IGameProgram[]>, []>;

const ask = (): Promise<IGameProgramsAnswer> => {
  const handler = mockHandlers.get('game-programs');
  if (!handler) {
    throw new Error('the programs channel was never registered');
  }
  return handler();
};

/** Windows taking the front from a window, as Electron's `app` reports it. */
const loseTheFront = (window: BrowserWindow) =>
  mockAppListeners.get('browser-window-blur')?.({}, window);

beforeEach(() => {
  mockHandlers.clear();
  mockAppListeners.clear();
  mockGetFileIcon.mockReset().mockResolvedValue({
    isEmpty: () => false,
    toDataURL: () => 'data:image/png;base64,AAAA',
  });
  scan = jest.fn(async () => [OVERWATCH]);
  const watch: IGameWatch = {
    start: jest.fn(),
    stop: jest.fn(),
    running: jest.fn(async () => [CHROME]),
    hold: jest.fn(),
    isWatching: () => false,
  };
  registerGamesIpc({
    getMainWindow: () => mainWindow,
    scan,
    makeWatch: () => watch,
    toasts: { show: jest.fn(), close: jest.fn() },
  });
});

it('reads the launchers once while the window keeps the front', async () => {
  const first = await ask();
  const second = await ask();

  expect(scan).toHaveBeenCalledTimes(1);
  expect(second).toEqual(first);
  expect(second.installed).toEqual([
    { ...OVERWATCH, icon: 'data:image/png;base64,AAAA' },
  ]);
  // What is running is asked every time, and its icons are read once.
  expect(second.running).toEqual([
    { ...CHROME, icon: 'data:image/png;base64,AAAA' },
  ]);
  expect(mockGetFileIcon).toHaveBeenCalledTimes(2);
});

it('reads them again once the window has lost the front', async () => {
  await ask();
  scan.mockResolvedValueOnce([OVERWATCH, HALO]);

  // The control: another window of the app losing the front says nothing
  // about what the player did meanwhile.
  loseTheFront({} as BrowserWindow);
  await ask();
  expect(scan).toHaveBeenCalledTimes(1);

  loseTheFront(mainWindow);
  const after = await ask();
  expect(scan).toHaveBeenCalledTimes(2);
  expect(after.installed.map((one) => one.name)).toEqual([
    'Overwatch',
    'Halo Infinite',
  ]);
  // Only the new game's icon is read; Overwatch's is the one read before.
  expect(mockGetFileIcon).toHaveBeenCalledTimes(3);
});

it('does not keep a scan that failed', async () => {
  const said = jest.spyOn(log, 'info').mockImplementation(() => undefined);
  scan.mockRejectedValueOnce(new Error('registry unreadable'));

  expect((await ask()).installed).toEqual([]);
  expect(said).toHaveBeenCalledWith(
    'Game profiles: the libraries could not be read',
    expect.any(Error),
  );
  expect((await ask()).installed.map((one) => one.name)).toEqual(['Overwatch']);
  expect(scan).toHaveBeenCalledTimes(2);
  said.mockRestore();
});

it('does not keep an icon that could not be read', async () => {
  const drawn = mockGetFileIcon.getMockImplementation();
  mockGetFileIcon.mockImplementation(async (file: unknown) => {
    if (file === OVERWATCH.path) {
      throw new Error('still installing');
    }
    return drawn?.(file);
  });

  expect((await ask()).installed[0]).not.toHaveProperty('icon');
  mockGetFileIcon.mockImplementation(drawn);
  loseTheFront(mainWindow);
  expect((await ask()).installed[0]).toHaveProperty(
    'icon',
    'data:image/png;base64,AAAA',
  );
});
