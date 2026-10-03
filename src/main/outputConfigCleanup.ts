/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import path from 'path';
import log from 'electron-log';
import { FLUID_ENGINE_DSP_FILENAME } from '../common/audioEngine';
import { isOutputConfigFileName } from '../common/outputConfigFiles';
import { SOURCE_ANALYSIS_FILE } from '../common/dsp/sourceAnalysis';
import { forgetPath } from './asyncWriter';

/** Runtime intent and strict endpoint sound files, never saved model data. */
export const outputSoundFiles = (configDirPath: string): string[] => {
  const fixedFiles = [FLUID_ENGINE_DSP_FILENAME, SOURCE_ANALYSIS_FILE].map(
    (name) => path.resolve(configDirPath, name),
  );
  try {
    return [
      ...fixedFiles,
      ...fs
        .readdirSync(configDirPath)
        .filter(isOutputConfigFileName)
        .map((name) => path.resolve(configDirPath, name)),
    ];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      log.error(`Could not list output sound files in ${configDirPath}`, error);
    }
    return fixedFiles;
  }
};

/** The endpoint writer canonicalizes Windows paths before queuing a rack. */
export const forgetOutputSoundFile = (filePath: string): void => {
  forgetPath(filePath);
  if (process.platform === 'win32') {
    forgetPath(filePath.toLowerCase());
  }
};
