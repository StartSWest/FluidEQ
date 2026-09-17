/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import fs from 'fs';
import path from 'path';
import {
  isGpuPreference,
  type TGpuPreference,
} from '../common/graphicsPreference';

export {
  GPU_PREFERENCES,
  gpuPreferenceSupported,
  HIGH_PERFORMANCE_GPU_SWITCH,
  isGpuPreference,
  type TGpuPreference,
} from '../common/graphicsPreference';

/**
 * The graphics card choice on disk (`common/graphicsPreference.ts`): a file
 * of its own, read before the app is ready, because the switch it becomes
 * has to be on the command line by then — exactly as the motion preference.
 */
const FILE = 'graphics.json';

export const readGpuPreference = (userDataDir: string): TGpuPreference => {
  try {
    const parsed: unknown = JSON.parse(
      fs.readFileSync(path.join(userDataDir, FILE), 'utf8'),
    );
    return typeof parsed === 'object' &&
      parsed !== null &&
      'gpu' in parsed &&
      isGpuPreference(parsed.gpu)
      ? parsed.gpu
      : 'auto';
  } catch {
    // Never chosen, or unreadable: as Windows decides.
    return 'auto';
  }
};

export const writeGpuPreference = (
  userDataDir: string,
  gpu: TGpuPreference,
) => {
  fs.mkdirSync(userDataDir, { recursive: true });
  fs.writeFileSync(path.join(userDataDir, FILE), JSON.stringify({ gpu }));
};
