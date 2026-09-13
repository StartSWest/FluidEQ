/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import path from 'path';

/**
 * Explorer runs at medium integrity even when FluidEQ was started as admin.
 * Windows otherwise drops its thumbnail WM_COMMAND before Electron sees it.
 * This must run in the process that owns the HWND, not a PowerShell helper.
 */
const allowTaskbarMessages = (handle: Buffer): void => {
  if (process.platform !== 'win32') {
    return;
  }
  // A native dependency, external to webpack and loaded only on Windows.
  // eslint-disable-next-line global-require, @typescript-eslint/no-require-imports
  const koffi = require('koffi') as typeof import('koffi');
  const system32 = path.join(
    process.env.SystemRoot || 'C:\\Windows',
    'System32',
  );
  const kernel = koffi.load(path.join(system32, 'kernel32.dll'));
  const security = koffi.load(path.join(system32, 'advapi32.dll'));
  const getCurrentProcess = kernel.func('void * __stdcall GetCurrentProcess()');
  const closeHandle = kernel.func('int __stdcall CloseHandle(void *handle)');
  const getLastError = kernel.func('uint32_t __stdcall GetLastError()');
  const openToken = security.func(
    'int __stdcall OpenProcessToken(void *process, uint32_t access, void *token)',
  );
  const getTokenInformation = security.func(
    'int __stdcall GetTokenInformation(void *token, int infoClass, void *info, uint32_t size, void *returnedSize)',
  );
  const token = Buffer.alloc(handle.length);
  if (!openToken(getCurrentProcess(), 0x0008, token)) {
    throw new Error(`Could not query taskbar process token: ${getLastError()}`);
  }
  const readHandle = (value: Buffer) =>
    value.length === 8 ? value.readBigUInt64LE() : BigInt(value.readUInt32LE());
  const elevation = Buffer.alloc(4);
  try {
    // TokenElevation = 20; TOKEN_ELEVATION is a single DWORD.
    if (
      !getTokenInformation(readHandle(token), 20, elevation, 4, Buffer.alloc(4))
    ) {
      throw new Error(`Could not query taskbar elevation: ${getLastError()}`);
    }
  } finally {
    closeHandle(readHandle(token));
  }
  if (elevation.readUInt32LE() === 0) {
    return;
  }
  const user = koffi.load(path.join(system32, 'user32.dll'));
  const allowMessage = user.func(
    'int __stdcall ChangeWindowMessageFilterEx(void *window, uint32_t message, uint32_t action, void *change)',
  );
  // Only this HWND and WM_COMMAND (0x0111). No process-wide filter changes.
  // Electron checks THBN_CLICKED and its own button IDs before our callbacks;
  // taskbarTransport additionally checks the current command capability.
  if (!allowMessage(readHandle(handle), 0x0111, 1, null)) {
    throw new Error(`Could not allow taskbar commands: ${getLastError()}`);
  }
};

export default allowTaskbarMessages;
