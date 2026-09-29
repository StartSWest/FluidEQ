/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import os from 'os';
import path from 'path';
import type { IpcMainInvokeEvent, WebContents } from 'electron';
import { readGpuPreference, writeGpuPreference } from 'main/graphicsPreference';
import {
  registerSettingsResetIpc,
  SETTINGS_RESET_CHANNEL,
  type ISettingsResetDeps,
} from 'main/ipc/settingsReset';
import {
  readMotionPreference,
  writeMotionPreference,
} from 'main/motionPreference';

type THandler = (event: IpcMainInvokeEvent) => unknown;
const mockHandlers = new Map<string, THandler>();
const mockLogin = { openAtLogin: true, refuse: false };

jest.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: THandler) =>
      mockHandlers.set(channel, handler),
    removeHandler: (channel: string) => mockHandlers.delete(channel),
  },
  app: {
    isPackaged: true,
    getAppPath: () => 'C:\\FluidEQ\\resources\\app.asar',
    getLoginItemSettings: () => ({
      openAtLogin: mockLogin.openAtLogin,
      executableWillLaunchAtLogin: mockLogin.openAtLogin,
    }),
    setLoginItemSettings: ({ openAtLogin }: { openAtLogin: boolean }) => {
      if (mockLogin.refuse) {
        throw new Error('Access is denied.');
      }
      mockLogin.openAtLogin = openAtLogin;
    },
  },
}));

const contents = () => ({ mainFrame: {} }) as unknown as WebContents;

/** A request from `sender`'s own page, or from a frame inside it. */
const askFrom = (sender: WebContents, fromInnerFrame = false) => {
  const handler = mockHandlers.get(SETTINGS_RESET_CHANNEL);
  if (!handler) {
    throw new Error('the reset channel was never registered');
  }
  return handler({
    sender,
    senderFrame: fromInnerFrame ? {} : sender.mainFrame,
  } as unknown as IpcMainInvokeEvent);
};

/**
 * "Reset all settings", main's half: every setting main keeps goes back to a
 * new install's, a part that fails does not stop the rest, and nobody but
 * FluidEQ's own window may ask.
 */
describe('resetting the settings main keeps', () => {
  let folder: string;
  let owner: WebContents;
  let deps: ISettingsResetDeps;
  let dispose: () => void;

  beforeEach(() => {
    folder = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-reset-'));
    writeMotionPreference(folder, 'reduced');
    writeGpuPreference(folder, 'high');
    mockLogin.openAtLogin = true;
    mockLogin.refuse = false;
    owner = contents();
    deps = {
      userDataDir: folder,
      ownerContents: () => owner,
      resetDesktopBackgrounds: jest.fn(),
      resetLighting: jest.fn(),
      unpinWindow: jest.fn(),
      logger: { error: jest.fn() },
    };
    ({ dispose } = registerSettingsResetIpc(deps));
  });
  afterEach(() => {
    dispose();
    fs.rmSync(folder, { recursive: true, force: true });
  });

  it('puts every one of them back as a new install has it', () => {
    askFrom(owner);

    expect(readMotionPreference(folder)).toBe('full');
    expect(readGpuPreference(folder)).toBe('auto');
    expect(mockLogin.openAtLogin).toBe(false);
    expect(deps.resetDesktopBackgrounds).toHaveBeenCalledTimes(1);
    expect(deps.resetLighting).toHaveBeenCalledTimes(1);
    expect(deps.unpinWindow).toHaveBeenCalledTimes(1);
    expect(deps.logger.error).not.toHaveBeenCalled();
  });

  it('resets the rest when Windows keeps the startup entry', () => {
    mockLogin.refuse = true;

    askFrom(owner);

    expect(mockLogin.openAtLogin).toBe(true);
    expect(deps.logger.error).toHaveBeenCalledWith(
      'Settings reset: could not reset the start with Windows',
      expect.any(Error),
    );
    expect(readMotionPreference(folder)).toBe('full');
    expect(deps.resetDesktopBackgrounds).toHaveBeenCalledTimes(1);
    expect(deps.unpinWindow).toHaveBeenCalledTimes(1);
  });

  it('resets the rest when one part throws', () => {
    jest.mocked(deps.resetDesktopBackgrounds).mockImplementation(() => {
      throw new Error('disposed');
    });

    askFrom(owner);

    expect(deps.logger.error).toHaveBeenCalledWith(
      'Settings reset: could not reset the desktop backgrounds',
      expect.any(Error),
    );
    expect(deps.resetLighting).toHaveBeenCalledTimes(1);
    expect(deps.unpinWindow).toHaveBeenCalledTimes(1);
  });

  it('answers nobody but FluidEQ’s own window', () => {
    expect(() => askFrom(contents())).toThrow(
      'Only FluidEQ resets its settings.',
    );
    expect(() => askFrom(owner, true)).toThrow(
      'Only FluidEQ resets its settings.',
    );

    expect(readMotionPreference(folder)).toBe('reduced');
    expect(readGpuPreference(folder)).toBe('high');
    expect(mockLogin.openAtLogin).toBe(true);
    expect(deps.resetDesktopBackgrounds).not.toHaveBeenCalled();
  });
});
