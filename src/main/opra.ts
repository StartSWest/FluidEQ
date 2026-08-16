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

/**
 * Read the bundled OPRA correction library.
 *
 * This replaces a parser that read AutoEq's Equalizer APO text exports line by
 * line with two regular expressions. OPRA publishes structured JSON instead, so
 * the whole grammar-matching layer is gone: a band arrives as a type, a
 * frequency, a gain and a Q, and the only work left is mapping its vocabulary
 * onto ours and bounding the numbers.
 *
 * Laid out by `scripts/build-opra-database.ts` as one small index plus one
 * bands file per vendor, so listing the catalogue never reads any bands and
 * applying a curve reads about eleven kilobytes.
 */

import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import {
  FilterTypeEnum,
  clampFrequency,
  clampGain,
  clampReferenceGain,
  clampQuality,
  getDefaultFilterWithId,
  IFilter,
  IFiltersMap,
  IOpraProduct,
  IPresetV2,
  MAX_NUM_FILTERS,
} from '../common/constants';

const getBundledOpraDir = () =>
  app.isPackaged
    ? path.join(process.resourcesPath, 'opra')
    : path.join(__dirname, '../../opra');

const getOpraDir = () => {
  const downloadedDir = path.join(app.getPath('userData'), 'opra');
  const downloadedManifest = path.join(
    app.getPath('userData'),
    'opra-version.json',
  );
  return fs.existsSync(downloadedManifest) && fs.existsSync(downloadedDir)
    ? downloadedDir
    : getBundledOpraDir();
};

/**
 * Products that are in the data and should not be offered.
 *
 * Empty against the current dataset — the Razer Kraken V4 measurements this
 * existed for are not in OPRA at all — but kept because the reason it was added
 * has not gone away: a published measurement can be wrong, and there needs to
 * be somewhere to say so without waiting for upstream. Keyed on OPRA product
 * id, which is stable, rather than on a display name, which is not.
 */
const EXCLUDED_OPRA_PRODUCTS = new Set<string>([]);

/**
 * OPRA's band vocabulary, mapped onto Equalizer APO's.
 *
 * Every type OPRA's schema allows has an equivalent here, so nothing can arrive
 * that we would have to drop. In the current dataset only the first four occur
 * at all, and `low_pass` only five times across 122,872 bands — the rest are
 * mapped because the schema permits them, not because they are used.
 */
const BAND_TYPES: Record<string, FilterTypeEnum> = {
  peak_dip: FilterTypeEnum.PK,
  low_shelf: FilterTypeEnum.LSC,
  high_shelf: FilterTypeEnum.HSC,
  low_pass: FilterTypeEnum.LPQ,
  high_pass: FilterTypeEnum.HPQ,
  band_pass: FilterTypeEnum.BP,
  band_stop: FilterTypeEnum.NO,
};

interface ISourceBand {
  type: string;
  frequency: number;
  /** Absent on pass filters, which attenuate rather than lift or cut. */
  gain_db?: number;
  q?: number;
  /** dB per octave, given instead of a Q on the pass filters that have one. */
  slope?: number;
}

/**
 * The pass filters, which are described by a slope rather than a gain and a Q.
 */
const PASS_TYPES = new Set(['low_pass', 'high_pass']);

/**
 * Maximally flat, and the right reading of "12 dB per octave".
 *
 * Five bands in the library are low-pass filters carrying `slope: 12` and
 * neither a gain nor a Q. Twelve dB per octave is a second-order filter, and a
 * second-order filter with no ripple is Butterworth, whose Q is 1/√2. Letting
 * these fall through to the neutral default of 1 instead would put a ~1.2 dB
 * lift just below the corner — small, but audible, and not what was published.
 */
const BUTTERWORTH_Q = Math.SQRT1_2;

/** Second order, i.e. the only slope a single APO section can express. */
const SECOND_ORDER_SLOPE = 12;

const qualityFor = (band: ISourceBand) => {
  if (Number.isFinite(band.q)) {
    return clampQuality(band.q as number);
  }
  if (PASS_TYPES.has(band.type) && band.slope === SECOND_ORDER_SLOPE) {
    return clampQuality(BUTTERWORTH_Q);
  }
  // Anything else without a Q gets the neutral default.
  return clampQuality(Number.NaN);
};

