/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

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
import { createHash } from 'crypto';
import { app } from 'electron';
import {
  clampReferenceGain,
  clampQuality,
  FilterTypeEnum,
  FILTER_REGEX,
  getDefaultFilterWithId,
  IConvolutionProfile,
  IFiltersMap,
  MAX_NUM_FILTERS,
} from '../common/constants';
import { IConvolutionCatalogEntry } from '../common/convolution';

const AUTOEQ_INDEX_URL =
  'https://raw.githubusercontent.com/jaakkopasanen/AutoEq/master/results/INDEX.md';
const AUTOEQ_RAW_ROOT =
  'https://raw.githubusercontent.com/jaakkopasanen/AutoEq/master/results';
const AUTOEQ_TREE_ROOT =
  'https://github.com/jaakkopasanen/AutoEq/tree/master/results';
const MAX_INDEX_BYTES = 8 * 1024 * 1024;
const MAX_WAV_BYTES = 128 * 1024 * 1024;
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

let catalogPromise: Promise<IConvolutionCatalogEntry[]> | undefined;

const cacheDir = () => path.join(app.getPath('userData'), 'convolution');
const cachePath = () => path.join(cacheDir(), 'autoeq-index.md');

const readCachedIndex = (allowStale = false) => {
  const filePath = cachePath();
  if (!fs.existsSync(filePath)) {
    return undefined;
  }
  const stat = fs.statSync(filePath);
  if (!allowStale && Date.now() - stat.mtimeMs > CACHE_MAX_AGE_MS) {
    return undefined;
  }
  return fs.readFileSync(filePath, 'utf8');
};

const fetchIndex = async () => {
  try {
    const response = await fetch(AUTOEQ_INDEX_URL, {
      headers: {
        Accept: 'text/plain',
        'User-Agent': 'FluidEQ-Convolution-Catalog',
      },
    });
    if (!response.ok) {
      throw new Error(`AutoEq returned HTTP ${response.status}`);
    }
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > MAX_INDEX_BYTES) {
      throw new Error('AutoEq convolution catalogue is unexpectedly large.');
    }
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > MAX_INDEX_BYTES) {
      throw new Error('AutoEq convolution catalogue is unexpectedly large.');
    }
    fs.mkdirSync(cacheDir(), { recursive: true });
    fs.writeFileSync(cachePath(), text, 'utf8');
    return text;
  } catch (error) {
    const cached = readCachedIndex(true);
    if (cached) {
      return cached;
    }
    throw error;
  }
};

const encodePath = (value: string) =>
  value
    .split('/')
    .map((part) => encodeURIComponent(decodeURIComponent(part)))
    .join('/');

const parseCatalog = (index: string): IConvolutionCatalogEntry[] => {
  const entries: IConvolutionCatalogEntry[] = [];
  const linePattern = /^- \[([^\]]+)\]\(\.\/([^)]+)\) by (.+)$/;

  index.split(/\r?\n/).forEach((line) => {
    const match = line.match(linePattern);
    if (!match) {
      return;
    }
    const [, label, relativePath, provider] = match;
    const decodedPath = decodeURIComponent(relativePath);
    const modelName = decodedPath.split('/').pop() || label;
    const encodedDirectory = encodePath(decodedPath);
    const fileName = `${modelName} minimum phase 48000Hz.wav`;
    const encodedFileName = encodeURIComponent(fileName);
    const sourceUrl = `${AUTOEQ_TREE_ROOT}/${encodedDirectory}`;
    const downloadUrl = `${AUTOEQ_RAW_ROOT}/${encodedDirectory}/${encodedFileName}`;
    const id = `${encodedDirectory}|${encodeURIComponent(modelName)}`;

    entries.push({
      id,
      name: label,
      provider: provider.trim(),
      sourceId: 'autoeq',
      sourceUrl,
      downloadUrl,
      format: 'wav',
      phase: 'minimum',
      sampleRate: 48000,
    });
  });

  return entries;
};

const loadCatalog = async () => {
  if (!catalogPromise) {
    catalogPromise = fetchIndex()
      .then(parseCatalog)
      .catch((error) => {
        catalogPromise = undefined;
        throw error;
      });
  }
  return catalogPromise;
};

const normalizeSearch = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase();

export const getConvolutionCatalog = async (query = '') => {
  const catalog = await loadCatalog();
  const terms = normalizeSearch(query).split(/\s+/).filter(Boolean);
  const filtered = terms.length
    ? catalog.filter((entry) => {
        const searchable = normalizeSearch(`${entry.name} ${entry.provider}`);
        return terms.every((term) => searchable.includes(term));
      })
    : catalog;
  return filtered.slice(0, 160);
};

const findEntry = async (entryId: string) => {
  const entry = (await loadCatalog()).find(
    (candidate) => candidate.id === entryId,
  );
  if (!entry) {
    throw new Error('The selected convolution profile is not available.');
  }
  return entry;
};

