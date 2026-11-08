/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * @jest-environment node
 */

/**
 * A scene published before this computer kept records is marked all the
 * same (Ivan, 2026-11-08: "it needs to show always if the current version on
 * the studio matches the lib one"): a project whose version and scene are a
 * held copy's is recorded as published; one edited since, or at another
 * version, is not - each beside the same folder that does match.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import type { IScenePack } from '../../../common/scenePacks';
import { createPublishedAdoption } from '../../../main/memberScenes/publishedAdoption';
import { createPublishedRecords } from '../../../main/memberScenes/publishedRecords';

const pack = (
  version: number,
  source = 'vec4 sceneColour(vec2 uv) { return vec4(1.0); }',
): IScenePack => ({
  schema: 1,
  id: 'lake',
  version,
  contract: 1,
  names: { en: 'Lake' },
  fallbackStyle: 'skyline',
  swatch: ['#050a1a', '#00e5cf'],
  source,
  params: [],
});

let root: string;
let folder: string;
let userData: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'published-adoption-'));
  folder = path.join(root, 'Lake');
  userData = path.join(root, 'user');
  fs.mkdirSync(folder);
  fs.mkdirSync(userData);
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

/** The folder's `pack.json`, naming `version`. */
const project = (version: number) => {
  fs.writeFileSync(
    path.join(folder, 'pack.json'),
    JSON.stringify({ id: 'lake', version }),
  );
};

const setUp = (held: IScenePack | undefined, onDisk: IScenePack) => {
  const records = createPublishedRecords(userData);
  const readPack = jest.fn(async () => onDisk);
  const adoption = createPublishedAdoption({
    records,
    heldOf: (_id, version) => (held && held.version === version ? [held] : []),
    differsFile: path.join(userData, 'checked.json'),
    readPack,
  });
  return { records, readPack, adoption };
};

it('reads an edited scene once across launches, and again once it changes', async () => {
  project(5);
  const edited = pack(5, 'vec4 sceneColour(vec2 uv) { return vec4(0.5); }');
  const first = setUp(pack(5), edited);
  expect(await first.adoption.adopt([folder])).toBe(false);
  expect(first.readPack).toHaveBeenCalledTimes(1);
  // The next FluidEQ remembers it was compared.
  const next = setUp(pack(5), pack(5));
  expect(await next.adoption.adopt([folder])).toBe(false);
  expect(next.readPack).not.toHaveBeenCalled();
  // Put back as published (here: saved again), it is compared and recorded.
  const later = new Date(Date.now() + 2000);
  fs.utimesSync(path.join(folder, 'pack.json'), later, later);
  expect(await next.adoption.adopt([folder])).toBe(true);
});

it('records a project holding the published version, as published', async () => {
  project(5);
  const { records, adoption } = setUp(pack(5), pack(5));
  expect(await records.stateOf(folder)).toBeUndefined();
  expect(await adoption.adopt([folder])).toBe(true);
  expect(await records.stateOf(folder)).toEqual({
    sceneId: 'lake',
    version: 5,
    unchanged: true,
  });
});

it('compares scenes as signing does: a comment is not a change', async () => {
  project(5);
  const { records, adoption } = setUp(
    pack(5),
    pack(5, '// tuned\nvec4 sceneColour(vec2 uv) { return vec4(1.0); }'),
  );
  expect(await adoption.adopt([folder])).toBe(true);
  expect((await records.stateOf(folder))?.unchanged).toBe(true);
});

it('leaves a project edited since its version went out, and reads it once', async () => {
  project(5);
  const { records, readPack, adoption } = setUp(
    pack(5),
    pack(5, 'vec4 sceneColour(vec2 uv) { return vec4(0.5); }'),
  );
  expect(await adoption.adopt([folder])).toBe(false);
  expect(await records.stateOf(folder)).toBeUndefined();
  // Unchanged since it was compared: not read again.
  expect(await adoption.adopt([folder])).toBe(false);
  expect(readPack).toHaveBeenCalledTimes(1);
});

it('reads nothing for a project at a version no held copy has', async () => {
  project(6);
  const { records, readPack, adoption } = setUp(pack(5), pack(6));
  expect(await adoption.adopt([folder])).toBe(false);
  expect(readPack).not.toHaveBeenCalled();
  expect(await records.stateOf(folder)).toBeUndefined();
});

it('leaves alone a project already recorded as it stands', async () => {
  project(5);
  const { records, readPack, adoption } = setUp(pack(5), pack(5));
  records.record(folder, 'lake', 5);
  expect(await adoption.adopt([folder])).toBe(false);
  expect(readPack).not.toHaveBeenCalled();
});
