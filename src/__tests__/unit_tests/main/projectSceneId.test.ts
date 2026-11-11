/** @jest-environment node */
/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * A Studio project's scene id comes from its own `pack.json`, so the review's
 * warning finds the scene on every computer the folder is on — a
 * publication's record is only kept on the one that published it (Ivan's
 * other PC, 2026-11-11).
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { studioStateOf } from 'main/ipc/studioProjectTypes';
import { readProjectSceneId } from 'main/memberScenes/project';

let folder: string;
const write = (manifest: unknown) =>
  fs.promises.writeFile(
    path.join(folder, 'pack.json'),
    JSON.stringify(manifest),
  );

beforeEach(async () => {
  folder = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), 'fluideq-scene-id-'),
  );
});
afterEach(async () => {
  await fs.promises.rm(path.join(folder, 'pack.json'), { force: true });
  await fs.promises.rmdir(folder);
});

it('reads the scene id its pack.json names, and nothing that is not one', async () => {
  await write({ id: 'neon-city', names: { en: 'Neon City' } });
  expect(await readProjectSceneId(folder)).toBe('neon-city');
  await write({ id: '../outside', names: { en: 'Neon City' } });
  expect(await readProjectSceneId(folder)).toBeUndefined();
  await write({ names: { en: 'Neon City' } });
  expect(await readProjectSceneId(folder)).toBeUndefined();
  await fs.promises.rm(path.join(folder, 'pack.json'));
  expect(await readProjectSceneId(folder)).toBeUndefined();
});

it('hands each project its scene id, and none it could not read', () => {
  const state = studioStateOf(
    {
      projects: [
        { id: 'a', folder: 'D:/Scenes/Neon', openedAt: 2 },
        { id: 'b', folder: 'D:/Scenes/Lake', openedAt: 1 },
      ],
    },
    {
      mayAddProject: true,
      projectsRoot: 'D:/Scenes',
      names: new Map(),
      sceneIds: new Map([['a', 'neon-city']]),
      usable: () => true,
    },
  );
  expect(
    Object.fromEntries(state.projects.map((p) => [p.id, p.sceneId])),
  ).toEqual({ a: 'neon-city', b: undefined });
});
