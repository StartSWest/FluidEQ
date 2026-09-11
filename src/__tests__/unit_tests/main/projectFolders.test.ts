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
import { readProject } from '../../../main/memberScenes/project';
import {
  createProjectFolder,
  folderNameFor,
  sceneIdFor,
} from '../../../main/memberScenes/projectFolders';

let base: string;
let root: string;

beforeEach(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-projects-'));
  // Not made yet: the first project makes the projects folder too.
  root = path.join(base, 'FluidEQ Studio');
});

afterEach(() => {
  fs.rmSync(base, { recursive: true, force: true });
});

describe('a new project’s folder name', () => {
  // The control: an ordinary name is kept as it was typed.
  it('keeps an ordinary name, accents and all', () => {
    expect(folderNameFor('Auroras boreales')).toBe('Auroras boreales');
    expect(folderNameFor('  Café   Nocturno ')).toBe('Café Nocturno');
    expect(folderNameFor('北极光')).toBe('北极光');
  });

  it('can never climb out of the projects folder or name two of them', () => {
    expect(folderNameFor('../../Windows')).toBe('Windows');
    expect(folderNameFor('a/b\\c')).toBe('a b c');
    expect(folderNameFor('..')).toBeUndefined();
    expect(folderNameFor('.')).toBeUndefined();
    expect(folderNameFor('C:\\Users')).toBe('C Users');
  });

  it('refuses what Windows will not make, and drops what it would drop', () => {
    expect(folderNameFor('con')).toBeUndefined();
    expect(folderNameFor('LPT1.txt')).toBeUndefined();
    expect(folderNameFor('Neon city...')).toBe('Neon city');
    expect(folderNameFor('What? <A> "scene" |*|')).toBe('What A scene');
    expect(folderNameFor('\u0000\u001f')).toBeUndefined();
    expect(folderNameFor('   ')).toBeUndefined();
  });

  it('is never longer than a scene name', () => {
    expect(folderNameFor('x'.repeat(90))).toHaveLength(40);
  });
});

describe('a new project’s pack id', () => {
  it('is the name in the letters a pack id allows', () => {
    expect(sceneIdFor('Auroras Boreales')).toBe('auroras-boreales');
    expect(sceneIdFor('Café — Nocturno!')).toBe('cafe-nocturno');
    expect(sceneIdFor('3D Road Trip')).toBe('d-road-trip');
  });

  it('still works for a name with none of those letters', () => {
    expect(sceneIdFor('北极光')).toBe('my-scene');
    expect(sceneIdFor('42')).toBe('my-scene');
  });

  it('is never longer than a pack id may be', () => {
    expect(sceneIdFor('scene '.repeat(20)).length).toBeLessThanOrEqual(48);
  });
});

describe('making a new project', () => {
  it('makes the projects folder, the project in it, and a scene named for it', async () => {
    const made = await createProjectFolder(root, 'Northern Lights');
    expect(made).toEqual({
      ok: true,
      folder: path.join(root, 'Northern Lights'),
    });
    const build = await readProject(path.join(root, 'Northern Lights'));
    expect(build.ok && build.pack.names.en).toBe('Northern Lights');
    expect(build.ok && build.pack.id).toBe('northern-lights');
  });

  it('never touches a folder that is already there', async () => {
    fs.mkdirSync(path.join(root, 'Mine'), { recursive: true });
    fs.writeFileSync(path.join(root, 'Mine', 'notes.txt'), 'keep me');
    expect(await createProjectFolder(root, 'Mine')).toEqual({
      ok: false,
      reason: 'exists',
    });
    expect(fs.readdirSync(path.join(root, 'Mine'))).toEqual(['notes.txt']);
  });

  it('refuses a name with nothing usable in it, and makes nothing', async () => {
    expect(await createProjectFolder(root, '..')).toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(fs.existsSync(root)).toBe(false);
  });
});
