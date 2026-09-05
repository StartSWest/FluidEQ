/**
 * Build the bundled headphone correction library from OPRA.
 *
 * OPRA (Open Profiles for Revealing Audio) publishes its whole dataset as a
 * single ~12 MB JSONL file: one record per line, each a vendor, a product or an
 * EQ curve. That is a fine shape to publish and a poor shape to ship — the app
 * needs a product list before it needs any bands at all, and reading twelve
 * megabytes to populate a dropdown would put the entire catalogue in the main
 * process's memory for the whole session.
 *
 * So this splits it in two:
 *
 *   opra/index.json          vendors, products and per-curve *metadata*, with
 *                            no band data. Read once, cached, and enough to
 *                            drive both pickers and the search.
 *   opra/curves/<vendor>.json the bands, one file per vendor, read only when
 *                            somebody actually applies a curve.
 *
 * which keeps memory flat and mirrors how the AutoEq library this replaces was
 * read — one small listing, then one file.
 *
 * Sharded by vendor rather than by product because the products are tiny. One
 * file each would be 6,229 files averaging 1.3 KB, which on a 4 KB-cluster NTFS
 * volume turns 7.9 MB of JSON into 31 MB on disk and gives Windows six thousand
 * more files to install and scan. Per vendor it is 714 files averaging 11 KB —
 * the same bytes, a fifth of the disk, and a read that is still trivial.
 *
 * Why OPRA and not AutoEq: AutoEq stopped upstream in July 2025 and the update
 * check keyed on its commit hash, so it could never fire again. OPRA re-imports
 * the same measurement sources monthly, carries oratory1990's own curves, and
 * covers 99.45% of the models the AutoEq library held.
 *
 * Licensing: OPRA's data is CC BY-SA 4.0. The reshaping below produces adapted
 * material, so the generated library carries the licence with it wherever it
 * goes — see the packaging workflow, which zips the licence text *inside* the
 * update archive rather than beside it. Attribution is not a footnote here
 * either: every curve keeps its `author` and `details` so the app can say who
 * made it and who measured it, which is what the licence asks for.
 *
 * FluidEQ is sold, which makes this commercial use, and OPRA asks commercial
 * consumers to mirror the dataset themselves rather than lean on the CDN they
 * run for open-source projects. Fetching from GitHub at build time and
 * republishing our own copy is exactly that.
 */

import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

const SOURCE_URL =
  'https://raw.githubusercontent.com/opra-project/OPRA/main/dist/database_v1.jsonl';

const REPO_ROOT = path.join(__dirname, '..');
const OUTPUT_DIR = path.join(REPO_ROOT, 'opra');
const STAGING_DIR = path.join(REPO_ROOT, '.opra-next');
const MANIFEST_PATH = path.join(REPO_ROOT, 'assets', 'opra-version.json');

/**
 * Below this, something has gone wrong upstream and we are about to replace a
 * working library with a broken one. The same guard the AutoEq importer had,
 * for the same reason.
 */
const MINIMUM_PRODUCTS = 1000;

/**
 * OPRA's band vocabulary. Listed here rather than in the reader so that a type
 * we have never seen fails the build instead of being silently dropped from
 * somebody's correction at runtime — the reader maps these onto FilterTypeEnum.
 */
const KNOWN_BAND_TYPES = new Set([
  'peak_dip',
  'low_shelf',
  'high_shelf',
  'low_pass',
  'high_pass',
  'band_pass',
  'band_stop',
]);

interface ISourceBand {
  type: string;
  frequency: number;
  gain_db: number;
  q?: number;
}

interface ISourceRecord {
  type: 'vendor' | 'product' | 'eq';
  id: string;
  data: Record<string, unknown>;
}

/** Metadata only — enough to list and credit a curve, with no bands. */
interface IBuiltCurve {
  id: string;
  author: string;
  details: string;
  link?: string;
}

interface IBuiltProduct {
  id: string;
  vendor: string;
  name: string;
  subtype: string;
  curves: IBuiltCurve[];
}

/**
 * Read it all, then write it. Deliberately not streamed — see the note in
 * fetch-equalizer-apo.ts: `fetch` + `pipeline` trips an assertion inside Node's
 * HTTP parser when the disk lags the socket, and nothing fetched here is big
 * enough for streaming to be worth that.
 */
const download = async (url: string): Promise<string> => {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  const body = Buffer.from(await response.arrayBuffer());
  if (body.byteLength === 0) {
    throw new Error('empty response');
  }
  return body.toString('utf8');
};

/** `vendor::slug` — verified unique, and safe as a path on Windows. */
const splitProductId = (id: string) => {
  const parts = id.split('::');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`Unexpected OPRA product id: ${id}`);
  }
  return { vendorId: parts[0], slug: parts[1] };
};

