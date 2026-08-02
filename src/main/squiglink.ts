/*
 * Squiglink measurements are fetched on demand instead of being bundled.
 * The public GadgetryTech database exposes a phone_book.json index and REW
 * text measurements. FluidEQ uses those measurements to fit a small PEQ
 * correction locally, while keeping the original attribution link visible in
 * the renderer.
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
  IPresetV2,
  MAX_NUM_FILTERS,
} from '../common/constants';

const SQUIG_BASE_URL = 'https://gadgetrytech.squig.link/headsets/data';
const PHONE_BOOK_URL = `${SQUIG_BASE_URL}/phone_book.json`;
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

interface ISquigModel {
  key: string;
  brand: string;
  name: string;
  phone: ISquigPhone;
}

interface IResponseOption {
  file: string;
  label: string;
}

interface IPoint {
  frequency: number;
  value: number;
}

let phoneBookPromise: Promise<ISquigModel[]> | undefined;

const cacheDir = () => path.join(app.getPath('userData'), 'squiglink');
const phoneBookCachePath = () =>
  path.join(cacheDir(), 'gadgetrytech-phone-book.json');

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

const loadPhoneBook = async (): Promise<ISquigModel[]> => {
  const cachePath = phoneBookCachePath();
  let raw: string;
  try {
    raw = await fetchText(PHONE_BOOK_URL);
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
      })),
  );
};

const getPhoneBook = async () => {
  if (!phoneBookPromise) {
    phoneBookPromise = loadPhoneBook().catch((error) => {
      phoneBookPromise = undefined;
      throw error;
    });
  }
  return phoneBookPromise;
};

const findModel = async (device: string) => {
  const model = (await getPhoneBook()).find((entry) => entry.key === device);
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

const cacheFilePath = (file: string) =>
  path.join(
    cacheDir(),
    'measurements',
    `${file.replace(/[^a-z0-9._-]+/gi, '_')}`,
  );

const loadMeasurement = async (file: string): Promise<IPoint[]> => {
  const normalized = normalizeFileName(file);
  const target = cacheFilePath(normalized);
  let raw: string;
  try {
    raw = await fetchText(
      `${SQUIG_BASE_URL}/${encodeURIComponent(normalized)}`,
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

export const getSquiglinkDeviceList = async () =>
  (await getPhoneBook())
    .map((model) => model.key)
    .sort((left, right) => left.localeCompare(right));

export const getSquiglinkResponseList = async (device: string) =>
  getResponseOptions(await findModel(device)).map((option) => option.label);

export const getSquiglinkPreset = async (
  device: string,
  response: string,
): Promise<IPresetV2> => {
  const model = await findModel(device);
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
  const selectedPoints = await loadMeasurement(selected.file);
  const baselinePoints =
    baseline && baseline.file !== selected.file
      ? await loadMeasurement(baseline.file)
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
