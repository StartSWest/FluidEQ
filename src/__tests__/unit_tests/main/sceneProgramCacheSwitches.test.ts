/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The GPU process is given room for every scene's compiled program, in memory
 * and on disk. At Chromium's 6 MB each, Ivan's own program cache was full on
 * 2026-11-25 (6.3 MB, Alpine alone 337 KB, Hanami already pushed out), and a
 * scene whose program was not kept compiled again from nothing at its next
 * pick: 12 s for Alpine on software GL.
 */

const mockAppend = jest.fn();
jest.mock('electron', () => ({
  app: {
    commandLine: {
      appendSwitch: (...args: unknown[]) => mockAppend(...args),
      hasSwitch: () => false,
    },
    isPackaged: false,
    exit: jest.fn(),
    disableDomainBlockingFor3DAPIs: jest.fn(),
  },
}));

// eslint-disable-next-line import/first -- after the mock it is built on
import {
  applyLaunchSwitches,
  SCENE_PROGRAM_CACHE_KB,
} from '../../../main/launchSwitches';

it('gives the program cache and the disk cache room for every scene', () => {
  applyLaunchSwitches();
  expect(mockAppend).toHaveBeenCalledWith(
    'gpu-program-cache-size-kb',
    String(SCENE_PROGRAM_CACHE_KB),
  );
  expect(mockAppend).toHaveBeenCalledWith(
    'gpu-disk-cache-size-kb',
    String(SCENE_PROGRAM_CACHE_KB),
  );
  // Ten times Chromium's 6 MB: every shipped scene with room for updates.
  expect(SCENE_PROGRAM_CACHE_KB).toBe(64 * 1024);
});
