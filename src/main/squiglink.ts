/*
 * Squiglink measurements are fetched on demand instead of being bundled.
 * Squiglink publishes an official manifest containing every public database;
 * FluidEQ resolves each database to the same phone_book.json/REW data format
 * and fits a small PEQ correction locally.
 */

import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import {
  clampGain,
  clampQuality,
  FilterTypeEnum,
  getDefaultFilterWithId,
  IFiltersMap,
  ISquigSource,
  IPresetV2,
  MAX_NUM_FILTERS,
} from '../common/constants';

const SQUIG_SITES_URL = 'https://squig.link/squigsites.json';
const DEFAULT_SOURCE_ID = 'squiglink-gadgetrytech-headphones';
const FALLBACK_SOURCE: ISquigSource = {
  id: DEFAULT_SOURCE_ID,
  username: 'gadgetrytech',
  name: 'Gadgetry Tech',
  type: 'Headphones',
  website: 'https://gadgetrytech.squig.link/headsets/',
  dataUrl: 'https://gadgetrytech.squig.link/headsets/data',
};
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_IMPORTED_FILTERS = Math.min(20, MAX_NUM_FILTERS);
const MIN_EQ_FREQUENCY = 20;
const MAX_EQ_FREQUENCY = 7500;

interface ISquigPhone {
  name: string;
  file: string | string[];
  suffix?: string[];
}

interface ISquigBrand {
  name: string;
  phones: ISquigPhone[];
}

interface ISquigDatabaseManifest {
  type: string;
  folder: string;
}

interface ISquigSiteManifest {
  username: string;
  name: string;
  urlType: 'root' | 'subdomain' | 'labFolder' | 'altDomain' | string;
  altDomain?: string;
  dbs: ISquigDatabaseManifest[];
}

interface ISquigModel {
  key: string;
  brand: string;
  name: string;
  phone: ISquigPhone;
  sourceId: string;
}

interface IResponseOption {
  file: string;
  label: string;
}

interface IPoint {
  frequency: number;
  value: number;
}

let sourceListPromise: Promise<ISquigSource[]> | undefined;
const phoneBookPromises = new Map<string, Promise<ISquigModel[]>>();

const cacheDir = () => path.join(app.getPath('userData'), 'squiglink');
const sourceListCachePath = () => path.join(cacheDir(), 'squigsites.json');

const phoneBookCachePath = (source: ISquigSource) =>
  path.join(
    cacheDir(),
    'phone-books',
    `${source.id.replace(/[^a-z0-9._-]+/gi, '_')}.json`,
  );

const readCache = (filePath: string, allowStale = false) => {
  if (!fs.existsSync(filePath)) {
    return undefined;
  }
  const stat = fs.statSync(filePath);
  if (!allowStale && Date.now() - stat.mtimeMs > CACHE_MAX_AGE_MS) {
    return undefined;
  }
  return fs.readFileSync(filePath, 'utf8');
};

const writeCache = (filePath: string, content: string) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
};

const fetchText = async (url: string) => {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/plain, application/json',
      'User-Agent': 'FluidEQ-Squiglink-Client',
    },
  });
  if (!response.ok) {
    throw new Error(`Squiglink returned HTTP ${response.status}`);
  }
  return response.text();
};

const getSiteRoot = (site: ISquigSiteManifest) => {
  if (site.urlType === 'root') {
    return 'https://squig.link';
  }
  if (site.urlType === 'altDomain' && site.altDomain) {
    return site.altDomain.replace(/\/$/, '');
  }
  if (site.urlType === 'labFolder') {
    return `https://squig.link/lab/${encodeURIComponent(site.username)}`;
  }
  return `https://${site.username}.squig.link`;
};

const getSourceId = (
  site: ISquigSiteManifest,
  database: ISquigDatabaseManifest,
) =>
  `squiglink-${site.username}-${database.type.toLowerCase()}-${database.folder.replace(
    /[^a-z0-9]+/gi,
    '-',
  )}`.replace(/-+$/, '');

