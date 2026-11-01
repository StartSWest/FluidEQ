/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A development sandbox runs beside the FluidEQ somebody is listening
 * through, and nothing it does may reach that sound. Its first run proved
 * the need: by itself it asked the setup helper to move the engine to another
 * slot, reinstall it and restart Windows audio on the listener's outputs,
 * each refused only because these seals were in place.
 *
 * Each module is loaded twice, inside a sandbox and outside one, so every
 * refusal below stands beside the same call going through.
 */
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
import { SANDBOX_DIR_VARIABLE } from 'main/devSandbox';
import type * as EngineSetup from 'main/engineSetup';
import type * as EngineStatus from 'main/engineStatus';
import type * as Registry from 'main/registry';
import type * as DevSandbox from 'main/devSandbox';
import type { IFluidEngineStatus } from 'common/audioEngine';

let scratch: string;

beforeEach(() => {
  scratch = mkdtempSync(path.join(os.tmpdir(), 'fluideq-sandbox-seal-'));
});

afterEach(() => {
  delete process.env[SANDBOX_DIR_VARIABLE];
  rmSync(scratch, { recursive: true, force: true });
});

/** A fresh copy of `modulePath`, loaded in a sandbox or out of one. */
const load = <T extends object>(
  modulePath: string,
  inSandbox: boolean,
): { module: T; execFile: jest.Mock } => {
  const execFile = jest.fn();
  let loaded: T | undefined;
  jest.isolateModules(() => {
    jest.doMock('electron', () => ({
      app: {
        isPackaged: false,
        getPath: () => path.join(scratch, 'electron'),
      },
    }));
    jest.doMock('child_process', () => ({ execFile }));
    if (inSandbox) {
      process.env[SANDBOX_DIR_VARIABLE] = path.join(scratch, 'sandbox');
    } else {
      delete process.env[SANDBOX_DIR_VARIABLE];
    }
    loaded = jest.requireActual<T>(modulePath);
  });
  if (!loaded) {
    throw new Error(`${modulePath} did not load`);
  }
  return { module: loaded, execFile };
};

describe('a development sandbox', () => {
  it('marks its name where a person picks a window or a tray icon', () => {
    const sandbox = load<typeof DevSandbox>('main/devSandbox', true).module;
    const ordinary = load<typeof DevSandbox>('main/devSandbox', false).module;

    expect(sandbox.sandboxProductName('FluidEQ')).toBe('FluidEQ (test copy)');
    expect(ordinary.sandboxProductName('FluidEQ')).toBe('FluidEQ');
  });

  it('runs no engine setup command', async () => {
    const sandbox = load<typeof EngineSetup>('main/engineSetup', true);
    const result = await sandbox.module.runEngineSetup(
      'install',
      ['--restart-audio'],
      path.join(scratch, 'FluidEQ-Engine-Setup.exe'),
    );

    expect(sandbox.execFile).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false, declined: false });

    // The control: the same call out of a sandbox reaches the helper.
    const ordinary = load<typeof EngineSetup>('main/engineSetup', false);
    ordinary.execFile.mockImplementation(() => {
      throw new Error('spawned');
    });
    await ordinary.module
      .runEngineSetup(
        'install',
        ['--restart-audio'],
        path.join(scratch, 'FluidEQ-Engine-Setup.exe'),
      )
      .catch(() => undefined);
    expect(ordinary.execFile).toHaveBeenCalled();
  });

  it('writes both engines’ configs in its own folder, and reads the real statuses', async () => {
    const { platform } = process;
    Object.defineProperty(process, 'platform', { value: 'win32' });
    try {
      const sandbox = load<typeof Registry>('main/registry', true).module;
      const own = path.join(scratch, 'sandbox', 'engine', 'config');

      expect(sandbox.getFluidEngineConfigDir()).toBe(own);
      expect(await sandbox.getConfigPath('fluid')).toBe(own);
      expect(await sandbox.getConfigPath('apo')).toBe(own);
      expect(existsSync(path.join(own, 'config.txt'))).toBe(true);
      expect(sandbox.getFluidEngineRootDir()).toBe(
        path.join(
          process.env.ProgramData ?? 'C:\\ProgramData',
          'FluidEQ',
          'engine',
        ),
      );

      const ordinary = load<typeof Registry>('main/registry', false).module;
      expect(ordinary.getFluidEngineConfigDir()).toBe(
        path.join(ordinary.getFluidEngineRootDir(), 'config'),
      );
    } finally {
      Object.defineProperty(process, 'platform', { value: platform });
    }
  });

  it('offers no engine update', async () => {
    const bundle = path.join(scratch, 'bundle');
    const installed = path.join(scratch, 'installed');
    mkdirSync(bundle);
    mkdirSync(installed);
    writeFileSync(path.join(bundle, 'FluidEQ-Engine.dll'), 'this build');
    writeFileSync(path.join(installed, 'FluidEQ-Engine.dll'), 'older build');
    const fluid: IFluidEngineStatus = {
      installed: true,
      dllPath: path.join(installed, 'FluidEQ-Engine.dll'),
      endpoints: [],
    };

    const sandbox = load<typeof EngineStatus>('main/engineStatus', true).module;
    const ordinary = load<typeof EngineStatus>(
      'main/engineStatus',
      false,
    ).module;

    expect(await sandbox.readFluidEngineUpdateReady(fluid, bundle)).toBe(false);
    expect(await ordinary.readFluidEngineUpdateReady(fluid, bundle)).toBe(true);
  });
});
