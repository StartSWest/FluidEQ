/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { existsSync } from 'fs';
import path from 'path';

/**
 * Where the lighting helper and its identity package are, in each of the
 * three layouts this app runs from — see `dspHost/hostPath.ts` for why the
 * answer is the first candidate that exists and never the working directory.
 */

/** The helper's file name, as the native build writes it (CMake OUTPUT_NAME). */
export const LIGHTING_EXECUTABLE_NAME = 'FluidEQ-Lighting.exe';

/** The helper on this platform, or undefined where it has none. */
export const LIGHTING_EXECUTABLE =
  process.platform === 'win32' ? LIGHTING_EXECUTABLE_NAME : undefined;

/** Written beside the helper at packaging time, in signed builds only. */
export const LIGHTING_IDENTITY_PACKAGE = 'FluidEQ-Lighting.msix';

/** Must match the helper's embedded manifest (native/CMakeLists.txt). */
export const LIGHTING_PACKAGE_NAME = 'FluidEQ.DynamicLighting';

/** Must match the helper's embedded manifest too: the package's one app. */
export const LIGHTING_APPLICATION_ID = 'FluidEQLighting';

/**
 * Beside the helper, the pictures Windows shows for the package in its
 * Dynamic Lighting settings. An identity package's image paths resolve in the
 * install folder, not inside the package (package.json's extraResources).
 */
export const LIGHTING_ASSETS_FOLDER = 'lighting-assets';

const resourcesPath = (): string => {
  const { resourcesPath: found } = process as NodeJS.Process & {
    resourcesPath?: string;
  };
  return typeof found === 'string' ? found : '';
};

const folders = (): string[] => [
  path.join(resourcesPath(), 'native'),
  path.join(__dirname, '../../../native/.build/bin'),
  path.join(__dirname, '../../native/.build/bin'),
];

/** The folder holding the helper, or undefined where there is none. */
export const findLightingFolder = (): string | undefined => {
  if (!LIGHTING_EXECUTABLE) {
    return undefined;
  }
  const executable = LIGHTING_EXECUTABLE;
  return folders().find((folder) => existsSync(path.join(folder, executable)));
};

export const findLightingExecutable = (): string | undefined => {
  const folder = findLightingFolder();
  return folder && LIGHTING_EXECUTABLE
    ? path.join(folder, LIGHTING_EXECUTABLE)
    : undefined;
};
