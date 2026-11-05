/** @jest-environment node */
/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { EventEmitter } from 'events';
import { globalShortcut, type BrowserWindow } from 'electron';
import { ENGINE_KEY_GET } from '../../../common/engineKey';
import installEngineKey, { resetEngineKey } from '../../../main/engineKey';

let mockFolder: string;
const mockHandlers = new Map<string, (...args: unknown[]) => unknown>();

jest.mock('electron', () => ({
  app: { getPath: () => mockFolder },
  globalShortcut: { register: jest.fn(() => true), unregister: jest.fn() },
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) =>
      mockHandlers.set(channel, handler),
    removeHandler: (channel: string) => mockHandlers.delete(channel),
  },
}));

const createWindow = () =>
  Object.assign(new EventEmitter(), {
    isDestroyed: () => false,
    webContents: {
      mainFrame: {},
      isDestroyed: () => false,
      send: jest.fn(),
    },
  });

describe('resetting the engine shortcut preference', () => {
  let window: ReturnType<typeof createWindow>;
  const saved = () => path.join(mockFolder, 'engine-key.json');

  beforeEach(() => {
    mockFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-key-reset-'));
    fs.writeFileSync(saved(), JSON.stringify({ accelerator: 'F13' }));
    jest.mocked(globalShortcut.register).mockClear();
    jest.mocked(globalShortcut.unregister).mockClear();
    window = createWindow();
    installEngineKey(window as unknown as BrowserWindow);
  });

  afterEach(() => {
    window.emit('closed');
    fs.rmSync(mockFolder, { recursive: true, force: true });
  });

  it('releases the active key and persists no shortcut before answering', async () => {
    expect(globalShortcut.register).toHaveBeenCalledWith(
      'F13',
      expect.any(Function),
    );
    await resetEngineKey();
    expect(globalShortcut.unregister).toHaveBeenCalledWith('F13');
    expect(JSON.parse(fs.readFileSync(saved(), 'utf8'))).toEqual({
      accelerator: '',
    });
    expect(
      mockHandlers.get(ENGINE_KEY_GET)?.({
        sender: window.webContents,
        senderFrame: window.webContents.mainFrame,
      }),
    ).toBe('');
    // Resetting a preference never presses the power switch.
    expect(window.webContents.send).not.toHaveBeenCalled();
  });

  it('keeps the shortcut absent when the window opens again', async () => {
    await resetEngineKey();
    window.emit('closed');
    jest.mocked(globalShortcut.register).mockClear();
    window = createWindow();
    installEngineKey(window as unknown as BrowserWindow);
    expect(globalShortcut.register).not.toHaveBeenCalled();
  });
});
