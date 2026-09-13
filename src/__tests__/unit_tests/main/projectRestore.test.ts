/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * @jest-environment node
 */

import { createHash } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { MAX_MEMBER_NAME_LENGTH } from '../../../common/memberScenes';
import type { IScenePack } from '../../../common/scenePacks';
import { readProject } from '../../../main/memberScenes/project';
import {
  folderHoldingScene,
  RESTORED_ARTWORK_FILE,
  RESTORED_SOURCE_FILE,
  writeRestoredProject,
} from '../../../main/memberScenes/projectRestore';
import { memberPack } from '../../utils/memberSceneFixtures';

/**
 * A member's own exported scene, written back out as a Studio project. What
 * holds it together is that a build of the folder is the pack that came in:
 * anything the manifest dropped or renamed would still build, as a different
 * scene, and nothing on screen would say so.
 */

/**
 * The smallest WebP the pack checks accept: a lossless header naming its own
 * size. The checks read the container, never decode it, so no pixels follow.
 */
const webp = (width: number, height: number) => {
  const bytes = Buffer.alloc(30);
  bytes.write('RIFF', 0, 'ascii');
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write('WEBP', 8, 'ascii');
  bytes.write('VP8L', 12, 'ascii');
  bytes.writeUInt32LE(bytes.length - 20, 16);
  bytes[20] = 0x2f;
  bytes.writeUInt32LE(width - 1 + (height - 1) * 16384, 21);
  return bytes;
};

const PICTURE = webp(4, 2);

/** A pack using every part the manifest has to carry. */
const fullPack = (): IScenePack =>
  memberPack({
    version: 3,
    names: { en: 'Neon City', es: 'Ciudad de neón' },
    swatch: ['#050a1a', '#00e5cf', '#ff3d7f'],
    params: [
      {
        id: 'glow',
        names: { en: 'Glow', es: 'Brillo' },
        min: 0,
        max: 2,
        value: 0.75,
      },
    ],
    artwork: {
      mime: 'image/webp',
      width: 4,
      height: 2,
      data: PICTURE.toString('base64'),
    },
    spectrumRange: [0.1, 0.85],
    response: { sensitivity: 1.5, threshold: 0.1, attack: 40, release: 600 },
  });

let root: string;
let projects: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-restore-'));
  // Not made yet: the first restore on a new computer makes it.
  projects = path.join(root, 'FluidEQ Studio');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(root, { recursive: true, force: true });
});

const restored = async (name: string, pack: IScenePack) => {
  const made = await writeRestoredProject(projects, name, pack);
  if (!made.ok) {
    throw new Error(`restoring "${name}" was refused: ${made.reason}`);
  }
  return made.folder;
};

describe('restoring an own scene as a project', () => {
  it('writes a folder whose build is the pack that came in', async () => {
    const pack = fullPack();
    const folder = await restored('Neon City', pack);

    expect(path.dirname(folder)).toBe(projects);
    expect(path.basename(folder)).toBe('Neon City');
    expect(fs.readdirSync(folder).sort()).toEqual(
      [RESTORED_ARTWORK_FILE, 'pack.json', RESTORED_SOURCE_FILE].sort(),
    );
    // The picture comes back byte for byte, not re-encoded.
    expect(fs.readFileSync(path.join(folder, RESTORED_ARTWORK_FILE))).toEqual(
      PICTURE,
    );

    expect(await readProject(folder)).toEqual({
      ok: true,
      pack,
      artworkHash: createHash('sha256').update(PICTURE).digest('hex'),
    });
  });

  // The control: the comparison above can tell a different scene apart, so
  // its passing is the manifest carrying the value, not the check being blind.
  it('builds a different pack when a value in it is different', async () => {
    const pack = fullPack();
    const changed: IScenePack = {
      ...pack,
      params: [{ ...pack.params[0], value: 1.25 }],
    };
    const artworkHash = createHash('sha256').update(PICTURE).digest('hex');
    const folder = await restored('Neon City', changed);
    const build = await readProject(folder);
    expect(build).toEqual({ ok: true, pack: changed, artworkHash });
    expect(build).not.toEqual({ ok: true, pack, artworkHash });
  });

  it('writes no picture and no picture fields for a scene without one', async () => {
    const pack = memberPack();
    const folder = await restored('Neon City', pack);

    expect(fs.readdirSync(folder).sort()).toEqual(
      ['pack.json', RESTORED_SOURCE_FILE].sort(),
    );
    const manifest = JSON.parse(
      fs.readFileSync(path.join(folder, 'pack.json'), 'utf8'),
    );
    expect(manifest).not.toHaveProperty('artworkFile');
    expect(manifest).not.toHaveProperty('spectrumRange');
    expect(manifest).not.toHaveProperty('response');
    expect(await readProject(folder)).toEqual({ ok: true, pack });
  });
});

