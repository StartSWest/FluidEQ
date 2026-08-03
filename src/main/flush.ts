/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import fs from 'fs';
import path from 'path';
import {
  AutoEqFormat,
  clampGain,
  clampQuality,
  FilterTypeEnum,
  getDefaultState,
  IFiltersMap,
  IGraphicEqPoint,
  IPresetV1,
  IPresetV2,
  IState,
} from '../common/constants';
import {
  validatePresetV1,
  validatePresetV2,
  validateState,
} from '../common/validator';

export const stateToString = (
  state: IState,
  convolutionFileName?: string,
  devicePattern = 'all',
) => {
  if (!state.isEnabled) {
    return '';
  }

  let output: string[] = [];

  output.push(`Device: ${devicePattern}`);
  output.push('Channel: all');

  if (state.convolution && convolutionFileName) {
    output.push(`Convolution: ${convolutionFileName}`);
  }

  if (!state.isFlat) {
    if (state.eqFormat === AutoEqFormat.GRAPHIC && state.graphicEq?.length) {
      const points = state.graphicEq
        .filter(
          ({ frequency, gain }) =>
            Number.isFinite(frequency) && Number.isFinite(gain),
        )
        .map(({ frequency, gain }) => `${frequency} ${clampGain(gain)}`)
        .join('; ');
      if (points) {
        output.push(`GraphicEQ: ${points}`);
      }
    } else {
      // A zero-gain PK/shelf is neutral. Do not leave inert EQ commands in APO
      // after the user presses Reset gains.
      output = output.concat(
        Object.values(state.filters)
          .filter(
            ({ gain, type }) =>
              ![
                FilterTypeEnum.PK,
                FilterTypeEnum.LSC,
                FilterTypeEnum.HSC,
              ].includes(type) || clampGain(gain) !== 0,
          )
          .map(({ frequency, gain, type, quality }, index) => {
            return `Filter ${index + 1}: ON ${type} Fc ${frequency} Hz Gain ${clampGain(gain)} dB Q ${clampQuality(quality)}`;
          }),
      );
    }
  }

  // Equalizer APO applies rules in order: convolution, EQ bands, then gain.
  // This line MUST be "Preamp" without a capitalized P for APO to work.
  output.push(`Preamp: ${clampGain(state.preAmp)} dB`);

  return output.join('\n\r');
};

export const serializeState = (state: IState) => {
  return JSON.stringify(state);
};

export const serializePreset = (preset: IPresetV2) => {
  return JSON.stringify(preset);
};

const CONFIG_CONTENT = 'Include: fluideq.txt';
const LEGACY_CONFIG_CONTENT = /^\s*Include:\s*aqua\.txt\s*$/i;
const AQUA_LOCAL_CONFIG_FILENAME = 'state.txt';
export const FLUIDEQ_CONFIG_FILENAME = 'fluideq.txt';
// Kept as an API alias for older tests and integrations; the generated file is FluidEQ-owned.
export const AQUA_CONFIG_FILENAME = FLUIDEQ_CONFIG_FILENAME;
const CONFIG_FILENAME = 'config.txt';
export const PRESETS_DIR = 'presets';

export const addFileToPath = (pathPrefix: string, fileName: string) => {
  return path.join(pathPrefix, fileName);
};

const normalizeFilters = (filters: IFiltersMap): IFiltersMap =>
  Object.fromEntries(
    Object.entries(filters).map(([id, filter]) => [
      id,
      {
        ...filter,
        gain: clampGain(filter.gain),
        quality: clampQuality(filter.quality),
      },
    ]),
  );

const normalizeGraphicEq = (points: IGraphicEqPoint[] | undefined) =>
  Array.isArray(points)
    ? points.filter(
        ({ frequency, gain }) =>
          Number.isFinite(frequency) && Number.isFinite(gain),
      )
    : undefined;

