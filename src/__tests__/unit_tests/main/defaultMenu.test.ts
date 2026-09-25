/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Electron's default menu is built at launch unless the app says, before
 * `ready`, that it wants none. A release on Windows and Linux never shows
 * one; a Mac needs its Edit menu for Command+C and Command+V in text fields.
 */

const mockSetApplicationMenu = jest.fn();

jest.mock('electron', () => ({
  app: {},
  shell: {},
  BrowserWindow: class {},
  Menu: {
    setApplicationMenu: (...args: unknown[]) => mockSetApplicationMenu(...args),
  },
}));

// eslint-disable-next-line import/first -- the mock above must be in place first
import { declineDefaultMenu } from 'main/menu';

const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
const originalNodeEnv = process.env.NODE_ENV;
const originalDebugProd = process.env.DEBUG_PROD;

const runAs = (platform: NodeJS.Platform, nodeEnv: string) => {
  Object.defineProperty(process, 'platform', { value: platform });
  process.env.NODE_ENV = nodeEnv;
  declineDefaultMenu();
};

beforeEach(() => {
  mockSetApplicationMenu.mockClear();
  delete process.env.DEBUG_PROD;
});

afterEach(() => {
  if (originalPlatform) {
    Object.defineProperty(process, 'platform', originalPlatform);
  }
  process.env.NODE_ENV = originalNodeEnv;
  if (originalDebugProd === undefined) {
    delete process.env.DEBUG_PROD;
  } else {
    process.env.DEBUG_PROD = originalDebugProd;
  }
});

it.each(['win32', 'linux'] as const)(
  'declines the default menu in a %s release',
  (platform) => {
    runAs(platform, 'production');
    expect(mockSetApplicationMenu).toHaveBeenCalledWith(null);
  },
);

it('keeps it on a Mac, where the Edit menu is what copy and paste run on', () => {
  runAs('darwin', 'production');
  expect(mockSetApplicationMenu).not.toHaveBeenCalled();
});

it('leaves development and DEBUG_PROD to build their own menu', () => {
  runAs('win32', 'development');
  process.env.DEBUG_PROD = 'true';
  runAs('linux', 'production');
  expect(mockSetApplicationMenu).not.toHaveBeenCalled();
});
