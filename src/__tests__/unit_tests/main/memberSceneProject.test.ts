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
  writeStarterProject,
} from '../../../main/memberScenes/project';
import { SCENE_CONTRACT_VERSION } from '../../../common/sceneUniformContract';

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
    fs.symlinkSync(outside, path.join(project, 'linked'), 'junction');
    write('pack.json', JSON.stringify(manifest({ sourceFile: 'linked' })));
    expect(await codes()).toEqual(['unsafe-path']);
  });

  it('refuses a shader too large to read, before reading it', async () => {
    write('pack.json', JSON.stringify(manifest()));
    write('scene.frag', `// ${'x'.repeat(70 * 1024)}\n${SOURCE}`);
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
    expect(await writeStarterProject(project)).toBe('written');
    const build = await readProject(project);
    expect(build.ok).toBe(true);
  });

  it('never writes over a project that is already there', async () => {
    write('pack.json', '{"mine": true}');
    expect(await writeStarterProject(project)).toBe('exists');
    expect(fs.readFileSync(path.join(project, 'pack.json'), 'utf8')).toBe(
      '{"mine": true}',
    );
  });
});