const buildOpraDatabase = async (sourcePath?: string) => {
  const raw = sourcePath
    ? fs.readFileSync(sourcePath, 'utf8')
    : await download(SOURCE_URL);

  // Hashed before anything is reshaped, so the manifest identifies the upstream
  // dataset rather than our rendering of it. This is what the updater compares:
  // OPRA has no per-release version to key on, and keying on an upstream commit
  // is precisely the mistake that left the AutoEq library frozen.
  const contentHash = createHash('sha256').update(raw, 'utf8').digest('hex');

  const vendors = new Map<string, string>();
  const products = new Map<string, IBuiltProduct>();
  /** vendor id -> product slug -> curve id -> bands. */
  const bandsByVendor = new Map<
    string,
    Record<string, Record<string, { gainDb: number; bands: ISourceBand[] }>>
  >();

  const records: ISourceRecord[] = raw
    .split('\n')
    .map((line, index) => ({ line: line.trim(), number: index + 1 }))
    .filter((entry) => entry.line.length > 0)
    .map((entry) => {
      try {
        return JSON.parse(entry.line) as ISourceRecord;
      } catch (error) {
        throw new Error(
          `OPRA line ${entry.number} is not valid JSON: ${
            (error as Error).message
          }`,
        );
      }
    });

  // Vendors first: a product's display name needs its vendor, and the file
  // does not promise an order.
  records
    .filter((record) => record.type === 'vendor')
    .forEach((record) => {
      vendors.set(record.id, String(record.data.name ?? record.id));
    });

  records
    .filter((record) => record.type === 'product')
    .forEach((record) => {
      const vendorId = String(record.data.vendor_id ?? '');
      const vendor = vendors.get(vendorId);
      if (!vendor) {
        throw new Error(`OPRA product ${record.id} names an unknown vendor.`);
      }
      products.set(record.id, {
        id: record.id,
        vendor,
        name: String(record.data.name ?? ''),
        subtype: String(record.data.subtype ?? 'over_the_ear'),
        curves: [],
      });
    });

  let curveCount = 0;
  records
    .filter((record) => record.type === 'eq')
    .forEach((record) => {
      const productId = String(record.data.product_id ?? '');
      const product = products.get(productId);
      if (!product) {
        throw new Error(`OPRA curve ${record.id} names an unknown product.`);
      }
      // Only parametric_eq exists today. The schema reserves room for a
      // graphic_eq that has never shipped; if one appears, stop rather than
      // quietly hand the reader something it will read as parametric.
      const curveType = String(record.data.type ?? '');
      if (curveType !== 'parametric_eq') {
        throw new Error(
          `OPRA curve ${record.id} is "${curveType}", which this importer does` +
            ` not understand. Teach the reader about it before shipping it.`,
        );
      }

      const parameters = (record.data.parameters ?? {}) as {
        gain_db?: number;
        bands?: ISourceBand[];
      };
      const bands = parameters.bands ?? [];
      if (bands.length === 0) {
        throw new Error(`OPRA curve ${record.id} has no bands.`);
      }
      bands.forEach((band) => {
        if (!KNOWN_BAND_TYPES.has(band.type)) {
          throw new Error(
            `OPRA curve ${record.id} uses band type "${band.type}", which has no` +
              ` FilterTypeEnum equivalent.`,
          );
        }
      });

      const link = record.data.link ? String(record.data.link) : undefined;
      product.curves.push({
        id: record.id,
        author: String(record.data.author ?? ''),
        details: String(record.data.details ?? ''),
        ...(link ? { link } : {}),
      });

      const { vendorId, slug } = splitProductId(productId);
      const vendorBands = bandsByVendor.get(vendorId) ?? {};
      vendorBands[slug] = vendorBands[slug] ?? {};
      vendorBands[slug][record.id] = {
        gainDb: Number(parameters.gain_db ?? 0),
        bands,
      };
      bandsByVendor.set(vendorId, vendorBands);
      curveCount += 1;
    });

  if (products.size < MINIMUM_PRODUCTS) {
    throw new Error(
      `Only ${products.size} products were found; refusing to replace the` +
        ` bundled library.`,
    );
  }

  // A product with no curve is a row in the picker that cannot do anything.
  const listed = [...products.values()].filter(
    (product) => product.curves.length > 0,
  );
  listed.sort(
    (left, right) =>
      left.vendor.localeCompare(right.vendor) ||
      left.name.localeCompare(right.name),
  );
  listed.forEach((product) => {
    product.curves.sort((left, right) =>
      left.details.localeCompare(right.details),
    );
  });

  if (fs.existsSync(STAGING_DIR)) {
    fs.rmSync(STAGING_DIR, { recursive: true });
  }
  fs.mkdirSync(path.join(STAGING_DIR, 'curves'), { recursive: true });

  bandsByVendor.forEach((vendorBands, vendorId) => {
    fs.writeFileSync(
      path.join(STAGING_DIR, 'curves', `${vendorId}.json`),
      JSON.stringify(vendorBands),
      'utf8',
    );
  });

  fs.writeFileSync(
    path.join(STAGING_DIR, 'index.json'),
    JSON.stringify({ products: listed }),
    'utf8',
  );

  if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true });
  }
  fs.renameSync(STAGING_DIR, OUTPUT_DIR);

  const manifest = {
    version: 1 as const,
    contentHash,
    vendorCount: new Set(listed.map((product) => product.vendor)).size,
    productCount: listed.length,
    curveCount,
    generatedAt: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
  fs.writeFileSync(
    MANIFEST_PATH,
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );

  return manifest;
};

if (require.main === module) {
  const sourceFlag = process.argv.indexOf('--source');
  const sourcePath =
    sourceFlag === -1 ? undefined : process.argv[sourceFlag + 1];
  buildOpraDatabase(sourcePath)
    .then((manifest) => {
      process.stdout.write(
        `Imported ${manifest.curveCount} curves for ${manifest.productCount}` +
          ` products from ${manifest.vendorCount} vendors` +
          ` (source ${manifest.contentHash.slice(0, 12)})\n`,
      );
      return manifest;
    })
    .catch((error: Error) => {
      process.stderr.write(`${error.message}\n`);
      process.exit(1);
    });
}

export default buildOpraDatabase;