describe('where a restored project goes', () => {
  it('names a second copy "<Name> 2" and leaves the first alone', async () => {
    const first = await restored('Neon City', fullPack());
    const manifestBefore = fs.readFileSync(path.join(first, 'pack.json'));

    const second = await restored('Neon City', memberPack());
    expect(path.basename(second)).toBe('Neon City 2');
    expect(await restored('Neon City', memberPack())).toBe(
      path.join(projects, 'Neon City 3'),
    );
    expect(fs.readFileSync(path.join(first, 'pack.json'))).toEqual(
      manifestBefore,
    );
    expect(fs.readdirSync(first)).toContain(RESTORED_ARTWORK_FILE);
  });

  // However a folder came to share the name, it is somebody's, and a restore
  // writing into it could replace their work.
  it('never writes into a folder that already has the name', async () => {
    const theirs = path.join(projects, 'Neon City');
    fs.mkdirSync(theirs, { recursive: true });
    fs.writeFileSync(path.join(theirs, 'scene.frag'), 'their own work');

    const folder = await restored('Neon City', memberPack());
    expect(path.basename(folder)).toBe('Neon City 2');
    expect(fs.readdirSync(theirs)).toEqual(['scene.frag']);
    expect(fs.readFileSync(path.join(theirs, 'scene.frag'), 'utf8')).toBe(
      'their own work',
    );
  });

  // A name at the limit has to give up its end for the number, and a cut
  // landing on a space must not leave two spaces before it.
  it('keeps a numbered name at a long name’s limit', async () => {
    const name = 'Northern lights over a very quiet sea by';
    expect(name).toHaveLength(MAX_MEMBER_NAME_LENGTH);
    await restored(name, memberPack());
    const second = path.basename(await restored(name, memberPack()));
    expect(second).toBe('Northern lights over a very quiet sea 2');
    expect(second.length).toBeLessThanOrEqual(MAX_MEMBER_NAME_LENGTH);
  });

  it.each([['..'], ['con'], ['LPT1.txt'], ['???'], ['   ']])(
    'refuses %j as a name and makes nothing',
    async (name) => {
      expect(await writeRestoredProject(projects, name, memberPack())).toEqual({
        ok: false,
        reason: 'invalid',
      });
      expect(fs.existsSync(projects)).toBe(false);
      expect(fs.readdirSync(root)).toEqual([]);
    },
  );

  it('gives up once every numbered name is taken', async () => {
    fs.mkdirSync(path.join(projects, 'Neon City'), { recursive: true });
    for (let suffix = 2; suffix <= 99; suffix += 1) {
      fs.mkdirSync(path.join(projects, `Neon City ${suffix}`));
    }
    expect(
      await writeRestoredProject(projects, 'Neon City', memberPack()),
    ).toEqual({ ok: false, reason: 'taken' });
    expect(fs.readdirSync(projects)).toHaveLength(99);
  });
});

describe('an interrupted restore', () => {
  it('writes the manifest after everything it names', async () => {
    const { writeFile } = fs.promises;
    const written: string[] = [];
    jest
      .spyOn(fs.promises, 'writeFile')
      .mockImplementation(async (file, data, options) => {
        written.push(path.basename(String(file)));
        return writeFile(file, data, options);
      });
    await restored('Neon City', fullPack());
    expect(written).toEqual([
      RESTORED_SOURCE_FILE,
      RESTORED_ARTWORK_FILE,
      'pack.json',
    ]);
  });

  // A folder without pack.json is not a project yet: a restore stopped half
  // way must never pass for a finished one, nor be taken for the scene.
  it('leaves no manifest, and no project, when a write fails', async () => {
    const { writeFile } = fs.promises;
    jest
      .spyOn(fs.promises, 'writeFile')
      .mockImplementation(async (file, data, options) => {
        if (path.basename(String(file)) === RESTORED_ARTWORK_FILE) {
          throw Object.assign(new Error('disk full'), { code: 'ENOSPC' });
        }
        return writeFile(file, data, options);
      });

    await expect(
      writeRestoredProject(projects, 'Neon City', fullPack()),
    ).rejects.toThrow('disk full');

    const folder = path.join(projects, 'Neon City');
    expect(fs.readdirSync(folder)).toEqual([RESTORED_SOURCE_FILE]);
    expect(await readProject(folder)).toEqual({
      ok: false,
      problems: [{ code: 'missing-file', file: 'pack.json' }],
    });
    expect(await folderHoldingScene([folder], 'neon-city')).toBeUndefined();
  });
});

describe('finding the project that holds a scene', () => {
  it('finds a folder by the id its own pack.json gives', async () => {
    const aurora = await restored('Aurora', memberPack({ id: 'aurora' }));
    const neon = await restored('Neon City', memberPack());
    expect(await folderHoldingScene([aurora, neon], 'neon-city')).toBe(neon);
    expect(await folderHoldingScene([aurora, neon], 'aurora')).toBe(aurora);
    expect(await folderHoldingScene([aurora, neon], 'lake')).toBeUndefined();
    expect(await folderHoldingScene([], 'neon-city')).toBeUndefined();
  });

  // Folders on the list can be gone, emptied or broken by hand; each holds
  // nothing, and none of them may hide the one that does hold the scene.
  it('passes over folders that cannot be read', async () => {
    const gone = path.join(root, 'gone');
    const empty = path.join(root, 'empty');
    fs.mkdirSync(empty);
    const broken = path.join(root, 'broken');
    fs.mkdirSync(broken);
    fs.writeFileSync(path.join(broken, 'pack.json'), '{ "id": "neon-');
    const neon = await restored('Neon City', memberPack());

    expect(
      await folderHoldingScene([gone, empty, broken, neon], 'neon-city'),
    ).toBe(neon);
    expect(
      await folderHoldingScene([gone, empty, broken], 'neon-city'),
    ).toBeUndefined();
  });
});
