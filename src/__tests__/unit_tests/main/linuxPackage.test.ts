/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * How a Linux copy was installed, read as electron-updater reads it to pick
 * its updater: the AppImage's runtime variable, then the .deb's package-type
 * file. The unpacked folder has neither and gets no updater.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import linuxPackageOf from '../../../main/linux/linuxPackage';

const platform = Object.getOwnPropertyDescriptor(process, 'platform');
let resources = '';

beforeEach(() => {
  Object.defineProperty(process, 'platform', { value: 'linux' });
  resources = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-resources-'));
});

afterEach(() => {
  fs.rmSync(resources, { recursive: true, force: true });
  if (platform) {
    Object.defineProperty(process, 'platform', platform);
  }
});

describe('how this Linux copy was installed', () => {
  it('is the AppImage when its runtime says so', () => {
    expect(
      linuxPackageOf({ APPIMAGE: '/home/me/FluidEQ.AppImage' }, resources),
    ).toBe('appimage');
  });

  it('is the .deb when its package type says so', () => {
    fs.writeFileSync(path.join(resources, 'package-type'), 'deb\n');
    expect(linuxPackageOf({}, resources)).toBe('deb');
  });

  it('is neither for the unpacked folder or another package type', () => {
    expect(linuxPackageOf({}, resources)).toBeUndefined();
    fs.writeFileSync(path.join(resources, 'package-type'), 'rpm');
    expect(linuxPackageOf({}, resources)).toBeUndefined();
  });

  it('is never asked on Windows', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    fs.writeFileSync(path.join(resources, 'package-type'), 'deb');
    expect(linuxPackageOf({ APPIMAGE: '/x' }, resources)).toBeUndefined();
  });
});