interface IIndexFile {
  products: IOpraProduct[];
}

/** curve id -> the curve's preamp and bands. */
type TVendorCurves = Record<
  string,
  Record<string, { gainDb: number; bands: ISourceBand[] }>
>;

/**
 * The index is read once per directory and kept.
 *
 * It is two megabytes of JSON behind every keystroke in a filterable dropdown
 * of six thousand products, so re-reading it per call would be felt. Keyed by
 * directory so that swapping in a downloaded database invalidates it for free.
 */
let cachedIndex: { dir: string; products: IOpraProduct[] } | undefined;

const readIndex = (opraDir: string): IOpraProduct[] => {
  if (cachedIndex?.dir === opraDir) {
    return cachedIndex.products;
  }
  const file = fs.readFileSync(path.join(opraDir, 'index.json'), 'utf8');
  const parsed = JSON.parse(file) as IIndexFile;
  const products = (parsed.products ?? []).filter(
    (product) => !EXCLUDED_OPRA_PRODUCTS.has(product.id),
  );
  cachedIndex = { dir: opraDir, products };
  return products;
};

/** Dropped whenever the database on disk is replaced. */
export const forgetOpraIndex = () => {
  cachedIndex = undefined;
};

/**
 * Every product, each carrying its own curve metadata.
 *
 * Sent whole rather than paired with a per-product curve call. The curves are
 * metadata — an id, an author and a line of credit — so they travel with the
 * product for about the cost of asking for them separately, and the second
 * dropdown then needs no round trip at all.
 */
export const getOpraProductList = (
  opraDir: string = getOpraDir(),
): IOpraProduct[] => readIndex(opraDir);

/** `vendor::slug`, which is also where the bands live. */
const splitProductId = (productId: string) => {
  const parts = productId.split('::');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`Unexpected OPRA product id: ${productId}`);
  }
  return { vendorId: parts[0], slug: parts[1] };
};

export const getOpraPreset = (
  productId: string,
  curveId: string,
  opraDir: string = getOpraDir(),
): IPresetV2 => {
  if (EXCLUDED_OPRA_PRODUCTS.has(productId)) {
    throw new Error(`OPRA product is not offered: ${productId}`);
  }
  const { vendorId, slug } = splitProductId(productId);
  const shardPath = path.join(opraDir, 'curves', `${vendorId}.json`);
  const shard = JSON.parse(fs.readFileSync(shardPath, 'utf8')) as TVendorCurves;
  const curve = shard[slug]?.[curveId];
  if (!curve) {
    throw new Error(`Unknown OPRA curve: ${curveId}`);
  }

  const filters: IFiltersMap = {};
  curve.bands
    // The importer rejects unknown types at build time, so a band that lands
    // here means the database on disk was not built by it. Losing the band
    // beats losing the whole correction.
    .filter((band) => BAND_TYPES[band.type])
    // Nothing in the published data comes close — the widest curve is twenty
    // bands — but the editor's ceiling is the editor's ceiling.
    .slice(0, MAX_NUM_FILTERS)
    .forEach((band) => {
      const filter: IFilter = getDefaultFilterWithId();
      filter.type = BAND_TYPES[band.type];
      // Rounded rather than truncated: forty-nine bands sit on fractional
      // centres, the lowest at 8.5 Hz, and parseInt would have moved every one
      // of them down a hair for no reason.
      filter.frequency = clampFrequency(band.frequency);
      // A published measurement, not something the user asked for. A pass
      // filter has no gain at all, and clampReferenceGain reads its absence as
      // zero.
      filter.gain = clampReferenceGain(
        band.gain_db as number,
        filter.frequency,
      );
      filter.quality = qualityFor(band);
      filters[filter.id] = filter;
    });

  if (Object.keys(filters).length === 0) {
    throw new Error(`OPRA curve has no usable bands: ${curveId}`);
  }

  return {
    preAmp: clampGain(curve.gainDb),
    filters,
  };
};
