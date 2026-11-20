/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import fs from 'fs';
import path from 'path';
import {
  USER_PRESETS_FILENAME,
  fromUserPresetStore,
  toUserPresetStore,
  type IUserDspPreset,
} from '../common/userPresetsFile';
import writeFileAtomically from './atomicWrite';

interface ILogger {
  error(message: string, ...details: unknown[]): void;
}

/**
 * `user-presets.json` in the app's data folder (`common/userPresetsFile.ts`).
 *
 * No file is an empty list. A file that cannot be read as one is never
 * written over: it is renamed aside, `user-presets.damaged-<time>.json`, and
 * the list starts empty — the presets somebody made are still on disk to be
 * recovered, where saving over them would have lost them for good.
 */
export const loadUserPresets = (
  userDataDir: string,
  logger: ILogger,
  now: () => number = Date.now,
): IUserDspPreset[] => {
  const file = path.join(userDataDir, USER_PRESETS_FILENAME);
  let contents: string;
  try {
    contents = fs.readFileSync(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
  const presets = fromUserPresetStore(contents);
  if (presets) {
    return presets;
  }
  const aside = path.join(userDataDir, `user-presets.damaged-${now()}.json`);
  fs.renameSync(file, aside);
  logger.error(`Your presets: ${file} could not be read; kept as ${aside}`);
  return [];
};

/** The whole list, written beside the file and renamed over it. */
export const saveUserPresets = (
  userDataDir: string,
  presets: readonly IUserDspPreset[],
): void => {
  writeFileAtomically(
    path.join(userDataDir, USER_PRESETS_FILENAME),
    toUserPresetStore(presets),
  );
};
