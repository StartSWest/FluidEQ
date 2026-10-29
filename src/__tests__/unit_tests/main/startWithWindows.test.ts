/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { app } from 'electron';
import {
  moveStartWithWindowsIntoTray,
  readStartWithWindows,
  writeStartWithWindows,
} from '../../../main/startWithWindows';

/**
 * Starting with Windows is Windows' answer, not the app's.
 *
 * Nothing is stored here, so every assertion is about believing the system
 * over the write: a switch that says "on" while Windows will not launch the
 * app is the whole failure this row has to avoid, and it is the state a
 * person creates by turning FluidEQ off in Windows' own Startup apps.
 */

const mockGet = jest.fn();
const mockSet = jest.fn();

jest.mock('electron', () => ({
  app: {
    isPackaged: true,
    getAppPath: () => 'D:/app',
    getLoginItemSettings: (...args: unknown[]) => mockGet(...args),
    setLoginItemSettings: (...args: unknown[]) => mockSet(...args),
  },
}));

const settings = (openAtLogin: boolean, willLaunch = openAtLogin) => ({
  openAtLogin,
  executableWillLaunchAtLogin: willLaunch,
});

describe('starting with Windows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('asks Windows about the command it would actually register', () => {
    mockGet.mockReturnValue(settings(false));
    expect(readStartWithWindows()).toEqual({
      on: false,
      blockedByWindows: false,
    });
    // A packaged app is its own executable; an entry for anything else would
    // launch something that is not FluidEQ. Told to start in the tray.
    expect(mockGet).toHaveBeenCalledWith({
      path: process.execPath,
      args: ['--start-in-tray'],
    });
  });

  it('says so when the entry is written and Windows will not honour it', () => {
    mockGet.mockReturnValue(settings(true, false));
    expect(readStartWithWindows()).toEqual({
      on: true,
      blockedByWindows: true,
    });
  });

  it('never calls an account that is off "blocked"', () => {
    mockGet.mockReturnValue(settings(false, false));
    expect(readStartWithWindows().blockedByWindows).toBe(false);
  });

  it('writes the person’s own entry, with no administrator anywhere', () => {
    mockGet.mockReturnValue(settings(true));
    expect(writeStartWithWindows(true)).toEqual({
      on: true,
      blockedByWindows: false,
    });
    expect(mockSet).toHaveBeenCalledWith({
      path: process.execPath,
      args: ['--start-in-tray'],
      openAtLogin: true,
    });
  });

  it('reports a write Windows did not take, rather than the switch asked for', () => {
    // Windows kept it off: an entry a policy or another program removed.
    mockGet.mockReturnValue(settings(false));
    expect(writeStartWithWindows(true)).toEqual({
      on: false,
      blockedByWindows: false,
      failed: true,
    });
  });

  it('reports a refusal, and leaves the row showing what Windows says', () => {
    mockSet.mockImplementation(() => {
      throw new Error('refused');
    });
    mockGet.mockReturnValue(settings(false));
    const logger = { error: jest.fn() };

    expect(writeStartWithWindows(true, logger)).toEqual({
      on: false,
      blockedByWindows: false,
      failed: true,
    });
    expect(logger.error).toHaveBeenCalled();
  });

  it('writes no entry in development, which Windows could only fail to start', () => {
    Object.defineProperty(app, 'isPackaged', { value: false });
    mockGet.mockReturnValue(settings(true));
    try {
      // Electron pointed at the checkout ran main.ts as plain JavaScript and
      // put a syntax error on screen at every sign-in.
      expect(writeStartWithWindows(true)).toEqual({
        on: false,
        blockedByWindows: false,
        unavailable: true,
      });
      expect(readStartWithWindows().unavailable).toBe(true);
      expect(moveStartWithWindowsIntoTray()).toBe(false);
      expect(mockSet).not.toHaveBeenCalled();
      expect(mockGet).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(app, 'isPackaged', { value: true });
    }
  });
});

/**
 * An entry written before the tray's word opened the window at every sign-in.
 * Windows compares the whole command, so the old entry and the new one are
 * told apart by the word alone, and Electron's write would switch Windows'
 * own Startup apps entry back on unless handed what it was.
 */
describe('moving an older startup entry into the tray', () => {
  const entries = ({
    tray,
    window,
  }: {
    tray: ReturnType<typeof settings>;
    window: ReturnType<typeof settings>;
  }) =>
    mockGet.mockImplementation(({ args }: { args: string[] }) =>
      args.includes('--start-in-tray') ? tray : window,
    );
  const logger = { info: jest.fn(), error: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSet.mockReset();
  });

  it('rewrites an entry that opens the window, as one that starts in the tray', () => {
    // Read back after the write: Windows now holds the tray's entry.
    let written = false;
    mockSet.mockImplementation(() => {
      written = true;
    });
    mockGet.mockImplementation(({ args }: { args: string[] }) =>
      args.includes('--start-in-tray') ? settings(written) : settings(true),
    );

    expect(moveStartWithWindowsIntoTray(logger)).toBe(true);
    expect(mockSet).toHaveBeenCalledWith({
      path: process.execPath,
      args: ['--start-in-tray'],
      openAtLogin: true,
      enabled: true,
    });
    expect(logger.info).toHaveBeenCalled();
  });

  it('keeps an entry switched off in Startup apps switched off', () => {
    entries({ tray: settings(false), window: settings(true, false) });

    moveStartWithWindowsIntoTray(logger);

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ args: ['--start-in-tray'], enabled: false }),
    );
  });

  it('writes nothing when the entry already starts in the tray', () => {
    entries({ tray: settings(true), window: settings(false) });

    expect(moveStartWithWindowsIntoTray(logger)).toBe(false);
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('writes nothing for somebody who never asked to start with Windows', () => {
    entries({ tray: settings(false), window: settings(false) });

    expect(moveStartWithWindowsIntoTray(logger)).toBe(false);
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('says so when Windows refuses the move, and leaves the old entry working', () => {
    entries({ tray: settings(false), window: settings(true) });
    mockSet.mockImplementation(() => {
      throw new Error('refused');
    });

    expect(moveStartWithWindowsIntoTray(logger)).toBe(false);
    expect(logger.error).toHaveBeenCalled();
  });
});
