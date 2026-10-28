/** @jest-environment node */
/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { readProjectNames } from 'main/memberScenes/project';
import { readPictureAtlas } from 'main/memberScenes/projectPictures';

let folder: string;
beforeAll(async () => {
  folder = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), 'fluideq-locale-names-'),
  );
});
afterAll(async () => {
  await fs.promises.unlink(path.join(folder, 'pack.json'));
  await fs.promises.rmdir(folder);
});

it('retains the script locale on project and picture names read back from disk', async () => {
  const names = {
    en: 'Light',
    ko: '빛',
    'zh-Hant': '光芒',
    'zh-Hant-extra': 'discard',
  };
  await fs.promises.writeFile(
    path.join(folder, 'pack.json'),
    JSON.stringify({
      names,
      artworkFile: 'artwork.webp',
      artworkWidth: 64,
      artworkHeight: 64,
      pictures: [{ id: 'photo', names, x: 0, y: 0, width: 64, height: 64 }],
    }),
  );
  const expected = { en: 'Light', ko: '빛', 'zh-Hant': '光芒' };
  expect(await readProjectNames(folder)).toEqual(expected);
  const pictures = await readPictureAtlas(folder);
  expect(pictures.kind).toBe('atlas');
  if (pictures.kind !== 'atlas') {
    throw new Error('The positive-control atlas was rejected');
  }
  expect(pictures.atlas.pictures[0].names).toEqual(expected);
});