const parseSourceManifest = (raw: string): ISquigSource[] => {
  const sites = JSON.parse(raw) as ISquigSiteManifest[];
  return sites.flatMap((site) =>
    (site.dbs || [])
      .filter((database) => database && database.type && database.folder)
      .map((database) => {
        const root = getSiteRoot(site);
        const normalizedWebsite =
          database.folder === '/'
            ? `${root}/`
            : `${root}/${database.folder.replace(/^\/+/, '')}`;
        const dataUrl = `${normalizedWebsite.replace(/\/$/, '')}/data`;
        return {
          id: getSourceId(site, database),
          username: site.username,
          name: site.name,
          type: database.type,
          website: normalizedWebsite,
          dataUrl,
        };
      }),
  );
};

const loadSourceManifest = async (): Promise<ISquigSource[]> => {
  const cachePath = sourceListCachePath();
  let raw: string;
  try {
    raw = await fetchText(SQUIG_SITES_URL);
    writeCache(cachePath, raw);
  } catch (error) {
    raw = readCache(cachePath, true) || '';
    if (!raw) {
      throw error;
    }
  }

  return parseSourceManifest(raw);
};

const getSource = async (sourceId = DEFAULT_SOURCE_ID) => {
  let sources: ISquigSource[];
  try {
    sources = await getSquiglinkSourceList();
  } catch {
    sources = [FALLBACK_SOURCE];
  }
  const source =
    sources.find((entry) => entry.id === sourceId) ||
    sources.find(
      (entry) =>
        entry.username === 'gadgetrytech' && entry.type === 'Headphones',
    ) ||
    sources[0] ||
    FALLBACK_SOURCE;
  return source;
};

const loadPhoneBook = async (source: ISquigSource): Promise<ISquigModel[]> => {
  const cachePath = phoneBookCachePath(source);
  const phoneBookUrl = `${source.dataUrl}/phone_book.json`;
  let raw: string;
  try {
    raw = await fetchText(phoneBookUrl);
    writeCache(cachePath, raw);
  } catch (error) {
    raw = readCache(cachePath, true) || '';
    if (!raw) {
      throw error;
    }
  }

  const brands = JSON.parse(raw) as ISquigBrand[];
  return brands.flatMap((brand) =>
    (brand.phones || [])
      .filter((phone) => phone && phone.name && phone.file)
      .map((phone) => ({
        key: `${brand.name} ${phone.name}`,
        brand: brand.name,
        name: phone.name,
        phone,
        sourceId: source.id,
      })),
  );
};

const getPhoneBook = async (sourceId = DEFAULT_SOURCE_ID) => {
  const source = await getSource(sourceId);
  const current = phoneBookPromises.get(source.id);
  if (current) {
    return current;
  }
  const promise = loadPhoneBook(source).catch((error) => {
    phoneBookPromises.delete(source.id);
    throw error;
  });
  phoneBookPromises.set(source.id, promise);
  return promise;
};

const findModel = async (sourceId: string, device: string) => {
  const model = (await getPhoneBook(sourceId)).find(
    (entry) => entry.key === device,
  );
  if (!model) {
    throw new Error(`Squiglink model not found: ${device}`);
  }
  return model;
};

const asFiles = (phone: ISquigPhone) =>
  Array.isArray(phone.file) ? phone.file : [phone.file];

const responseLabel = (model: ISquigModel, file: string, index: number) => {
  const suffix = model.phone.suffix?.[index];
  if (suffix) {
    return suffix;
  }
  const prefix = `${model.brand} ${model.name}`;
  const withoutPrefix = file.replace(
    new RegExp(`^${escapeRegExp(prefix)}\\s*`, 'i'),
    '',
  );
  return withoutPrefix || 'Measurement';
};

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getResponseOptions = (model: ISquigModel): IResponseOption[] =>
  asFiles(model.phone).map((file, index) => ({
    file,
    label: responseLabel(model, file, index),
  }));

const normalizeFileName = (file: string) => {
  if (
    !file ||
    file.includes('/') ||
    file.includes('\\') ||
    file.includes('..')
  ) {
    throw new Error('Invalid Squiglink measurement file name.');
  }
  const withoutExtension = file.replace(/\.txt$/i, '');
  return /\s[LR]$/i.test(withoutExtension)
    ? `${withoutExtension}.txt`
    : `${withoutExtension} L.txt`;
};

const cacheFilePath = (source: ISquigSource, file: string) =>
  path.join(
    cacheDir(),
    'measurements',
    source.id.replace(/[^a-z0-9._-]+/gi, '_'),
    `${file.replace(/[^a-z0-9._-]+/gi, '_')}`,
  );

