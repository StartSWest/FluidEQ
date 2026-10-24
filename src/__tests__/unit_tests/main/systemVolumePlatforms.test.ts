/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { existsSync } from 'fs';
import path from 'path';

jest.mock('fs', () => ({ existsSync: jest.fn() }));
jest.mock('electron-log', () => ({ info: jest.fn(), warn: jest.fn() }));
jest.mock('../../../main/ipc/windowMessages', () => jest.fn());

const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');

afterEach(() => {
  if (originalPlatform) {
    Object.defineProperty(process, 'platform', originalPlatform);
  }
  jest.clearAllMocks();
});

it.each([
  ['linux', 'FluidEQ-Volume'],
  ['win32', 'FluidEQ-Volume.exe'],
  ['darwin', undefined],
] as const)(
  'locates only the existing volume helper for %s',
  (platform, name) => {
    Object.defineProperty(process, 'platform', { value: platform });
    (existsSync as jest.Mock).mockReturnValue(true);
    jest.isolateModules(() => {
      // Module scope picks the executable on this OS, as it does at launch.
      const volume = jest.requireActual<
        typeof import('../../../main/systemVolume')
      >('../../../main/systemVolume');
      expect(volume.SYSTEM_VOLUME_EXECUTABLE).toBe(name);
      const executable = volume.findSystemVolumeExecutable();
      expect(executable ? path.basename(executable) : undefined).toBe(name);
      expect((existsSync as jest.Mock).mock.calls.length).toBe(name ? 1 : 0);
    });
  },
);
