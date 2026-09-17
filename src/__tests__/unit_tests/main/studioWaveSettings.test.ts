/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * @jest-environment node
 */

/**
 * Where the scene wants the wave is written into its own `pack.json`, so it
 * travels with the scene to a look, an export and the gallery.
 *
 * The wave was only ever tried in the Studio: the author built a scene around
 * a band and the listener saw it under whatever their graph was left on. What
 * is held here is that a member's choice reaches the file, that asking for the
 * graph's own default takes the field out again rather than pinning anyone to
 * it, and that nothing else in the file is touched on the way.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { writeProjectSettings } from '../../../main/memberScenes/projectSettings';

let folder: string;

const manifest = () =>
  JSON.parse(fs.readFileSync(path.join(folder, 'pack.json'), 'utf8'));

beforeEach(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-wave-'));
  fs.writeFileSync(
    path.join(folder, 'pack.json'),
    JSON.stringify(
      {
        schema: 1,
        id: 'neon-city',
        version: 3,
        contract: 4,
        names: { en: 'Neon City' },
        fallbackStyle: 'bars',
        swatch: ['#112233', '#445566'],
        sourceFile: 'scene.frag',
        params: [
          { id: 'glow', names: { en: 'Glow' }, min: 0, max: 1, value: 0.5 },
        ],
      },
      null,
      2,
    ),
  );
});

afterEach(() => fs.rmSync(folder, { recursive: true, force: true }));

it('writes the wave the scene was built around', async () => {
  expect(
    await writeProjectSettings(folder, {
      wave: { height: 0.4, position: 0.25 },
    }),
  ).toBe('written');
  expect(manifest().wave).toEqual({ height: 0.4, position: 0.25 });
  // Everything else in the file is the author's and is written back as read.
  expect(manifest().params[0].value).toBe(0.5);
  expect(manifest().id).toBe('neon-city');
});

it('takes the wave out again when the scene asks for the graph’s own', async () => {
  await writeProjectSettings(folder, { wave: { height: 0.4, position: 0.25 } });
  // The full height on the bottom is what a graph does anyway: a scene that
  // wants that wants nothing, and says nothing about it.
  expect(
    await writeProjectSettings(folder, { wave: { height: 1, position: 0 } }),
  ).toBe('written');
  expect(manifest().wave).toBeUndefined();

  await writeProjectSettings(folder, { wave: { height: 0.4, position: 0.25 } });
  expect(await writeProjectSettings(folder, { wave: null })).toBe('written');
  expect(manifest().wave).toBeUndefined();
});

it('keeps a wave inside the ends the sliders have', async () => {
  await writeProjectSettings(folder, {
    wave: { height: 9, position: 0.5 },
  });
  expect(manifest().wave).toEqual({ height: 1, position: 0.5 });
  await writeProjectSettings(folder, {
    wave: { height: 0.001, position: 5 },
  });
  expect(manifest().wave).toEqual({ height: 0.05, position: 1 });
  // And one that lands on the graph's own after clamping asks for nothing.
  await writeProjectSettings(folder, { wave: { height: 9, position: -4 } });
  expect(manifest().wave).toBeUndefined();
});

it('leaves the file alone when nothing about the wave changed', async () => {
  await writeProjectSettings(folder, { wave: { height: 0.4, position: 0.25 } });
  expect(
    await writeProjectSettings(folder, {
      wave: { height: 0.4, position: 0.25 },
    }),
  ).toBe('unchanged');
});
