/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import allowTaskbarMessages from '../../../main/taskbarMessages';

const openToken = jest.fn();
const tokenInformation = jest.fn();
const closeHandle = jest.fn();
const allowMessage = jest.fn();
const load = jest.fn((file: string) => ({
  file,
  func: (prototype: string) => {
    if (prototype.includes('GetCurrentProcess(')) {
      return () => 10n;
    }
    if (prototype.includes('OpenProcessToken(')) {
      return openToken;
    }
    if (prototype.includes('GetTokenInformation(')) {
      return tokenInformation;
    }
    if (prototype.includes('CloseHandle(')) {
      return closeHandle;
    }
    if (prototype.includes('GetLastError(')) {
      return () => 5;
    }
    if (prototype.includes('ChangeWindowMessageFilterEx(')) {
      return allowMessage;
    }
    throw new Error(`Unexpected native function: ${prototype}`);
  },
}));
jest.mock('koffi', () => ({ load }));

const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
let elevated: boolean;

beforeEach(() => {
  Object.defineProperty(process, 'platform', { value: 'win32' });
  jest.clearAllMocks();
  elevated = true;
  openToken.mockImplementation((_process, _access, token: Buffer) => {
    if (token.length === 8) {
      token.writeBigUInt64LE(42n);
    } else {
      token.writeUInt32LE(42);
    }
    return 1;
  });
  tokenInformation.mockImplementation((_token, _kind, output: Buffer) => {
    output.writeUInt32LE(elevated ? 1 : 0);
    return 1;
  });
  allowMessage.mockReturnValue(1);
});

afterEach(() => {
  if (originalPlatform) {
    Object.defineProperty(process, 'platform', originalPlatform);
  }
});

it.each([4, 8])(
  'allows only thumbnail WM_COMMAND for an elevated %i-byte window handle',
  (size) => {
    const handle = Buffer.alloc(size);
    const hwnd = size === 8 ? 0x100000003n : 3n;
    if (size === 8) {
      handle.writeBigUInt64LE(hwnd);
    } else {
      handle.writeUInt32LE(Number(hwnd));
    }
    allowTaskbarMessages(handle);
    expect(allowMessage).toHaveBeenCalledTimes(1);
    expect(allowMessage).toHaveBeenCalledWith(hwnd, 0x0111, 1, null);
    expect(closeHandle).toHaveBeenCalledWith(42n);
    expect(openToken).toHaveBeenCalledWith(10n, 0x0008, expect.any(Buffer));
    expect(tokenInformation).toHaveBeenCalledWith(
      42n,
      20,
      expect.any(Buffer),
      4,
      expect.any(Buffer),
    );
    load.mock.calls.forEach(([file]) => {
      expect(file).toMatch(/System32[\\/](kernel32|advapi32|user32)\.dll$/);
    });
  },
);

it('leaves normal-user message permissions unchanged', () => {
  elevated = false;
  allowTaskbarMessages(Buffer.alloc(8));
  expect(allowMessage).not.toHaveBeenCalled();
  expect(closeHandle).toHaveBeenCalledWith(42n);
});

it('does not load a native library on other platforms', () => {
  Object.defineProperty(process, 'platform', { value: 'linux' });
  allowTaskbarMessages(Buffer.alloc(8));
  expect(load).not.toHaveBeenCalled();
});

it('reports a failed elevation query and still releases the token', () => {
  tokenInformation.mockReturnValue(0);
  expect(() => allowTaskbarMessages(Buffer.alloc(8))).toThrow('elevation: 5');
  expect(closeHandle).toHaveBeenCalledWith(42n);
  expect(allowMessage).not.toHaveBeenCalled();
});

it('reports a refused filter change instead of claiming delivery is ready', () => {
  allowMessage.mockReturnValue(0);
  expect(() => allowTaskbarMessages(Buffer.alloc(8))).toThrow('commands: 5');
  expect(closeHandle).toHaveBeenCalledWith(42n);
});
