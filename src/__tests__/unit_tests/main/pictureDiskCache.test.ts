/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Gallery pictures on disk: kept by name, bounded by bytes with the least
 * recently looked at going first, and never handed back when what is on disk
 * is not a picture the gallery would accept.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { createPictureDiskCache } from '../../../main/plus/pictureDiskCache';
import { webpBytes } from '../../utils/memberSceneFixtures';

let dir: string;

beforeEach(() => {
  dir = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-pictures-')),
    'kept',
  );
});

afterEach(() => {
  fs.rmSync(path.dirname(dir), { recursive: true, force: true });
});

/** Every kept file's last-looked-at time, set by hand so the order is certain. */
const age = (secondsAgo: number) => {
  const when = new Date(Date.now() - secondsAgo * 1000);
  return when;
};

describe('pictures kept on disk', () => {
  it('gives back what it kept, by name, and nothing for a name it never kept', async () => {
    const cache = createPictureDiskCache({ dir, maxBytes: 10_000 });
    const picture = webpBytes(200);
    await cache.write('a@1:2026-09-10', picture);
    expect(await cache.read('a@1:2026-09-10')).toEqual(picture);
    expect(await cache.read('a@1:2026-09-11')).toBeUndefined();
  });

  it('lets the least recently looked-at pictures go once it is over its bytes, and a look keeps one', async () => {
    const cache = createPictureDiskCache({ dir, maxBytes: 250 });
    await cache.write('first', webpBytes(100));
    await cache.write('second', webpBytes(100));
    const [firstFile, secondFile] = fs
      .readdirSync(dir)
      .map((name) => path.join(dir, name));
    // Both old; "first" is looked at again, which makes "second" the oldest.
    fs.utimesSync(firstFile, age(60), age(60));
    fs.utimesSync(secondFile, age(30), age(30));
    expect(await cache.read('first')).toBeDefined();

    await cache.write('third', webpBytes(100));

    expect(await cache.read('second')).toBeUndefined();
    expect(await cache.read('first')).toBeDefined();
    expect(await cache.read('third')).toBeDefined();
  });

  it('does not hand back, and removes, a file that is not a picture the gallery accepts', async () => {
    const cache = createPictureDiskCache({ dir, maxBytes: 10_000 });
    await cache.write('torn', webpBytes(100));
    const [file] = fs.readdirSync(dir).map((name) => path.join(dir, name));
    fs.writeFileSync(file, 'RIFF-half');
    expect(await cache.read('torn')).toBeUndefined();
    expect(fs.readdirSync(dir)).toEqual([]);
  });
});
