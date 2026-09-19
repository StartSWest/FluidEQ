/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { app } from 'electron';
import {
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
    // launch something that is not FluidEQ.
    expect(mockGet).toHaveBeenCalledWith({ path: process.execPath, args: [] });
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
      args: [],
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

  it('registers Electron with the app beside it while in development', () => {
    Object.defineProperty(app, 'isPackaged', { value: false });
    mockGet.mockReturnValue(settings(false));

    writeStartWithWindows(true);

    // Without the app path a development entry opens an empty Electron at
    // every sign-in.
    expect(mockSet).toHaveBeenCalledWith({
      path: process.execPath,
      args: ['D:/app'],
      openAtLogin: true,
    });
    Object.defineProperty(app, 'isPackaged', { value: true });
  });
});