const loadMeasurement = async (
  source: ISquigSource,
  file: string,
): Promise<IPoint[]> => {
  const normalized = normalizeFileName(file);
  const target = cacheFilePath(source, normalized);
  let raw: string;
  try {
    raw = await fetchText(
      `${source.dataUrl}/${encodeURIComponent(normalized)}`,
    );
    writeCache(target, raw);
  } catch (error) {
    raw = readCache(target, true) || '';
    if (!raw) {
      throw error;
    }
  }

  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('*'))
    .map((line) =>
      line
        .split(/[\s,]+/)
        .slice(0, 2)
        .map(Number),
    )
    .filter(
      ([frequency, value]) =>
        Number.isFinite(frequency) && Number.isFinite(value),
    )
    .map(([frequency, value]) => ({ frequency, value }));
};

const interpolate = (points: IPoint[], frequency: number) => {
  if (points.length === 0) {
    return 0;
  }
  if (frequency <= points[0].frequency) {
    return points[0].value;
  }
  for (let index = 1; index < points.length; index += 1) {
    const left = points[index - 1];
    const right = points[index];
    if (frequency <= right.frequency) {
      const ratio =
        (frequency - left.frequency) / (right.frequency - left.frequency);
      return left.value + (right.value - left.value) * ratio;
    }
  }
  return points[points.length - 1].value;
};

const peakingGain = (
  frequency: number,
  center: number,
  gain: number,
  quality: number,
) => {
  const sampleRate = 48000;
  const omega = (2 * Math.PI * frequency) / sampleRate;
  const centerOmega = (2 * Math.PI * center) / sampleRate;
  const alpha = Math.sin(centerOmega) / (2 * quality);
  const a = 10 ** (gain / 40);
  const a0 = 1 + alpha / a;
  const a1 = -2 * Math.cos(centerOmega);
  const a2 = 1 - alpha / a;
  const b0 = 1 + alpha * a;
  const b1 = -2 * Math.cos(centerOmega);
  const b2 = 1 - alpha * a;
  const phi = 4 * Math.sin(omega / 2) ** 2;
  const numerator =
    (b0 + b1 + b2) ** 2 +
    (b0 * b2 * phi - (b1 * (b0 + b2) + 4 * b0 * b2)) * phi;
  const denominator =
    (a0 + a1 + a2) ** 2 +
    (a0 * a2 * phi - (a1 * (a0 + a2) + 4 * a0 * a2)) * phi;
  return (
    10 * Math.log10(Math.max(numerator, 1e-12) / Math.max(denominator, 1e-12))
  );
};

const estimateQuality = (
  points: IPoint[],
  index: number,
  magnitude: number,
) => {
  const half = Math.max(Math.abs(magnitude) * 0.5, 0.25);
  let left = index;
  let right = index;
  while (left > 0 && Math.abs(points[left].value) >= half) {
    left -= 1;
  }
  while (right < points.length - 1 && Math.abs(points[right].value) >= half) {
    right += 1;
  }
  const bandwidth = Math.max(
    points[right].frequency - points[left].frequency,
    points[index].frequency * 0.05,
  );
  return clampQuality(
    Math.min(10, Math.max(0.5, points[index].frequency / bandwidth)),
  );
};

