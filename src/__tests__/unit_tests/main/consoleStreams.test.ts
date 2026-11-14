/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { EventEmitter } from 'events';

const mockLog = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  transports: {
    console: { level: 'info' as string | false },
    file: { getFile: () => ({ path: 'C:/logs/main.log' }) },
  },
};
jest.mock('electron', () => ({
  app: Object.assign(new EventEmitter(), { quit: jest.fn() }),
  ipcMain: new EventEmitter(),
  dialog: { showMessageBox: jest.fn() },
}));
jest.mock('../../../main/asyncWriter', () => ({
  flushPendingWrites: jest.fn(),
}));
jest.mock('../../../main/tray', () => ({
  getTrayLocale: () => 'en',
  isAppQuitting: () => false,
}));
jest.mock('electron-log', () => mockLog);

// eslint-disable-next-line import/first -- the Electron and log mocks have to be in place first
import { guardConsoleStreams } from '../../../main/crashRecovery';

const errorWith = (code: string) =>
  Object.assign(new Error(`${code}: broken pipe, write`), { code });

describe('a console nobody is reading', () => {
  beforeEach(() => {
    Object.values(mockLog)
      .filter((value): value is jest.Mock => jest.isMockFunction(value))
      .forEach((fn) => fn.mockClear());
    mockLog.transports.console.level = 'info';
  });

  it('is a note in the log, once, and never an uncaught error', () => {
    const stdout = new EventEmitter();
    const stderr = new EventEmitter();
    guardConsoleStreams([
      stdout as unknown as NodeJS.WriteStream,
      stderr as unknown as NodeJS.WriteStream,
    ]);
    // An 'error' with no listener throws; with the guard it does not.
    expect(() => stdout.emit('error', errorWith('EPIPE'))).not.toThrow();
    expect(() => stderr.emit('error', errorWith('EPIPE'))).not.toThrow();
    expect(mockLog.warn.mock.calls).toEqual([
      ['The console is closed (EPIPE); logging goes to the file only.'],
    ]);
    expect(mockLog.transports.console.level).toBe(false);
    expect(mockLog.error).not.toHaveBeenCalled();
  });

  it('throws without the guard, which is what took 2.5.2 down (the control)', () => {
    const bare = new EventEmitter();
    expect(() => bare.emit('error', errorWith('EPIPE'))).toThrow('EPIPE');
  });

  it('still reports a console failure that is not a closed pipe', () => {
    const stdout = new EventEmitter();
    guardConsoleStreams([stdout as unknown as NodeJS.WriteStream]);
    stdout.emit('error', errorWith('EIO'));
    expect(mockLog.error).toHaveBeenCalledTimes(1);
    expect(mockLog.transports.console.level).toBe('info');
  });
});