export const fetchSettings = (settingsDir: string) => {
  const settingsPath = path.join(settingsDir, AQUA_LOCAL_CONFIG_FILENAME);
  try {
    const content = fs.readFileSync(settingsPath, {
      encoding: 'utf8',
    });
    const input = JSON.parse(content);
    if (!validateState(input)) {
      throw new Error('Invalid state file loaded. Using default state.');
    }
    // Manually set case sensitivity as false until it is confirmed in app that it can be enabled
    return {
      ...input,
      preAmp: clampGain(input.preAmp),
      filters: normalizeFilters(input.filters),
      ...(Array.isArray(input.graphicEq)
        ? { graphicEq: normalizeGraphicEq(input.graphicEq) }
        : {}),
      isCaseSensitiveFs: false,
    } as IState;
  } catch (ex) {
    if ((ex as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('Unable to load saved FluidEQ state; using defaults.', ex);
    }
    // if unable to fetch the state, use a default one
    return getDefaultState();
  }
};

export const save = (state: IState, settingsDir: string) => {
  const settingsPath = path.join(settingsDir, AQUA_LOCAL_CONFIG_FILENAME);
  try {
    fs.writeFileSync(settingsPath, serializeState(state), {
      encoding: 'utf8',
    });
  } catch (ex) {
    console.log(`Failed to save to ${settingsPath}`);
    throw ex;
  }
};

export const fetchPreset = (presetName: string, presetsDir: string) => {
  try {
    const presetPath = path.join(presetsDir, presetName);
    const content = fs.readFileSync(presetPath, {
      encoding: 'utf8',
    });
    const json = JSON.parse(content);
    if (validatePresetV1(json)) {
      const oldFormat = json as IPresetV1;
      const newFormat: IPresetV2 = {
        preAmp: clampGain(oldFormat.preAmp),
        filters: {},
      };
      oldFormat.filters.forEach((filter) => {
        // Its okay to shallow copy the filter because we won't give oldFormat to anyone else.
        newFormat.filters[filter.id] = {
          ...filter,
          gain: clampGain(filter.gain),
          quality: clampQuality(filter.quality),
        };
      });
      try {
        // Try to update our file.
        savePreset(presetName, newFormat, presetsDir);
      } catch {
        // Ignore failed updates.
      }
      return newFormat;
    }
    if (!validatePresetV2(json)) {
      throw new Error('Invalid preset file');
    }
    const preset = json as IPresetV2;
    const graphicEq = normalizeGraphicEq(preset.graphicEq);
    return {
      ...preset,
      preAmp: clampGain(preset.preAmp),
      filters: normalizeFilters(preset.filters),
      ...(graphicEq ? { graphicEq } : {}),
    };
  } catch (ex) {
    console.log('Failed to get presets!!');
    console.log(ex);
    throw ex;
  }
};

export const savePreset = (
  presetName: string,
  presetInfo: IPresetV2,
  presetsDir: string,
) => {
  try {
    const presetPath = path.join(presetsDir, presetName);
    fs.writeFileSync(presetPath, serializePreset(presetInfo), {
      encoding: 'utf8',
    });
  } catch (ex) {
    console.log('Failed to save to preset %d', presetName);
    throw ex;
  }
  console.log(`Wrote preset for: ${presetName}`);
};

export const deletePreset = (presetName: string, presetsDir: string) => {
  try {
    const presetPath = path.join(presetsDir, presetName);
    fs.unlinkSync(presetPath);
  } catch (ex) {
    console.log('Failed to delete preset');
    throw ex;
  }
  console.log(`Deleted preset: ${presetName}`);
};

export const doesPresetExist = (presetName: string, presetsDir: string) => {
  const testPath = addFileToPath(presetsDir, presetName);
  try {
    return fs.existsSync(testPath);
  } catch (ex) {
    console.log('Failed to check whether preset %d exists', presetName);
    throw ex;
  }
};

export const renamePreset = (
  oldName: string,
  newName: string,
  presetsDir: string,
) => {
  const oldPath = addFileToPath(presetsDir, oldName);
  const newPath = addFileToPath(presetsDir, newName);
  try {
    fs.renameSync(oldPath, newPath);
  } catch (ex) {
    console.log('Failed to rename preset %d to preset %d', oldName, newName);
    throw ex;
  }
};

export const flush = (state: IState, configDirPath: string) => {
  const configPath = addFileToPath(configDirPath, FLUIDEQ_CONFIG_FILENAME);
  try {
    fs.writeFileSync(configPath, stateToString(state), {
      encoding: 'utf8',
    });
  } catch (ex) {
    console.log(`Failed to flush to ${configPath}`);
  }
};

export const checkConfigFile = (configDirPath: string) => {
  const configPath = addFileToPath(configDirPath, CONFIG_FILENAME);
  try {
    const content = fs.readFileSync(configPath, {
      encoding: 'utf8',
    });
    return content
      .split(/\r?\n/)
      .some((line) => line.trim() === CONFIG_CONTENT);
  } catch (ex) {
    throw new Error(`Unable to locate config file at ${configPath}`);
  }
};

export const updateConfig = (configDirPath: string) => {
  const configPath = addFileToPath(configDirPath, CONFIG_FILENAME);
  try {
    const existing = fs.existsSync(configPath)
      ? fs.readFileSync(configPath, 'utf8')
      : '';
    const normalized = existing
      .split(/\r?\n/)
      .filter(
        (line) =>
          !LEGACY_CONFIG_CONTENT.test(line) &&
          !/^\s*Include:\s*fluideq\.txt\s*$/i.test(line),
      )
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd();
    fs.writeFileSync(configPath, `${normalized}\n${CONFIG_CONTENT}\n`, {
      encoding: 'utf8',
    });
  } catch (ex) {
    throw new Error(`Unable to locate config file at ${configPath}`);
  }
};
