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

// An image of art the member's AI made and packed: one photo chosen for the
// whole-image place an older pack gets would paint over every piece of it.
it('offers no place for a photo over an image the scene lists as its own pieces', async () => {
  const atlas = {
    artworkFile: 'artwork.webp',
    artworkWidth: 128,
    artworkHeight: 64,
  };
  const pieces = [
    { id: 'koi', x: 0, y: 0, width: 64, height: 64 },
    { id: 'sand', x: 64, y: 0, width: 64, height: 64 },
  ];
  const write = (fields: Record<string, unknown>) =>
    fs.writeFileSync(manifest(), JSON.stringify({ ...atlas, ...fields }));

  // Control: an older pack's single photo, the whole image its one place.
  write({});
  expect(await readPictureAtlas(folder)).toMatchObject({
    kind: 'atlas',
    atlas: { pictures: [{ id: 'picture', x: 0, y: 0, width: 128 }] },
  });

  write({ artworkRegions: pieces });
  expect(await readPictureAtlas(folder)).toMatchObject({
    kind: 'atlas',
    atlas: { width: 128, height: 64, pictures: [] },
  });

  // Places the scene names are still offered beside its own pieces.
  write({
    artworkRegions: pieces.slice(0, 1),
    pictures: [{ id: 'pet', x: 64, y: 0, width: 64, height: 64 }],
  });
  expect(await readPictureAtlas(folder)).toMatchObject({
    atlas: { pictures: [{ id: 'pet' }] },
  });

  // A list the Studio cannot read lists nothing: the image is a photo's.
  write({ artworkRegions: [{ ...pieces[0], x: 100 }] });
  expect(await readPictureAtlas(folder)).toMatchObject({
    atlas: { pictures: [{ id: 'picture' }] },
  });
});