const fitCorrection = (
  frequencies: number[],
  correction: number[],
): IPresetV2 => {
  const residual = correction.slice();
  const filters: IFiltersMap = {};
  const fitted: Array<{ frequency: number; gain: number; quality: number }> =
    [];

  for (let iteration = 0; iteration < MAX_IMPORTED_FILTERS; iteration += 1) {
    let peakIndex = -1;
    let peakMagnitude = 0;
    for (let index = 0; index < frequencies.length; index += 1) {
      if (
        frequencies[index] >= MIN_EQ_FREQUENCY &&
        frequencies[index] <= MAX_EQ_FREQUENCY &&
        Math.abs(residual[index]) > Math.abs(peakMagnitude)
      ) {
        peakIndex = index;
        peakMagnitude = residual[index];
      }
    }
    if (peakIndex < 0 || Math.abs(peakMagnitude) < 0.25) {
      break;
    }

    const frequency = frequencies[peakIndex];
    const gain = clampGain(peakMagnitude);
    const quality = estimateQuality(
      frequencies.map((value, index) => ({
        frequency: value,
        value: residual[index],
      })),
      peakIndex,
      peakMagnitude,
    );
    fitted.push({ frequency, gain, quality });
    for (let index = 0; index < residual.length; index += 1) {
      residual[index] -= peakingGain(
        frequencies[index],
        frequency,
        gain,
        quality,
      );
    }
  }

  fitted
    .sort((left, right) => left.frequency - right.frequency)
    .forEach((filter) => {
      const next = getDefaultFilterWithId();
      next.type = FilterTypeEnum.PK;
      next.frequency = Math.round(
        Math.min(20000, Math.max(1, filter.frequency)),
      );
      next.gain = clampGain(filter.gain);
      next.quality = clampQuality(filter.quality);
      filters[next.id] = next;
    });

  let maxPositive = 0;
  for (let index = 0; index < frequencies.length; index += 1) {
    const response = fitted.reduce(
      (sum, filter) =>
        sum +
        peakingGain(
          frequencies[index],
          filter.frequency,
          filter.gain,
          filter.quality,
        ),
      0,
    );
    maxPositive = Math.max(maxPositive, response);
  }

  return { preAmp: clampGain(-maxPositive), filters, isFlat: false };
};

const resolveResponse = (model: ISquigModel, response: string) => {
  const options = getResponseOptions(model);
  return options.find(
    (option) => option.label === response || option.file === response,
  );
};

export const getSquiglinkSourceList = async (): Promise<ISquigSource[]> => {
  if (!sourceListPromise) {
    sourceListPromise = loadSourceManifest().catch((error) => {
      sourceListPromise = undefined;
      throw error;
    });
  }
  return sourceListPromise;
};

export const getSquiglinkDeviceList = async (sourceId = DEFAULT_SOURCE_ID) =>
  (await getPhoneBook(sourceId))
    .map((model) => model.key)
    .sort((left, right) => left.localeCompare(right));

/**
 * Refresh the public Squiglink phone book at application startup. The loader
 * keeps a stale cache as an offline fallback, so a network failure does not
 * prevent the existing device list from being used.
 */
export const syncSquiglinkDatabase = async (): Promise<{
  modelCount: number;
}> => {
  sourceListPromise = undefined;
  phoneBookPromises.clear();
  const sources = await getSquiglinkSourceList();
  return { modelCount: sources.length };
};

export const getSquiglinkResponseList = async (
  sourceIdOrDevice: string,
  deviceMaybe?: string,
) => {
  const sourceId = deviceMaybe ? sourceIdOrDevice : DEFAULT_SOURCE_ID;
  const device = deviceMaybe || sourceIdOrDevice;
  return getResponseOptions(await findModel(sourceId, device)).map(
    (option) => option.label,
  );
};

export const getSquiglinkPreset = async (
  sourceIdOrDevice: string,
  deviceOrResponse: string,
  responseMaybe?: string,
): Promise<IPresetV2> => {
  const sourceId = responseMaybe ? sourceIdOrDevice : DEFAULT_SOURCE_ID;
  const device = responseMaybe ? deviceOrResponse : sourceIdOrDevice;
  const response = responseMaybe || deviceOrResponse;
  const source = await getSource(sourceId);
  const model = await findModel(sourceId, device);
  const selected = resolveResponse(model, response);
  if (!selected) {
    throw new Error(`Squiglink response not found: ${device} / ${response}`);
  }

  const options = getResponseOptions(model);
  const baseline = options.find((option) =>
    /flat/i.test(`${option.file} ${option.label}`),
  );
  if (baseline && baseline.file === selected.file) {
    return { preAmp: 0, filters: {}, isFlat: true };
  }
  const selectedPoints = await loadMeasurement(source, selected.file);
  const baselinePoints =
    baseline && baseline.file !== selected.file
      ? await loadMeasurement(source, baseline.file)
      : undefined;
  const points = baselinePoints || selectedPoints;
  const frequencies = points
    .map((point) => point.frequency)
    .filter((frequency) => frequency >= MIN_EQ_FREQUENCY && frequency <= 20000);
  const correction = frequencies.map((frequency) => {
    const selectedValue = interpolate(selectedPoints, frequency);
    const baselineValue = baselinePoints
      ? interpolate(baselinePoints, frequency)
      : 0;
    return baselinePoints ? selectedValue - baselineValue : -selectedValue;
  });

  return fitCorrection(frequencies, correction);
};
