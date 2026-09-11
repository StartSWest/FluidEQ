/** @jest-environment node */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { writeProjectSettings } from '../../../main/memberScenes/projectSettings';
import {
  readPictureAtlas,
  writePictureImage,
} from '../../../main/memberScenes/projectPictures';

let folder: string;
const manifest = () => path.join(folder, 'pack.json');
beforeEach(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-settings-'));
});
afterEach(() => fs.rmSync(folder, { recursive: true, force: true }));

it('saves only existing controls, clamps them and preserves other project fields', async () => {
  const original = {
    id: 'scene',
    names: { en: 'Scene' },
    sourceFile: 'scene.frag',
    params: [{ id: 'glow', min: 0, max: 2, value: 1, names: { en: 'Glow' } }],
    pictures: [{ id: 'pet' }],
  };
  fs.writeFileSync(manifest(), JSON.stringify(original));
  expect(
    await writeProjectSettings(folder, {
      params: { glow: 100, extra: 1 },
      response: { sensitivity: 2, threshold: 0.1, attack: 20, release: 600 },
    }),
  ).toBe('written');
  expect(JSON.parse(fs.readFileSync(manifest(), 'utf8'))).toEqual({
    ...original,
    params: [{ ...original.params[0], value: 2 }],
    response: { sensitivity: 2, threshold: 0.1, attack: 20, release: 600 },
  });
  expect(await writeProjectSettings(folder, { params: { glow: NaN } })).toBe(
    'unchanged',
  );
  expect(await writeProjectSettings(folder, { response: null })).toBe(
    'written',
  );
  expect(JSON.parse(fs.readFileSync(manifest(), 'utf8'))).not.toHaveProperty(
    'response',
  );
});

it('rejects invalid picture regions and paths without creating an image', async () => {
  const atlas = {
    artworkFile: 'artwork.webp',
    artworkWidth: 128,
    artworkHeight: 64,
  };
  const slot = { id: 'pet', x: 0, y: 0, width: 64, height: 64 };
  fs.writeFileSync(manifest(), JSON.stringify({ ...atlas, pictures: [slot] }));
  expect(await readPictureAtlas(folder)).toMatchObject({
    kind: 'atlas',
    atlas: { pictures: [{ id: 'pet' }] },
  });
  expect(await writePictureImage(folder, new Uint8Array(64))).toBe(
    'bad-picture',
  );
  fs.writeFileSync(
    manifest(),
    JSON.stringify({ ...atlas, pictures: [slot, slot] }),
  );
  expect(await readPictureAtlas(folder)).toEqual({ kind: 'impossible' });
  fs.writeFileSync(
    manifest(),
    JSON.stringify({ ...atlas, pictures: [{ ...slot, x: 100 }] }),
  );
  expect(await readPictureAtlas(folder)).toEqual({ kind: 'impossible' });
  fs.writeFileSync(
    manifest(),
    JSON.stringify({ ...atlas, artworkFile: '../outside.webp' }),
  );
  expect(await readPictureAtlas(folder)).toEqual({ kind: 'impossible' });
  expect(fs.readdirSync(folder)).toEqual(['pack.json']);
});
