/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  deletePreset,
  doesPresetExist,
  fetchPreset,
  renamePreset,
  savePreset,
} from '../../../main/flush';
import { IPresetV2 } from '../../../common/constants';

const preset = (): IPresetV2 => ({ preAmp: -3, filters: {} });

/**
 * A profile name arrives as `arg[0]` on four IPC channels and is used as a
 * filename. The karaoke drafts answered this by hashing the id so the caller
 * never picks the filename at all; profiles have to stay readable on disk, so
 * they answer it by refusing anything that is not a plain file name.
 *
 * The escape tried here is the one that matters: `..` segments walking out of
 * the profiles directory and into somewhere the user keeps real files.
 */
describe('profile names as file paths', () => {
  let root: string;
  let presetsDir: string;
  let outside: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-presets-'));
    presetsDir = path.join(root, 'presets');
    fs.mkdirSync(presetsDir);
    // The file an escape would be reaching for: a sibling of the directory the
    // names are supposed to be confined to.
    outside = path.join(root, 'do-not-touch.txt');
    fs.writeFileSync(outside, 'still here', { encoding: 'utf8' });
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  const escapes = [
    '../do-not-touch.txt',
    '..\\do-not-touch.txt',
    '../../do-not-touch.txt',
    '..',
    '.',
    'nested/name',
    'nested\\name',
  ];

  it('refuses to save through a name that leaves the directory', () => {
    escapes.forEach((name) => {
      expect(() => savePreset(name, preset(), presetsDir)).toThrow();
    });
    expect(fs.readFileSync(outside, 'utf8')).toBe('still here');
    expect(fs.readdirSync(presetsDir)).toHaveLength(0);
  });

  it('refuses to delete through one, which is the worst of them', () => {
    // `fs.unlinkSync` on a path the caller chose is arbitrary file deletion,
    // and DELETE_PRESET did not even run the reserved-name check the save path
    // ran. Nothing outside the directory may be removed.
    escapes.forEach((name) => {
      expect(() => deletePreset(name, presetsDir)).toThrow();
    });
    expect(fs.existsSync(outside)).toBe(true);
  });

  it('refuses to read through one', () => {
    escapes.forEach((name) => {
      expect(() => fetchPreset(name, presetsDir)).toThrow();
    });
  });

  it('refuses either end of a rename', () => {
    savePreset('real.txt', preset(), presetsDir);
    expect(() =>
      renamePreset('real.txt', '../escaped.txt', presetsDir),
    ).toThrow();
    expect(() =>
      renamePreset('../do-not-touch.txt', 'x.txt', presetsDir),
    ).toThrow();
    expect(fs.existsSync(path.join(root, 'escaped.txt'))).toBe(false);
    expect(fs.readFileSync(outside, 'utf8')).toBe('still here');
  });

  it('answers "no" rather than throwing when asked whether one exists', () => {
    // The callers are asking whether a name is taken. A name no profile can be
    // stored under is not taken, and saying so keeps the caller working.
    escapes.forEach((name) => {
      expect(doesPresetExist(name, presetsDir)).toBe(false);
    });
  });

  it('still does all of that for ordinary names', () => {
    // The guard has to be invisible to everybody who is not attacking it.
    // Spaces, dots and non-ASCII are all legitimate in a profile name.
    const name = 'Café monitors v2.1.txt';
    savePreset(name, preset(), presetsDir);
    expect(doesPresetExist(name, presetsDir)).toBe(true);
    expect(fetchPreset(name, presetsDir)).toMatchObject({ preAmp: -3 });

    renamePreset(name, 'Café monitors v2.2.txt', presetsDir);
    expect(doesPresetExist(name, presetsDir)).toBe(false);
    expect(doesPresetExist('Café monitors v2.2.txt', presetsDir)).toBe(true);

    deletePreset('Café monitors v2.2.txt', presetsDir);
    expect(doesPresetExist('Café monitors v2.2.txt', presetsDir)).toBe(false);
  });
});
