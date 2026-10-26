/**
 * Explorer cannot deliver an OLE file drag to an elevated Electron window.
 * Refuse an administrator dev launcher before it builds or starts anything:
 * accepting more DOM events cannot repair a drag Windows never delivers.
 * The engine setup helper asks for its own elevation when it needs it.
 */
const path = require('path');

const assertDevPrivileges = () => {
  if (process.platform !== 'win32') {
    return;
  }
  const koffi = require('koffi');
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
  const token = Buffer.alloc(koffi.sizeof('void *'));
  if (!openToken(getCurrentProcess(), 0x0008, token)) {
    throw new Error(
      `Could not check Windows dev privileges: ${getLastError()}`,
    );
  }
  const handle =
    token.length === 8 ? token.readBigUInt64LE() : BigInt(token.readUInt32LE());
  const elevation = Buffer.alloc(4);
  try {
    // TokenElevation = 20; TOKEN_ELEVATION is a single DWORD.
    if (!getTokenInformation(handle, 20, elevation, 4, Buffer.alloc(4))) {
      throw new Error(
        `Could not check Windows dev elevation: ${getLastError()}`,
      );
    }
  } finally {
    closeHandle(handle);
  }
  if (elevation.readUInt32LE() !== 0) {
    throw new Error(
      'FluidEQ dev must run in a normal terminal, without Run as administrator. ' +
        'Windows blocks Explorer file drops into an administrator app, including Amp Up next. ' +
        'Stop this dev session and run pnpm dev from a normal terminal. ' +
        'Audio-engine setup requests administrator permission separately when needed.',
    );
  }
};

module.exports = assertDevPrivileges;
