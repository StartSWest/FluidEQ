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
import { app } from 'electron';
import {
  FilterTypeEnum,
  clampGain,
  clampQuality,
  getDefaultFilterWithId,
  IFilter,
  IPresetV2,
  MAX_NUM_FILTERS,
  PREAMP_REGEX,
  FILTER_REGEX,
  IFiltersMap,
} from '../common/constants';

const getBundledAutoEqDir = () =>
  app.isPackaged
    ? path.join(process.resourcesPath, 'autoeq')
    : path.join(__dirname, '../../autoeq');

const getAutoEqDir = () => {
  const downloadedDir = path.join(app.getPath('userData'), 'autoeq');
  const downloadedManifest = path.join(
    app.getPath('userData'),
    'autoeq-version.json',
  );
  return fs.existsSync(downloadedManifest) && fs.existsSync(downloadedDir)
    ? downloadedDir
    : getBundledAutoEqDir();
};

export const getAutoEqDeviceList = (autoeqDir: string = getAutoEqDir()) => {
  return fs
    .readdirSync(autoeqDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
};

export const getAutoEqResponseList = (
  device: string,
  autoeqDir: string = getAutoEqDir(),
) => {
  const files = fs
    .readdirSync(path.join(autoeqDir, device), { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  // FluidEQ edits APO parametric filters (Fc/Gain/Q), not GraphicEQ points or
  // fixed-band gain tables. Official AutoEQ archives contain all three
  // variants, while FluidEQ's curated archive strips the suffix and already
  // contains only ParametricEQ profiles.
  const parametricFiles = files.filter((fileName) =>
    /parametriceq(?:\.txt)?$/i.test(fileName),
  );
  if (parametricFiles.length > 0) {
    return parametricFiles;
  }

  const hasNonParametricProfiles = files.some((fileName) =>
    /(?:graphiceq|fixedbandeq)/i.test(fileName),
  );
  return hasNonParametricProfiles ? [] : files;
};

export const getAutoEqPreset = (
  device: string,
  response: string,
  autoeqDir: string = getAutoEqDir(),
) => {
  let preAmpParsed = 0;
  const filters: IFiltersMap = {};

  const filePath = path.join(autoeqDir, device, response);
  if (/(?:graphiceq|fixedbandeq)/i.test(response)) {
    throw new Error(
      'FluidEQ requires the AutoEQ ParametricEQ profile, not GraphicEQ or FixedBandEQ.',
    );
  }
  const file = fs.readFileSync(filePath, 'utf8');

  file.split(/\r?\n/).forEach((line, i) => {
    if (Object.keys(filters).length >= MAX_NUM_FILTERS) {
      // Ensure filters doesn't exceed filter count cap
      return;
    }
    const preampMatch = line.match(PREAMP_REGEX);
    if (preampMatch) {
      if (preampMatch.length !== 2) {
        throw new Error(
          `Preamp regex match error for AutoEQ file: ${filePath}`,
        );
      }

      try {
        preAmpParsed = parseFloat(preampMatch[1]);
      } catch (err) {
        throw new Error(
          `Preamp float parse error for AutoEQ file: ${filePath}`,
        );
      }
      return;
    }

    const filterMatch = line.match(FILTER_REGEX);
    if (filterMatch) {
      if (filterMatch.length !== 5) {
        throw new Error(
          `Filter regex match error on line ${i} for AutoEQ file: ${filePath}`,
        );
      }

      const filter: IFilter = getDefaultFilterWithId();
      switch (filterMatch[1]) {
        case 'PK':
          filter.type = FilterTypeEnum.PK;
          break;
        case 'LS':
        case 'LSC':
          filter.type = FilterTypeEnum.LSC;
          break;
        case 'HS':
        case 'HSC':
          filter.type = FilterTypeEnum.HSC;
          break;
        default:
          throw new Error(
            `Unsupported filter type on line ${i} for AutoEQ file: ${filePath}`,
          );
      }
      try {
        filter.frequency = Math.min(parseInt(filterMatch[2], 10), 20000);
        filter.gain = clampGain(parseFloat(filterMatch[3]));
        filter.quality = clampQuality(parseFloat(filterMatch[4]));
      } catch (err) {
        throw new Error(
          `Filter parameter parse error on line ${i} for AutoEQ file: ${filePath}`,
        );
      }
      filters[filter.id] = filter;
    }
    // Ignore any lines which we do not recognize
  });

  const preset: IPresetV2 = {
    preAmp: clampGain(preAmpParsed),
    filters,
  };

  if (Object.keys(filters).length === 0) {
    throw new Error(
      `AutoEQ response is not a supported ParametricEQ profile: ${filePath}`,
    );
  }

  return preset;
};
