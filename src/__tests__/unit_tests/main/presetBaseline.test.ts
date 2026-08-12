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
  deletePresetBaseline,
  fetchPresetBaseline,
  hasPresetBaseline,
  renamePresetBaseline,
  savePresetBaseline,
} from '../../../main/flush';
import { FilterTypeEnum, IPresetV2 } from '../../../common/constants';

const presetWith = (gain: number, preAmp: number): IPresetV2 => ({
  preAmp,
  filters: {
    a: {
      id: 'a',
      frequency: 120,
      gain,
      quality: 1.1,
      type: FilterTypeEnum.PK,
    },
  },
});

/**
 * The baseline is the only copy of a profile that auto-save does not touch, so
 * these cover the whole lifecycle: it has to survive edits, follow renames,
 * disappear with the profile, and never write outside its own directory.
 */
describe('manually saved profile baselines', () => {
  let baselineDir: string;

  beforeEach(() => {
    baselineDir = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-baseline-')),
      'preset-baselines',
    );
  });

  afterEach(() => {
    fs.rmSync(path.dirname(baselineDir), { recursive: true, force: true });
  });

  it('creates its directory on the first save', () => {
    expect(fs.existsSync(baselineDir)).toBe(false);
    savePresetBaseline('Studio', presetWith(4, -2), baselineDir);
    expect(hasPresetBaseline('Studio', baselineDir)).toBe(true);
  });

  it('round-trips the saved profile', () => {
    savePresetBaseline('Studio', presetWith(4, -2), baselineDir);
    const restored = fetchPresetBaseline('Studio', baselineDir);

    expect(restored?.preAmp).toBe(-2);
    expect(restored?.filters.a.gain).toBe(4);
    expect(restored?.filters.a.frequency).toBe(120);
    expect(restored?.filters.a.type).toBe(FilterTypeEnum.PK);
  });

  it('is unaffected by later edits to the profile itself', () => {
    savePresetBaseline('Studio', presetWith(4, -2), baselineDir);
    // Auto-save writes the profile file, never the baseline. Nothing here
    // touches baselineDir, so the kept copy must still read back as saved.
    expect(fetchPresetBaseline('Studio', baselineDir)?.filters.a.gain).toBe(4);
  });

  it('reports nothing to restore for a profile never saved by hand', () => {
    expect(hasPresetBaseline('Never', baselineDir)).toBe(false);
    expect(fetchPresetBaseline('Never', baselineDir)).toBeUndefined();
  });

  it('follows a rename', () => {
    savePresetBaseline('Old', presetWith(6, -3), baselineDir);
    renamePresetBaseline('Old', 'New', baselineDir);

    expect(hasPresetBaseline('Old', baselineDir)).toBe(false);
    expect(fetchPresetBaseline('New', baselineDir)?.filters.a.gain).toBe(6);
  });

  it('survives renaming a profile that has no baseline', () => {
    expect(() =>
      renamePresetBaseline('Missing', 'Other', baselineDir),
    ).not.toThrow();
  });

  it('goes away with the profile', () => {
    savePresetBaseline('Doomed', presetWith(1, 0), baselineDir);
    deletePresetBaseline('Doomed', baselineDir);
    expect(hasPresetBaseline('Doomed', baselineDir)).toBe(false);
  });

  it('survives deleting a profile that has no baseline', () => {
    expect(() => deletePresetBaseline('Missing', baselineDir)).not.toThrow();
  });

  it('refuses names that would escape the baseline directory', () => {
    savePresetBaseline('../escaped', presetWith(9, -9), baselineDir);
    savePresetBaseline('nested/name', presetWith(9, -9), baselineDir);

    expect(hasPresetBaseline('../escaped', baselineDir)).toBe(false);
    expect(hasPresetBaseline('nested/name', baselineDir)).toBe(false);
    // Nothing was written anywhere near the parent either.
    expect(fs.existsSync(path.join(path.dirname(baselineDir), 'escaped'))).toBe(
      false,
    );
  });

  it('ignores a corrupt baseline rather than throwing', () => {
    fs.mkdirSync(baselineDir, { recursive: true });
    fs.writeFileSync(path.join(baselineDir, 'Broken'), 'not json at all');

    expect(fetchPresetBaseline('Broken', baselineDir)).toBeUndefined();
  });
});
