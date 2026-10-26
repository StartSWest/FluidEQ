/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import path from 'path';

const openToken = jest.fn();
const tokenInformation = jest.fn();
const closeHandle = jest.fn();
const sizeof = jest.fn();
const createServer = jest.fn(() => {
  throw new Error('The dev server must not start in this test');
});
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
    throw new Error(`Unexpected native function: ${prototype}`);
  },
}));
jest.mock('koffi', () => ({ load, sizeof }));
jest.mock('net', () => ({ createServer }));

const assertDevPrivileges = jest.requireActual<() => void>(
  '../../../../.erb/scripts/dev-privileges.cjs',
);
const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
let elevated: boolean;

beforeEach(() => {
  Object.defineProperty(process, 'platform', { value: 'win32' });
  jest.clearAllMocks();
  elevated = false;
  sizeof.mockReturnValue(8);
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
});

afterEach(() => {
  if (originalPlatform) {
    Object.defineProperty(process, 'platform', originalPlatform);
  }
});

it.each([4, 8])('accepts a normal-user %i-byte Windows process', (size) => {
  sizeof.mockReturnValue(size);
  expect(assertDevPrivileges).not.toThrow();
  expect(openToken).toHaveBeenCalledWith(10n, 0x0008, expect.any(Buffer));
  expect(tokenInformation).toHaveBeenCalledWith(
    42n,
    20,
    expect.any(Buffer),
    4,
    expect.any(Buffer),
  );
  expect(closeHandle).toHaveBeenCalledWith(42n);
  load.mock.calls.forEach(([file]) => {
    expect(path.win32.isAbsolute(file)).toBe(true);
    expect(file).toMatch(/System32[\\/](kernel32|advapi32)\.dll$/);
  });
});

it('explains why Explorer drops fail when the launcher is elevated', () => {
  elevated = true;
  expect(assertDevPrivileges).toThrow('Windows blocks Explorer file drops');
  expect(assertDevPrivileges).toThrow('pnpm dev from a normal terminal');
  expect(closeHandle).toHaveBeenCalledWith(42n);
});

it('stops the actual launcher before builds, engine sync or the server start', () => {
  elevated = true;
  // The real entry point must stop at the privilege check. The server mock
  // also prevents a regression here from building or installing an engine.
  expect(() =>
    jest.isolateModules(() => {
      jest.requireActual('../../../../.erb/scripts/dev.cjs');
    }),
  ).toThrow('pnpm dev from a normal terminal');
  expect(createServer).not.toHaveBeenCalled();
});

it.each(['linux', 'darwin'])('does not load Windows APIs on %s', (platform) => {
  Object.defineProperty(process, 'platform', { value: platform });
  expect(assertDevPrivileges).not.toThrow();
  expect(load).not.toHaveBeenCalled();
});

it('reports an unreadable token without continuing to start dev', () => {
  openToken.mockReturnValue(0);
  expect(assertDevPrivileges).toThrow('Windows dev privileges: 5');
  expect(closeHandle).not.toHaveBeenCalled();
  expect(tokenInformation).not.toHaveBeenCalled();
});

it('reports a failed elevation read and releases the token', () => {
  tokenInformation.mockReturnValue(0);
  expect(assertDevPrivileges).toThrow('Windows dev elevation: 5');
  expect(closeHandle).toHaveBeenCalledWith(42n);
});
