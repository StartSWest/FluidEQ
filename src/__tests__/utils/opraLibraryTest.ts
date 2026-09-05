/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/

/**
 * Validate the bundled OPRA library, in full, against what the app expects.
 *
 * Not a Jest test: it reads the real `opra/` directory rather than a fixture,
 * which makes it a check on the *data* we are about to ship rather than on the
 * code that reads it. `pnpm test:opra`, and a step in CI.
 *
 * Its predecessor did the same job for AutoEq by matching every line of every
 * text file against a regular expression. There are no text files now, so what
 * it checks instead is that the index and the curve shards agree, that every
 * band is one the reader can map, and that the manifest describes what is
 * actually on disk — the last of which is the property whose absence let a
 * manifest claiming 8,850 profiles sit beside a published database of 26,553.
 */

import fs from 'fs';
import path from 'path';

const REPO_ROOT = path.join(__dirname, '../../..');
const OPRA_DIR = path.join(REPO_ROOT, 'opra');
const MANIFEST = path.join(REPO_ROOT, 'assets', 'opra-version.json');

/** Kept in step with BAND_TYPES in src/main/opra.ts. */
const KNOWN_BAND_TYPES = new Set([
  'peak_dip',
  'low_shelf',
  'high_shelf',
  'low_pass',
  'high_pass',
  'band_pass',
  'band_stop',
]);

/**
 * Pass filters are described by a slope, not by a gain and a Q, so they are the
 * one band shape where a missing `gain_db` is the data being correct.
 */
const PASS_TYPES = new Set(['low_pass', 'high_pass']);

/** The editor's ceiling; a curve wider than this would be silently truncated. */
const MAX_NUM_FILTERS = 128;

interface ICurve {
  id: string;
  author: string;
  details: string;
  link?: string;
}

interface IProduct {
  id: string;
  vendor: string;
  name: string;
  subtype: string;
  curves: ICurve[];
}

interface IBand {
  type: string;
  frequency: number;
  gain_db?: number;
  slope?: number;
}

/** One vendor's file: product slug -> curve id -> that curve's bands. */
type TShard = Record<
  string,
  Record<string, { gainDb: number; bands: IBand[] }>
>;

const fail = (message: string): never => {
  throw new Error(message);
};

const main = () => {
  if (!fs.existsSync(OPRA_DIR)) {
    fail(`No bundled library at ${OPRA_DIR}. Run \`pnpm opra:update\` first.`);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const { products } = JSON.parse(
    fs.readFileSync(path.join(OPRA_DIR, 'index.json'), 'utf8'),
  ) as { products: IProduct[] };

  if (products.length !== manifest.productCount) {
    fail(
      `The manifest claims ${manifest.productCount} products and the index` +
        ` holds ${products.length}.`,
    );
  }

  const seenProducts = new Set<string>();
  const seenCurves = new Set<string>();
  let curveCount = 0;
  let bandCount = 0;

  const shardCache = new Map<string, TShard>();
  const readShard = (vendorId: string): TShard => {
    const cached = shardCache.get(vendorId);
    if (cached) {
      return cached;
    }
    const shardPath = path.join(OPRA_DIR, 'curves', `${vendorId}.json`);
    if (!fs.existsSync(shardPath)) {
      fail(`No curve data for vendor ${vendorId}.`);
    }
    const parsed = JSON.parse(fs.readFileSync(shardPath, 'utf8')) as TShard;
    shardCache.set(vendorId, parsed);
    return parsed;
  };

  products.forEach((product) => {
    if (seenProducts.has(product.id)) {
      fail(`Duplicate product id: ${product.id}`);
    }
    seenProducts.add(product.id);

    const parts = product.id.split('::');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      fail(`Unexpected product id: ${product.id}`);
    }
    const [vendorId, slug] = parts;
    if (!product.vendor || !product.name) {
      fail(`Product ${product.id} is missing a vendor or a name.`);
    }
    if (product.curves.length === 0) {
      fail(`Product ${product.id} has no curves and should not be listed.`);
    }

    const bandsForProduct = readShard(vendorId)[slug];
    if (!bandsForProduct) {
      fail(`No curve data for ${product.id}.`);
    }

    product.curves.forEach((curve) => {
      if (seenCurves.has(curve.id)) {
        fail(`Duplicate curve id: ${curve.id}`);
      }
      seenCurves.add(curve.id);
      curveCount += 1;

      // The licence asks for the author to be credited; a blank one would be a
      // credit line that silently says nothing.
      if (!curve.author) {
        fail(`Curve ${curve.id} has no author to credit.`);
      }
      if (!curve.details) {
        fail(`Curve ${curve.id} has no description.`);
      }

      const bands = bandsForProduct[curve.id];
      if (!bands) {
        fail(`Curve ${curve.id} is listed in the index but has no bands.`);
      }
      if (!Array.isArray(bands.bands) || bands.bands.length === 0) {
        fail(`Curve ${curve.id} has an empty band list.`);
      }
      if (bands.bands.length > MAX_NUM_FILTERS) {
        fail(
          `Curve ${curve.id} has ${bands.bands.length} bands, more than the` +
            ` editor's ${MAX_NUM_FILTERS}.`,
        );
      }
      if (!Number.isFinite(bands.gainDb)) {
        fail(`Curve ${curve.id} has a non-numeric preamp.`);
      }

      bands.bands.forEach((band) => {
        bandCount += 1;
        if (!KNOWN_BAND_TYPES.has(band.type)) {
          fail(`Curve ${curve.id} uses unknown band type "${band.type}".`);
        }
        if (!Number.isFinite(band.frequency) || band.frequency <= 0) {
          fail(`Curve ${curve.id} has a band with no usable frequency.`);
        }
        if (PASS_TYPES.has(band.type)) {
          // A pass filter needs a slope instead; without one there is nothing
          // to derive its Q from and it would land on the neutral default.
          if (!Number.isFinite(band.slope)) {
            fail(
              `Curve ${curve.id} has a ${band.type} band with no slope to` +
                ` derive a Q from.`,
            );
          }
        } else if (!Number.isFinite(band.gain_db)) {
          fail(`Curve ${curve.id} has a band with no usable gain.`);
        }
      });
    });
  });

  // Nothing in the shards that the index does not list: an orphan is a curve
  // shipped to nobody, and a sign the two were built from different runs.
  fs.readdirSync(path.join(OPRA_DIR, 'curves')).forEach((file) => {
    const vendorId = path.basename(file, '.json');
    const shard = readShard(vendorId);
    Object.entries(shard).forEach(([slug, curves]) => {
      Object.keys(curves).forEach((curveId) => {
        if (!seenCurves.has(curveId)) {
          fail(`Curve ${curveId} (${vendorId}::${slug}) is in no index entry.`);
        }
      });
    });
  });

  if (curveCount !== manifest.curveCount) {
    fail(
      `The manifest claims ${manifest.curveCount} curves and the index holds` +
        ` ${curveCount}.`,
    );
  }

  process.stdout.write(
    `OPRA library valid: ${products.length} products, ${curveCount} curves,` +
      ` ${bandCount} bands, source ${String(manifest.contentHash).slice(0, 12)}\n`,
  );
};

try {
  main();
} catch (error) {
  process.stderr.write(`${(error as Error).message}\n`);
  process.exit(1);
}
