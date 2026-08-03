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
  AutoEqFormat,
  FilterTypeEnum,
  clampGain,
  clampQuality,
  getDefaultFilterWithId,
  IFilter,
  IPresetV2,
  MAX_NUM_FILTERS,
  MAX_FREQUENCY,
  MIN_FREQUENCY,
  PREAMP_REGEX,
  FILTER_REGEX,
  IFiltersMap,
  IGraphicEqPoint,
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
  return fs
    .readdirSync(path.join(autoeqDir, device), { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
};

const getAutoEqFormat = (response: string): AutoEqFormat => {
  if (/graphiceq/i.test(response)) {
    return AutoEqFormat.GRAPHIC;
  }
  if (/fixedbandeq/i.test(response)) {
    return AutoEqFormat.FIXED_BAND;
  }
  return AutoEqFormat.PARAMETRIC;
};

const GRAPHIC_EQ_LINE = /^GraphicEQ:\s*(.+)$/i;
const GRAPHIC_EQ_POINT = /^([0-9]+(?:\.[0-9]+)?)\s+(-?[0-9]+(?:\.[0-9]+)?)$/;

export const getAutoEqPreset = (
  device: string,
  response: string,
  autoeqDir: string = getAutoEqDir(),
) => {
  let preAmpParsed = 0;
  const filters: IFiltersMap = {};
  const graphicEq: IGraphicEqPoint[] = [];
  const eqFormat = getAutoEqFormat(response);

  const filePath = path.join(autoeqDir, device, response);
  const file = fs.readFileSync(filePath, 'utf8');

  file.split(/\r?\n/).forEach((line, i) => {
    if (Object.keys(filters).length >= MAX_NUM_FILTERS) {
      // Ensure filters doesn't exceed filter count cap
      return;
    }
    const trimmedLine = line.trim();
    const preampMatch = trimmedLine.match(PREAMP_REGEX);
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

    const graphicMatch = trimmedLine.match(GRAPHIC_EQ_LINE);
    if (graphicMatch) {
      graphicMatch[1].split(';').forEach((point) => {
        const pointMatch = point.trim().match(GRAPHIC_EQ_POINT);
        if (!pointMatch) {
          return;
        }
        const frequency = Number(pointMatch[1]);
        const gain = Number(pointMatch[2]);
        if (
          Number.isFinite(frequency) &&
          Number.isFinite(gain) &&
          frequency >= MIN_FREQUENCY &&
          frequency <= MAX_FREQUENCY
        ) {
          graphicEq.push({
            frequency,
            gain: clampGain(gain),
          });
        }
      });
      return;
    }

    const filterMatch = trimmedLine.match(FILTER_REGEX);
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

  // GraphicEQ is rendered by APO as one native GraphicEQ command. The editor
  // still receives a bounded PK projection so the response graph and band
  // controls remain useful without changing the original points.
  if (eqFormat === AutoEqFormat.GRAPHIC) {
    graphicEq.slice(0, MAX_NUM_FILTERS).forEach((point) => {
      const filter = getDefaultFilterWithId();
      filter.type = FilterTypeEnum.PK;
      filter.frequency = point.frequency;
      filter.gain = point.gain;
      filter.quality = clampQuality(1.41);
      filters[filter.id] = filter;
    });
  }

  const preset: IPresetV2 = {
    preAmp: clampGain(preAmpParsed),
    filters,
    eqFormat,
    ...(eqFormat === AutoEqFormat.GRAPHIC ? { graphicEq } : {}),
  };

  if (
    Object.keys(filters).length === 0 &&
    !(eqFormat === AutoEqFormat.GRAPHIC && graphicEq.length > 0)
  ) {
    throw new Error(`AutoEQ response is not a supported profile: ${filePath}`);
  }

  return preset;
};
