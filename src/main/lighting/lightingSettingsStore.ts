/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import path from 'path';
import {
  DEFAULT_LIGHTING_SETTINGS,
  LIGHTING_SETTINGS_FILENAME,
  readLightingSettings,
  type ILightingSettings,
} from '../../common/lighting/lightingModel';
import writeFileAtomically from '../atomicWrite';

/**
 * `lighting.json` in the user data folder: whether the devices follow the
 * scene, how bright, how hard they pulse, and which devices stay out.
 *
 * Never throws on read. A missing or damaged file is the defaults — lighting
 * off — which is the one safe reading of "we do not know what this person
 * chose": nobody's desk starts changing colour because a file broke.
 */
export const loadLightingSettings = (
  userDataDir: string,
): ILightingSettings => {
  try {
    const raw: unknown = JSON.parse(
      fs.readFileSync(
        path.join(userDataDir, LIGHTING_SETTINGS_FILENAME),
        'utf8',
      ),
    );
    return readLightingSettings(
      typeof raw === 'object' && raw !== null && 'settings' in raw
        ? (raw as { settings: unknown }).settings
        : undefined,
    );
  } catch {
    return DEFAULT_LIGHTING_SETTINGS;
  }
};

export const saveLightingSettings = (
  userDataDir: string,
  settings: ILightingSettings,
): void => {
  writeFileAtomically(
    path.join(userDataDir, LIGHTING_SETTINGS_FILENAME),
    `${JSON.stringify({ version: 1, settings }, null, 2)}\n`,
  );
};
