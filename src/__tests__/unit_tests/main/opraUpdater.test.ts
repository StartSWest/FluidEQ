/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import os from 'os';
import path from 'path';
import type { IOpraDatabaseManifest } from '../../../common/constants';

jest.mock('electron', () => ({ app: { isPackaged: false } }));

// eslint-disable-next-line import/first -- the mock above has to be in place before the module reads `app`
import { validateDatabase } from '../../../main/opraUpdater';

const PRODUCTS = 1000;
const VENDORS = 3;
const MANIFEST: IOpraDatabaseManifest = {
  version: 1,
  contentHash: 'test',
  vendorCount: VENDORS,
  productCount: PRODUCTS,
  curveCount: 0,
  generatedAt: '2026-09-28T00:00:00Z',
};

/** A library shaped exactly as the importer writes one. */
const writeLibrary = (
  root: string,
  productId = (n: number) => `v${n % VENDORS}::p${n}`,
) => {
  fs.mkdirSync(path.join(root, 'curves'), { recursive: true });
  const products = Array.from({ length: PRODUCTS }, (_, n) => ({
    id: productId(n),
    curves: [],
  }));
  fs.writeFileSync(path.join(root, 'index.json'), JSON.stringify({ products }));
  for (let vendor = 0; vendor < VENDORS; vendor += 1) {
    fs.writeFileSync(path.join(root, 'curves', `v${vendor}.json`), '{}');
  }
};

describe('a downloaded OPRA library', () => {
  let scratch: string;
  let library: string;

  beforeEach(() => {
    scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'opra-update-'));
    library = path.join(scratch, 'opra');
  });

  afterEach(() => {
    fs.rmSync(scratch, { recursive: true, force: true });
  });

  it('is taken when it holds the index and the shards and nothing else', () => {
    writeLibrary(library);
    expect(() => validateDatabase(library, MANIFEST)).not.toThrow();
  });

  it('is refused with anything beside the index and the curves folder', () => {
    writeLibrary(library);
    fs.writeFileSync(path.join(library, 'extra.json'), '{}');
    expect(() => validateDatabase(library, MANIFEST)).toThrow(
      'not the library',
    );
  });

  it('is refused with a link among its shards', () => {
    writeLibrary(library);
    const outside = path.join(scratch, 'outside');
    fs.mkdirSync(outside);
    // A junction needs no privilege on Windows, which is what makes it the
    // link an unprivileged archive or process would actually leave.
    fs.symlinkSync(
      outside,
      path.join(library, 'curves', 'v9.json'),
      'junction',
    );
    expect(() => validateDatabase(library, MANIFEST)).toThrow(
      'more than curves',
    );
  });

  it('is refused with a shard named outside the importer’s alphabet', () => {
    writeLibrary(library);
    fs.writeFileSync(path.join(library, 'curves', '..v1.json'), '{}');
    expect(() => validateDatabase(library, MANIFEST)).toThrow(
      'more than curves',
    );
  });

  it('is refused when a product id could name a path', () => {
    writeLibrary(library, (n) =>
      n === 7 ? '..\\..\\x::p7' : `v${n % VENDORS}::p${n}`,
    );
    expect(() => validateDatabase(library, MANIFEST)).toThrow(
      'failed validation',
    );
  });
});
