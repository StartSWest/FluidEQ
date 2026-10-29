/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import path from 'path';
import type { TLinuxPackage } from '../signedAutoUpdates';

/**
 * How this Linux copy was installed, read the way electron-updater reads it
 * to choose its updater: an AppImage's runtime sets `APPIMAGE` to the file it
 * runs from, and electron-builder writes the package type (`deb`) into
 * `resources/package-type` of a .deb. Asked here first so the app never
 * builds an updater electron-updater would then pick differently — the
 * unpacked folder has neither, and nothing could install over it.
 */
const linuxPackageOf = (
  env: NodeJS.ProcessEnv = process.env,
  resourcesPath: string = process.resourcesPath,
): TLinuxPackage | undefined => {
  if (process.platform !== 'linux') {
    return undefined;
  }
  if (env.APPIMAGE) {
    return 'appimage';
  }
  try {
    const type = fs
      .readFileSync(path.join(resourcesPath, 'package-type'), 'utf8')
      .trim();
    return type === 'deb' ? 'deb' : undefined;
  } catch {
    // No package type: not installed from a package this app can update.
    return undefined;
  }
};

export default linuxPackageOf;
