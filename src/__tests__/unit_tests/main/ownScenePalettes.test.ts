/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A maker's own scene keeps its palette, its single colour and its choice
 * through the looks (Ivan, 2026-11-11: his own scenes with a palette fell to
 * a standard look on the graph, "'uPalette_colours' : undeclared
 * identifier", while the Studio and the gallery's preview played them). The
 * copy in the looks was written in the built layout, which no reader reads
 * those three from (`storedFormOf`).
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  checkMemberScene,
  readMemberScene,
} from '../../../common/memberScenes';
import {
  normalizeScenePack,
  parseScenePackPayload,
  type IScenePack,
} from '../../../common/scenePacks';
import { MAX_SCENE_PALETTES } from '../../../common/scenePalette';
import storedScenePack, { storedFormOf } from '../../../common/sceneStoredPack';
import {
  colourUniformDeclarations,
  paletteUniformDeclarations,
} from '../../../common/sceneUniformContract';
import {
  createMemberSceneStore,
  keptRevisionOf,
} from '../../../main/memberScenes/store';
import { writeSceneCache } from '../../../main/sceneCacheFile';
import { ME, memberPack } from '../../utils/memberSceneFixtures';

jest.mock('electron', () => ({
  safeStorage: jest.requireActual('../../utils/sceneStorageCipher')
    .sceneStorageCipher,
}));

/** The scene as its project's pack.json holds it: every control in params. */
const project = {
  ...memberPack({
    id: 'waveform-3d',
    contract: 9,
    source:
      'vec4 sceneColour(vec2 uv) {\n  vec3 tint = texture(uPalette_colours, vec2(uv.x, 0.5)).rgb;\n  return vec4(tint * uParam_gloss, 1.0);\n}\n',
  }),
  params: [
    { id: 'gloss', names: { en: 'Gloss' }, min: 0, max: 1, value: 0.85 },
    {
      type: 'choice',
      id: 'style',
      names: { en: 'Colour mode' },
      min: 0,
      max: 1,
      value: 1,
      options: [{ names: { en: 'One colour' } }, { names: { en: 'Palette' } }],
    },
    {
      type: 'palette',
      id: 'colours',
      names: { en: 'Colours' },
      stops: ['#46327e', '#277f8e', '#4ac16d'],
    },
    { type: 'colour', id: 'single', names: { en: 'Colour' }, value: '#00b3a4' },
  ],
};

/** What the Studio builds from the project, and hands to the looks. */
const built = (): IScenePack => {
  const checked = checkMemberScene(project);
  if (!checked.ok) {
    throw new Error(`fixture refused: ${JSON.stringify(checked.problems)}`);
  }
  return checked.pack;
};

/** Everything the graph needs declared to build the scene's shader. */
const expectWhole = (pack: IScenePack | undefined) => {
  expect(pack).toBeDefined();
  if (!pack) {
    return;
  }
  expect(paletteUniformDeclarations(pack)).toContain(
    'uniform sampler2D uPalette_colours;',
  );
  expect(colourUniformDeclarations(pack)).toContain('single');
  expect(pack.palettes?.[0].stops).toEqual(['#46327e', '#277f8e', '#4ac16d']);
  expect(pack.colours?.[0].value).toBe('#00b3a4');
  expect(pack.params.map((param) => param.id)).toEqual(['gloss', 'style']);
  expect(pack.params[1].options).toHaveLength(2);
};

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'own-palettes-'));
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

it('the fixture is a scene with a palette, a colour and a choice', () => {
  expectWhole(built());
});

it('a palette scene added to the looks from the Studio reads back with uPalette_colours declared', () => {
  const store = createMemberSceneStore({ userDataDir: root });
  store.save(ME, built());
  expectWhole(store.load(ME, 'waveform-3d'));
  expectWhole(store.newest(ME, 'waveform-3d'));
});

it('a palette scene kept at publication reads back whole, after a restart too', () => {
  // `keepPublished` hands the store the pack that went out, built.
  createMemberSceneStore({ userDataDir: root }).save(ME, built());
  const afterRestart = createMemberSceneStore({ userDataDir: root });
  expectWhole(afterRestart.load(ME, 'waveform-3d'));
  // Saved again from what was read back, as an update does: still whole.
  const again = afterRestart.load(ME, 'waveform-3d');
  if (again) {
    afterRestart.save(ME, again);
  }
  expectWhole(afterRestart.load(ME, 'waveform-3d'));
});

it('a copy already written in the built layout heals when it is read', () => {
  // Exactly what 2.4.0 wrote: the built pack, palettes apart from params.
  const store = createMemberSceneStore({ userDataDir: root });
  store.save(ME, memberPack({ id: 'waveform-3d' }));
  const [file] = fs
    .readdirSync(path.join(root, 'member-scenes', 'own', ME))
    .map((name) => path.join(root, 'member-scenes', 'own', ME, name));
  writeSceneCache(file, `own/${ME}/waveform-3d`, {
    schema: 1,
    authorId: ME,
    savedAt: new Date().toISOString(),
    pack: built(),
  });
  expectWhole(
    createMemberSceneStore({ userDataDir: root }).load(ME, 'waveform-3d'),
  );
});

it('every reader takes the built layout for what it is, and the rules still hold it', () => {
  const pack = built();
  expectWhole(normalizeScenePack(pack) ?? undefined);
  expectWhole(
    normalizeScenePack(JSON.parse(JSON.stringify(pack))) ?? undefined,
  );
  expectWhole(readMemberScene(JSON.parse(JSON.stringify(pack))));
  // As a project is compared with its publication (`publishedAdoption.ts`).
  expectWhole(parseScenePackPayload(JSON.stringify(pack)) ?? undefined);
  const checked = checkMemberScene(pack);
  expect(checked.ok).toBe(true);
  expectWhole(checked.ok ? checked.pack : undefined);
  // A built pack is no way round the limits: forty palettes are held to
  // the two a scene may have, exactly as the stored layout is.
  const forty = Array.from({ length: 40 }, (_, at) => ({
    ...pack.palettes?.[0],
    id: `colours${at}`,
  }));
  const fromBuilt = normalizeScenePack({ ...pack, palettes: forty });
  const fromStored = normalizeScenePack({
    ...project,
    params: forty.map((palette) => ({ type: 'palette', ...palette })),
  });
  expect(fromBuilt?.palettes).toHaveLength(MAX_SCENE_PALETTES);
  expect(fromStored?.palettes).toHaveLength(MAX_SCENE_PALETTES);
  // The revision a kept copy is known by is the one read back from disk.
  expect(keptRevisionOf(pack)).toBeDefined();
});

it('the stored layout comes back as it was given, and round-trips', () => {
  expect(storedFormOf(project)).toBe(project);
  expect(storedFormOf(storedScenePack(built()))).toEqual(
    storedScenePack(built()),
  );
  expect(
    storedScenePack(normalizeScenePack(storedFormOf(built())) ?? built()),
  ).toEqual(storedScenePack(built()));
  // The control: a scene with sliders alone is untouched by any of it.
  const plain = memberPack();
  expect(storedFormOf(plain)).toBe(plain);
});
