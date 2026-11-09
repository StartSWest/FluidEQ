/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { PassThrough } from 'stream';

/**
 * Main names the camera's key to the desktop helper on its stdin
 * (`camera-key <name>`, `native/wallpaper/pointer.h`): only when it changes,
 * never after the helper was stopped or failed, and Ctrl unless told.
 */

const mockChild = {
  stdin: { write: jest.fn(), end: jest.fn(), on: jest.fn() },
  stdout: new PassThrough(),
  stderr: new PassThrough(),
  on: jest.fn(),
};

jest.mock('child_process', () => ({ spawn: () => mockChild }));
jest.mock('electron', () => ({ app: { getAppPath: () => '' } }));
jest.mock('electron-log', () => ({ warn: jest.fn() }));

// eslint-disable-next-line import/first -- the mocks above have to be in place first
import { startWallpaperHost } from '../../../main/wallpaper/nativeHost';

const written = () =>
  mockChild.stdin.write.mock.calls
    .map(([line]) => String(line))
    .filter((line) => line.startsWith('camera-key'));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('the camera key told to the desktop helper', () => {
  it('names a new key once, and says nothing for Ctrl it already reads', () => {
    const host = startWallpaperHost(
      'FluidEQ-Wallpaper.exe',
      Buffer.alloc(8),
      () => undefined,
      () => undefined,
    );
    host.setCameraKey('ctrl');
    expect(written()).toEqual([]);
    host.setCameraKey('scan:0x10');
    host.setCameraKey('scan:0x10');
    host.setCameraKey('alt');
    expect(written()).toEqual(['camera-key scan:0x10\n', 'camera-key alt\n']);
  });

  it('says nothing to a helper that was stopped', () => {
    const host = startWallpaperHost(
      'FluidEQ-Wallpaper.exe',
      Buffer.alloc(8),
      () => undefined,
      () => undefined,
    );
    host.stop();
    host.setCameraKey('alt');
    expect(written()).toEqual([]);
  });
});
