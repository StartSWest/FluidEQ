/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Opening at login is macOS's answer, as starting with Windows is Windows'.
 * A Mac login item carries no arguments, so a launch from login is known by
 * macOS's own `wasOpenedAtLogin`, and that launch starts hidden.
 */

import type * as OpenAtLoginMac from '../../../main/openAtLoginMac';

const mockGet = jest.fn();
const mockSet = jest.fn();
const mockApp = {
  isPackaged: true,
  getLoginItemSettings: (...args: unknown[]) => mockGet(...args),
  setLoginItemSettings: (...args: unknown[]) => mockSet(...args),
};

jest.mock('electron', () => ({ app: mockApp }));

const realPlatform = process.platform;
const onPlatform = (platform: string) =>
  Object.defineProperty(process, 'platform', { value: platform });

/** A fresh module, so the once-per-launch answer is not carried over. */
const load = (): typeof OpenAtLoginMac => {
  let loaded: typeof OpenAtLoginMac | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line global-require
    loaded = require('../../../main/openAtLoginMac');
  });
  if (!loaded) {
    throw new Error('openAtLoginMac did not load');
  }
  return loaded;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockApp.isPackaged = true;
  onPlatform('darwin');
});

afterAll(() => onPlatform(realPlatform));

describe('opening at login on a Mac', () => {
  it('reads macOS, with no Windows Startup apps switch to report', () => {
    mockGet.mockReturnValue({ openAtLogin: true, status: 'enabled' });
    expect(load().readOpenAtLoginMac()).toEqual({
      on: true,
      blockedByWindows: false,
    });
  });

  it('shows a login item waiting for approval as on, and says so', () => {
    mockGet.mockReturnValue({
      openAtLogin: false,
      status: 'requires-approval',
    });
    expect(load().readOpenAtLoginMac()).toEqual({
      on: true,
      blockedByWindows: false,
      needsApproval: true,
    });
  });

  it('writes the switch and believes macOS over the write', () => {
    mockGet.mockReturnValue({ openAtLogin: false, status: 'not-registered' });
    const { writeOpenAtLoginMac } = load();

    expect(writeOpenAtLoginMac(true)).toEqual({
      on: false,
      blockedByWindows: false,
      failed: true,
    });
    expect(mockSet).toHaveBeenCalledWith({ openAtLogin: true });
  });

  it('turns off without a fuss', () => {
    mockGet.mockReturnValue({ openAtLogin: false, status: 'not-registered' });
    expect(load().writeOpenAtLoginMac(false)).toEqual({
      on: false,
      blockedByWindows: false,
    });
  });

  it('never registers a development build, which is Electron itself', () => {
    mockApp.isPackaged = false;
    const unavailable = {
      on: false,
      blockedByWindows: false,
      unavailable: true,
    };
    const { readOpenAtLoginMac, writeOpenAtLoginMac } = load();

    expect(readOpenAtLoginMac()).toEqual(unavailable);
    expect(writeOpenAtLoginMac(true)).toEqual(unavailable);
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('reports a write macOS threw on', () => {
    mockGet.mockReturnValue({ openAtLogin: false, status: 'not-registered' });
    mockSet.mockImplementation(() => {
      throw new Error('refused');
    });
    expect(load().writeOpenAtLoginMac(true).failed).toBe(true);
  });
});

describe('a launch macOS opened at login', () => {
  it('starts hidden', () => {
    mockGet.mockReturnValue({ openAtLogin: true, wasOpenedAtLogin: true });
    expect(load().wasOpenedAtMacLogin()).toBe(true);
  });

  it('opens the window when somebody opened it themselves', () => {
    mockGet.mockReturnValue({ openAtLogin: true, wasOpenedAtLogin: false });
    expect(load().wasOpenedAtMacLogin()).toBe(false);
  });

  it('is asked once per launch', () => {
    mockGet.mockReturnValue({ openAtLogin: true, wasOpenedAtLogin: true });
    const { wasOpenedAtMacLogin } = load();
    wasOpenedAtMacLogin();
    wasOpenedAtMacLogin();
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('is never a Mac login on Windows, which has its own word', () => {
    onPlatform('win32');
    mockGet.mockReturnValue({ openAtLogin: true, wasOpenedAtLogin: true });
    expect(load().wasOpenedAtMacLogin()).toBe(false);
  });
});