const validateWav = (buffer: Buffer, expectedSampleRate: number) => {
  if (
    buffer.length < 44 ||
    buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.toString('ascii', 8, 12) !== 'WAVE'
  ) {
    throw new Error('The downloaded convolution file is not a WAV file.');
  }

  let offset = 12;
  let hasFormat = false;
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkEnd = offset + 8 + chunkSize;
    if (chunkEnd > buffer.length) {
      throw new Error('The downloaded convolution WAV is truncated.');
    }
    if (chunkId === 'fmt ' && chunkSize >= 16) {
      const audioFormat = buffer.readUInt16LE(offset + 8);
      const channels = buffer.readUInt16LE(offset + 10);
      const sampleRate = buffer.readUInt32LE(offset + 12);
      if (![1, 3].includes(audioFormat) || channels < 1) {
        throw new Error('The convolution WAV format is not supported.');
      }
      if (sampleRate !== expectedSampleRate) {
        throw new Error(
          `This convolution is ${sampleRate} Hz; Equalizer APO needs ${expectedSampleRate} Hz for this source.`,
        );
      }
      hasFormat = true;
    }
    offset = chunkEnd + (chunkSize % 2);
  }
  if (!hasFormat) {
    throw new Error('The downloaded convolution WAV has no format chunk.');
  }
};

const getParametricEqUrl = (downloadUrl: string) => {
  const separator = downloadUrl.lastIndexOf('/');
  if (separator < 0) {
    return undefined;
  }
  const directory = downloadUrl.slice(0, separator + 1);
  const wavName = decodeURIComponent(downloadUrl.slice(separator + 1));
  const modelName = wavName.replace(/ minimum phase \d+Hz\.wav$/i, '');
  return `${directory}${encodeURIComponent(`${modelName} ParametricEQ.txt`)}`;
};

const fetchGraphFilters = async (downloadUrl: string): Promise<IFiltersMap> => {
  const parametricEqUrl = getParametricEqUrl(downloadUrl);
  if (!parametricEqUrl) {
    return {};
  }
  try {
    const response = await fetch(parametricEqUrl, {
      headers: { 'User-Agent': 'FluidEQ-Convolution-Downloader' },
    });
    if (!response.ok) {
      return {};
    }
    const filters: IFiltersMap = {};
    const text = await response.text();
    text.split(/\r?\n/).forEach((line) => {
      if (Object.keys(filters).length >= MAX_NUM_FILTERS) {
        return;
      }
      const match = line.match(FILTER_REGEX);
      if (!match) {
        return;
      }
      const filter = getDefaultFilterWithId();
      if (match[1] === 'PK') {
        filter.type = FilterTypeEnum.PK;
      } else if (match[1].startsWith('LS')) {
        filter.type = FilterTypeEnum.LSC;
      } else {
        filter.type = FilterTypeEnum.HSC;
      }
      filter.frequency = Number(match[2]);
      filter.gain = clampReferenceGain(Number(match[3]), filter.frequency);
      filter.quality = clampQuality(Number(match[4]));
      filters[filter.id] = filter;
    });
    return filters;
  } catch {
    // The WAV remains usable if the optional graph companion is unavailable.
    return {};
  }
};

export const downloadConvolution = async (
  entryId: string,
  configDir: string,
): Promise<IConvolutionProfile> => {
  const entry = await findEntry(entryId);
  const response = await fetch(entry.downloadUrl, {
    headers: { 'User-Agent': 'FluidEQ-Convolution-Downloader' },
  });
  if (!response.ok) {
    throw new Error(`Convolution download failed with HTTP ${response.status}`);
  }
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > MAX_WAV_BYTES) {
    throw new Error('The convolution file is too large to import safely.');
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_WAV_BYTES) {
    throw new Error('The convolution file is too large to import safely.');
  }
  validateWav(buffer, entry.sampleRate);
  const graphFilters = await fetchGraphFilters(entry.downloadUrl);

  const fileName = `fluideq-ir-${createHash('sha1')
    .update(entry.id)
    .digest('hex')
    .slice(0, 12)}.wav`;
  fs.mkdirSync(configDir, { recursive: true });
  const targetPath = path.join(configDir, fileName);
  const temporaryPath = `${targetPath}.${Date.now()}.download`;
  fs.writeFileSync(temporaryPath, buffer);
  try {
    fs.renameSync(temporaryPath, targetPath);
  } finally {
    if (fs.existsSync(temporaryPath)) {
      fs.rmSync(temporaryPath);
    }
  }

  return {
    name: `${entry.name} · ${entry.phase} · ${entry.sampleRate / 1000} kHz`,
    // AutoEq publishes the matching ParametricEQ file next to each WAV. Keep
    // those points as a visual approximation of the FIR response; APO still
    // applies the downloaded WAV itself.
    filters: graphFilters,
    fileName,
    sourceId: entry.sourceId,
    sourceUrl: entry.sourceUrl,
  };
};
