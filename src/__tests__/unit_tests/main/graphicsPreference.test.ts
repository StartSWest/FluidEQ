/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  gpuPreferenceSupported,
  HIGH_PERFORMANCE_GPU_SWITCH,
  isGpuPreference,
  readGpuPreference,
  writeGpuPreference,
} from '../../../main/graphicsPreference';

describe('which graphics card the app runs on', () => {
  let folder: string;
  beforeEach(() => {
    folder = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-graphics-'));
  });
  afterEach(() => fs.rmSync(folder, { recursive: true, force: true }));

  it('leaves it to Windows until chosen, or when the file is damaged', () => {
    expect(readGpuPreference(folder)).toBe('auto');
    fs.writeFileSync(path.join(folder, 'graphics.json'), '{"gpu": "turbo"}');
    expect(readGpuPreference(folder)).toBe('auto');
    fs.writeFileSync(path.join(folder, 'graphics.json'), '{not json');
    expect(readGpuPreference(folder)).toBe('auto');
  });

  it('keeps the choice between launches', () => {
    writeGpuPreference(folder, 'high');
    expect(readGpuPreference(folder)).toBe('high');
    writeGpuPreference(folder, 'auto');
    expect(readGpuPreference(folder)).toBe('auto');
  });

  it('knows its two answers and Chromium’s switch for the fast card', () => {
    expect(isGpuPreference('high')).toBe(true);
    expect(isGpuPreference('low')).toBe(false);
    expect(HIGH_PERFORMANCE_GPU_SWITCH).toBe('force_high_performance_gpu');
  });

  /** Windows hands a program to one card or the other; the others do not ask. */
  it('means something on Windows only', () => {
    expect(gpuPreferenceSupported('win32')).toBe(true);
    expect(gpuPreferenceSupported('darwin')).toBe(false);
    expect(gpuPreferenceSupported('linux')).toBe(false);
  });
});
