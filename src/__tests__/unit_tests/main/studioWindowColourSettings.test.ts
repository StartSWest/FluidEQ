/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * @jest-environment node
 */

/**
 * The colours a scene lends the window, as the member tunes them on the Tune
 * tab, are written into its own `pack.json` (Ivan, 2026-11-14: "implement
 * that", the tuning mockup), so they are what the scene publishes with.
 * Taking them out leaves the window to the colours its palette gives, and
 * nothing else in the file is touched on the way.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { writeProjectSettings } from '../../../main/memberScenes/projectSettings';

let folder: string;

const manifest = () =>
  JSON.parse(fs.readFileSync(path.join(folder, 'pack.json'), 'utf8'));

const NAMED = { surface: '#1d2b4f', accent: '#5fd4ff', glow: '#7dffb0' };

beforeEach(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-window-colours-'));
  fs.writeFileSync(
    path.join(folder, 'pack.json'),
    JSON.stringify(
      {
        schema: 1,
        id: 'neon-city',
        version: 3,
        contract: 9,
        names: { en: 'Neon City' },
        swatch: ['#112233', '#445566'],
        sourceFile: 'scene.frag',
        windowColours: {
          surface: '#0a0c22',
          accent: '#ff5c9d',
          glow: '#9fe6ff',
        },
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

it('writes the colours the member chose, and nothing else changes', async () => {
  expect(await writeProjectSettings(folder, { windowColours: NAMED })).toBe(
    'written',
  );
  expect(manifest().windowColours).toEqual(NAMED);
  expect(manifest().params[0].value).toBe(0.5);
  expect(manifest().id).toBe('neon-city');
});

it('takes them out for null, leaving the window to the palette', async () => {
  expect(await writeProjectSettings(folder, { windowColours: null })).toBe(
    'written',
  );
  expect(manifest()).not.toHaveProperty('windowColours');
});

it('keeps the scene’s colours when the set sent is not three colours', async () => {
  const before = manifest().windowColours;
  expect(before).toBeDefined();
  await writeProjectSettings(folder, {
    windowColours: { surface: '#1d2b4f', accent: 'blue', glow: '#7dffb0' },
  });
  expect(manifest().windowColours).toEqual(before);
});
