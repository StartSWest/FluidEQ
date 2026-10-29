/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A second launch hands itself to the copy already running, which opens its
 * window — what somebody pressing the shortcut wanted. Windows' sign-in launch
 * asks for the tray instead, and finding FluidEQ running must not open the
 * window it was told to keep closed.
 */

import type { BrowserWindow } from 'electron';
import claimTheOnlyCopy from '../../../main/onlyCopy';

const mockHandlers = new Map<string, (...args: unknown[]) => void>();

jest.mock('electron', () => ({
  app: {
    isPackaged: true,
    getAppPath: () => 'D:/app',
    getPath: () => 'C:/Users/Ana/AppData/Roaming',
    // This copy is the second: it hands over at once, and only the handler it
    // registered for the first copy's role is under test.
    requestSingleInstanceLock: () => false,
    quit: jest.fn(),
    on: (event: string, handler: (...args: unknown[]) => void) => {
      mockHandlers.set(event, handler);
    },
  },
}));
jest.mock('electron-log', () => ({ warn: jest.fn(), info: jest.fn() }));
jest.mock('../../../main/singleInstance', () => ({
  claimInstance: jest.fn(),
  describeInstanceHolder: () => Promise.resolve(''),
  instanceLockPath: () => 'lock',
}));
jest.mock('../../../main/appLinks', () => ({
  appLinkInArgs: () => undefined,
  deliverAppLink: jest.fn(),
}));
jest.mock('../../../main/asyncWriter', () => ({
  sweepAbandonedWrites: () => Promise.resolve(0),
}));
jest.mock('../../../main/karaokeMakerStorage', () => ({
  karaokeMakerDraftDir: () => 'drafts',
}));
jest.mock('../../../main/karaokeSeparation', () => ({
  karaokeStemsDir: () => 'stems',
}));

const hiddenWindow = () => ({
  isDestroyed: () => false,
  isMinimized: () => false,
  restore: jest.fn(),
  show: jest.fn(),
  focus: jest.fn(),
});

const secondLaunch = async (argv: string[]) => {
  const window = hiddenWindow();
  mockHandlers.clear();
  await claimTheOnlyCopy({
    userDataDir: 'C:/Users/Ana/AppData/Roaming/fluideq-app',
    getMainWindow: () => window as unknown as BrowserWindow,
  });
  const handOver = mockHandlers.get('second-instance');
  if (!handOver) {
    throw new Error('no second-instance handler was registered');
  }
  handOver({}, argv);
  return window;
};

describe('a second launch reaching the copy already running', () => {
  it('opens the window for somebody who launched FluidEQ again', async () => {
    const window = await secondLaunch(['C:/FluidEQ/FluidEQ.exe']);
    expect(window.show).toHaveBeenCalled();
    expect(window.focus).toHaveBeenCalled();
  });

  it('keeps it closed for Windows starting FluidEQ in the tray', async () => {
    const window = await secondLaunch([
      'C:/FluidEQ/FluidEQ.exe',
      '--start-in-tray',
    ]);
    expect(window.show).not.toHaveBeenCalled();
    expect(window.focus).not.toHaveBeenCalled();
  });
});
