/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * @jest-environment node
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  readProject,
  writeProjectSource,
  writeStarterProject,
} from '../../../main/memberScenes/project';
import { SCENE_CONTRACT_VERSION } from '../../../common/sceneUniformContract';
import { webpBytes } from '../../utils/memberSceneFixtures';

const SOURCE = `vec4 sceneColour(vec2 uv) {
  return vec4(uAccent * texture(uSpectrumSlow, vec2(uv.x, 0.5)).r, 1.0);
}
`;

const manifest = (over: Record<string, unknown> = {}) => ({
  id: 'glow-test',
  version: 1,
  contract: SCENE_CONTRACT_VERSION,
  names: { en: 'Glow Test' },
  fallbackStyle: 'bars',
  swatch: ['#000000', '#00e5cf'],
  sourceFile: 'scene.frag',
  params: [],
  ...over,
});

let root: string;
let project: string;

const write = (name: string, contents: string | Buffer) =>
  fs.writeFileSync(path.join(project, name), contents);

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-studio-'));
  project = path.join(root, 'project');
  fs.mkdirSync(project);
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

const codes = async () => {
  const build = await readProject(project);
  return build.ok ? [] : build.problems.map((problem) => problem.code);
};

describe('reading a project folder', () => {
  // The control for every refusal below.
  it('builds a pack from pack.json and the shader it names', async () => {
    write('pack.json', JSON.stringify(manifest()));
    write('scene.frag', SOURCE);
    const build = await readProject(project);
    expect(build).toMatchObject({
      ok: true,
      pack: { id: 'glow-test', source: SOURCE, names: { en: 'Glow Test' } },
    });
  });

  // The Studio saves the author's wave into pack.json, and the pack built
  // from that folder is what is published: dropped here, a scene reached the
  // gallery standing in a different room from the one it was framed in, and
  // the Studio's own controls read back a pack that had never heard of it.
  it('carries the wave its pack.json names', async () => {
    write(
      'pack.json',
      JSON.stringify(manifest({ wave: { height: 0.4, position: 0.3 } })),
    );
    write('scene.frag', SOURCE);
    const build = await readProject(project);
    expect(build).toMatchObject({
      ok: true,
      pack: { wave: { height: 0.4, position: 0.3 } },
    });
  });

  it('says so when there is no pack.json', async () => {
    write('scene.frag', SOURCE);
    expect(await codes()).toEqual(['missing-file']);
  });

  it('says so when pack.json is not JSON', async () => {
    write('pack.json', '{ nope');
    expect(await codes()).toEqual(['bad-json']);
  });

  it('says so when the shader it names is missing', async () => {
    write('pack.json', JSON.stringify(manifest()));
    expect(await codes()).toEqual(['missing-file']);
  });

  it.each([['../outside.frag'], ['sub/scene.frag'], ['C:\\scene.frag']])(
    'refuses a shader path that leaves the folder: %s',
    async (sourceFile) => {
      fs.writeFileSync(path.join(root, 'outside.frag'), SOURCE);
      write('pack.json', JSON.stringify(manifest({ sourceFile })));
      expect(await codes()).toEqual(['unsafe-path']);
    },
  );

  it('refuses a name that is a link out of the folder', async () => {
    const outside = path.join(root, 'elsewhere');
    fs.mkdirSync(outside);
    // A junction needs no privilege on Windows and is a symlink elsewhere.
    fs.symlinkSync(outside, path.join(project, 'linked.frag'), 'junction');
    write('pack.json', JSON.stringify(manifest({ sourceFile: 'linked.frag' })));
    expect(await codes()).toEqual(['unsafe-path']);
  });

  it.each([
    ['a shader named as something else', { sourceFile: 'notes.txt' }],
    ['the manifest as its shader', { sourceFile: 'pack.json' }],
    ['a document as its artwork', { artworkFile: 'thesis.docx' }],
  ])('refuses %s', async (_label, over) => {
    // The Studio writes over both files, so a name is what may be replaced.
    write('pack.json', JSON.stringify(manifest(over)));
    write('scene.frag', SOURCE);
    write('notes.txt', 'mine');
    write('thesis.docx', 'mine');
    expect(await codes()).toEqual(['unsafe-path']);
  });

  describe('a world in a file of its own', () => {
    const WORLD = {
      materials: {
        glow: { kind: 'glow', colour: '#00e5cf', fragmentFile: 'glow.frag' },
      },
      nodes: [{ type: 'mesh', geometry: { kind: 'box' }, material: 'glow' }],
    };
    const GLOW =
      'void worldSurface(inout vec4 colour, inout vec3 emissive, WorldSurface s) {\n  emissive *= 1.0 + uLevel;\n}\n';

    beforeEach(() => {
      write('scene.frag', SOURCE);
      write('glow.frag', GLOW);
    });

    it('reads it, and the files it names, as though it were inline', async () => {
      write('world.json', JSON.stringify(WORLD));
      write('pack.json', JSON.stringify(manifest({ worldFile: 'world.json' })));
      const fromFile = await readProject(project);
      write('pack.json', JSON.stringify(manifest({ world: WORLD })));
      const inline = await readProject(project);

      expect(fromFile.ok && fromFile.pack.world?.materials.glow.fragment).toBe(
        GLOW,
      );
      expect(fromFile).toEqual(inline);
    });

    // Either choice would build a scene other than the one the author sees.
    it('refuses a manifest that names both', async () => {
      write('world.json', JSON.stringify(WORLD));
      write(
        'pack.json',
        JSON.stringify(manifest({ world: WORLD, worldFile: 'world.json' })),
      );
      expect(await codes()).toEqual(['bad-world']);
    });

    it.each([['../world.json'], ['world.txt'], ['pack.json.bak']])(
      'refuses a world file named %s',
      async (worldFile) => {
        fs.writeFileSync(path.join(root, 'world.json'), JSON.stringify(WORLD));
        write('pack.json', JSON.stringify(manifest({ worldFile })));
        expect(await codes()).toEqual(['unsafe-path']);
      },
    );

    it('refuses models past the world total before reading them', async () => {
      // Each file under the one-model limit, together past it: the second
      // is refused by its size, not read and cut down afterwards. A real
      // binary glTF each, its JSON padded out to five megabytes.
      const json = Buffer.alloc(5 * 1024 * 1024 - 20, ' ');
      json.write('{"asset":{"version":"2.0"}}');
      const half = Buffer.alloc(20 + json.length);
      half.write('glTF', 0, 'ascii');
      half.writeUInt32LE(2, 4);
      half.writeUInt32LE(half.length, 8);
      half.writeUInt32LE(json.length, 12);
      half.write('JSON', 16, 'ascii');
      json.copy(half, 20);
      write('a.glb', half);
      write('b.glb', half);
      write(
        'pack.json',
        JSON.stringify(
          manifest({
            world: {
              ...WORLD,
              models: { a: { file: 'a.glb' }, b: { file: 'b.glb' } },
            },
          }),
        ),
      );
      expect(await codes()).toEqual(['file-too-large']);
    });

    it('holds a model written inline to the test a model file meets', async () => {
      write(
        'pack.json',
        JSON.stringify(
          manifest({
            world: { ...WORLD, models: { ship: { data: 'AAAA' } } },
          }),
        ),
      );
      expect(await codes()).toEqual(['bad-model']);
    });

    it('says the world is wrong when its file is not JSON', async () => {
      write('world.json', '{ "nodes": [');
      write('pack.json', JSON.stringify(manifest({ worldFile: 'world.json' })));
      expect(await codes()).toEqual(['bad-world']);
    });
  });

  it('names what is wrong with its controls, and builds once they are whole', async () => {
    const control = (id: string, over: Record<string, unknown> = {}) => ({
      id,
      names: { en: id },
      min: 0,
      max: 1,
      value: 0.5,
      ...over,
    });
    write('scene.frag', SOURCE);
    const withParams = async (params: unknown) => {
      write('pack.json', JSON.stringify(manifest({ params })));
      return codes();
    };
    expect(await withParams([control('glow')])).toEqual([]);
    expect(await withParams([control('glow-amount')])).toEqual(['bad-param']);
    expect(await withParams([control('glow', { names: {} })])).toEqual([
      'bad-param',
    ]);
    expect(await withParams([control('glow', { min: 1, max: 1 })])).toEqual([
      'bad-param',
    ]);
    expect(await withParams([control('glow', { max: 1e9 })])).toEqual([
      'bad-param',
    ]);
    expect(await withParams([control('glow'), control('glow')])).toEqual([
      'bad-param',
    ]);
    expect(
      await withParams(
        Array.from({ length: 9 }, (_, index) => control(`c${index}`)),
      ),
    ).toEqual(['too-many-params']);
  });

  it('says when the window’s pictures reach outside the scene’s own artwork', async () => {
    write('scene.frag', SOURCE);
    write('artwork.webp', Buffer.from(webpBytes(256, 512, 256)));
    const withFrames = async (frames: unknown) => {
      write(
        'pack.json',
        JSON.stringify(
          manifest({
            artworkFile: 'artwork.webp',
            artworkWidth: 512,
            artworkHeight: 256,
            ambient: {
              elements: [
                {
                  id: 'birds',
                  shape: 'picture',
                  frames,
                  facing: 'right',
                  count: 3,
                  size: [30, 40],
                  motion: 'fly',
                  area: 'top',
                },
              ],
            },
          }),
        ),
      );
      const build = await readProject(project);
      return build.ok
        ? build.pack.ambient?.elements.map((element) => element.frames)
        : build.problems.map((problem) => problem.code);
    };
    expect(await withFrames([[0, 0, 128, 128]])).toEqual([[[0, 0, 128, 128]]]);
    expect(await withFrames([[448, 0, 128, 128]])).toEqual(['bad-ambient']);
  });

  it('writes the shader over itself, and never through a second name', async () => {
    write('pack.json', JSON.stringify(manifest()));
    write('scene.frag', SOURCE);
    expect(await writeProjectSource(project, `${SOURCE}// edited\n`)).toBe(
      'written',
    );
    expect(fs.readFileSync(path.join(project, 'scene.frag'), 'utf8')).toContain(
      '// edited',
    );
    // A hard link is the same file under a second name, in or out of the
    // folder: written through, it changed the file outside.
    const outside = path.join(root, 'outside.frag');
    fs.writeFileSync(outside, 'theirs');
    fs.rmSync(path.join(project, 'scene.frag'));
    fs.linkSync(outside, path.join(project, 'scene.frag'));
    expect(await writeProjectSource(project, SOURCE)).toBe('failed');
    expect(fs.readFileSync(outside, 'utf8')).toBe('theirs');
  });

  it('refuses a shader too large to read, before reading it', async () => {
    write('pack.json', JSON.stringify(manifest()));
    // Past MAX_MEMBER_SOURCE_BYTES, which is 256 KB since the 64 it used to
    // be was measured to buy nothing (see scenePacks.ts).
    write('scene.frag', `// ${'x'.repeat(260 * 1024)}\n${SOURCE}`);
    expect(await codes()).toEqual(['file-too-large']);
  });

  it('passes the member rules through, with the shader line', async () => {
    write('pack.json', JSON.stringify(manifest()));
    write('scene.frag', `${SOURCE}#define LATE 1\n`);
    const build = await readProject(project);
    expect(build).toMatchObject({
      ok: false,
      problems: [{ code: 'preprocessor', file: 'source', line: 4 }],
    });
  });

  it('reads artwork beside it and fingerprints it', async () => {
    write('pack.json', JSON.stringify(manifest({ artworkFile: 'art.webp' })));
    write('scene.frag', SOURCE);
    write('art.webp', Buffer.from('not really a webp'));
    const build = await readProject(project);
    // The bytes are not a WebP, so the artwork check refuses them — which
    // proves they were read and handed on rather than skipped.
    expect(build).toMatchObject({
      ok: false,
      problems: [{ code: 'bad-artwork', file: 'artwork' }],
    });
  });
});

describe('the starter project', () => {
  it('writes a scene that passes every rule', async () => {
    expect(
      await writeStarterProject(project, {
        name: 'My First Scene',
        id: 'my-first-scene',
      }),
    ).toBe('written');
    const build = await readProject(project);
    expect(build.ok).toBe(true);
    // The AI prompt tells an AI the starter from a member's own scene by
    // this first line.
    expect(fs.readFileSync(path.join(project, 'scene.frag'), 'utf8')).toMatch(
      /^\/\/ My first FluidEQ scene/,
    );
  });

  it('never writes over a project that is already there', async () => {
    write('pack.json', '{"mine": true}');
    expect(
      await writeStarterProject(project, {
        name: 'My First Scene',
        id: 'my-first-scene',
      }),
    ).toBe('exists');
    expect(fs.readFileSync(path.join(project, 'pack.json'), 'utf8')).toBe(
      '{"mine": true}',
    );
  });
});
