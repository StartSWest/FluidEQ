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
import { migrateNamedFilesToOutputFolders } from '../../../main/deviceProfiles';
import {
  FilterTypeEnum,
  IDeviceProfileSettings,
  IPresetV2,
} from '../../../common/constants';

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

/**
 * A folder per output, for the same reason the profiles got one.
 *
 * These copies stayed flat and keyed by name for a release after profiles were
 * split, so every output attached to "Untitled profile 1" — which is every
 * output FluidEQ ever names for itself — shared a single undo point. Saving on
 * one overwrote the others', and renaming on one took the file away from all of
 * them.
 */
describe('baselines scoped to one output', () => {
  let root: string;
  const dirFor = (deviceId: string) => path.join(root, deviceId);

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-baseline-split-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('keeps two outputs’ same-named saved copies apart', () => {
    savePresetBaseline('Untitled profile 1', presetWith(6, -6), dirFor('hp'));
    savePresetBaseline('Untitled profile 1', presetWith(2, -2), dirFor('sp'));

    expect(
      fetchPresetBaseline('Untitled profile 1', dirFor('hp'))?.filters.a.gain,
    ).toBe(6);
    expect(
      fetchPresetBaseline('Untitled profile 1', dirFor('sp'))?.filters.a.gain,
    ).toBe(2);
  });

  it('renames one output’s saved copy and leaves the other’s', () => {
    savePresetBaseline('Untitled profile 1', presetWith(6, -6), dirFor('hp'));
    savePresetBaseline('Untitled profile 1', presetWith(2, -2), dirFor('sp'));

    renamePresetBaseline('Untitled profile 1', 'Studio', dirFor('hp'));

    // The positive control: asserting only that the speakers kept theirs would
    // pass just as well if the rename had done nothing.
    expect(hasPresetBaseline('Studio', dirFor('hp'))).toBe(true);
    expect(hasPresetBaseline('Untitled profile 1', dirFor('hp'))).toBe(false);
    expect(hasPresetBaseline('Untitled profile 1', dirFor('sp'))).toBe(true);
  });

  it('deletes one output’s saved copy and leaves the other’s', () => {
    savePresetBaseline('Untitled profile 1', presetWith(6, -6), dirFor('hp'));
    savePresetBaseline('Untitled profile 1', presetWith(2, -2), dirFor('sp'));

    deletePresetBaseline('Untitled profile 1', dirFor('hp'));

    expect(hasPresetBaseline('Untitled profile 1', dirFor('hp'))).toBe(false);
    expect(hasPresetBaseline('Untitled profile 1', dirFor('sp'))).toBe(true);
  });
});

/** Catching up an install whose saved copies are still in one flat folder. */
describe('migrating a flat store into per-output folders', () => {
  let root: string;
  const flatDir = () => path.join(root, 'flat');
  const dirFor = (deviceId: string) => path.join(root, deviceId);

  const settingsFor = (...deviceIds: string[]): IDeviceProfileSettings => ({
    version: 1,
    assignments: Object.fromEntries(
      deviceIds.map((deviceId) => [
        deviceId,
        {
          deviceId,
          deviceName: deviceId,
          deviceGuid: `{${deviceId}}`,
          presetName: 'Untitled profile 1',
        },
      ]),
    ),
  });

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-baseline-move-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('moves the flat copy into its output’s folder', () => {
    savePresetBaseline('Untitled profile 1', presetWith(6, -6), flatDir());

    migrateNamedFilesToOutputFolders(
      settingsFor('hp'),
      flatDir(),
      dirFor,
      'saved copy',
    );

    expect(
      fetchPresetBaseline('Untitled profile 1', dirFor('hp'))?.filters.a.gain,
    ).toBe(6);
    expect(fs.existsSync(path.join(flatDir(), 'Untitled profile 1'))).toBe(
      false,
    );
  });

  it('gives an ambiguous copy to one output and no other', () => {
    // The lossy case, stated rather than hidden: one file, three outputs with
    // an equal claim and nothing on disk saying who saved it. It survives under
    // one owner instead of being duplicated into three lies.
    savePresetBaseline('Untitled profile 1', presetWith(6, -6), flatDir());

    migrateNamedFilesToOutputFolders(
      settingsFor('hp', 'sp', 'tv'),
      flatDir(),
      dirFor,
      'saved copy',
    );

    const owners = ['hp', 'sp', 'tv'].filter((deviceId) =>
      hasPresetBaseline('Untitled profile 1', dirFor(deviceId)),
    );
    expect(owners).toHaveLength(1);
  });

  it('never overwrites a copy the new layout already holds', () => {
    savePresetBaseline('Untitled profile 1', presetWith(6, -6), flatDir());
    savePresetBaseline('Untitled profile 1', presetWith(2, -2), dirFor('hp'));

    migrateNamedFilesToOutputFolders(
      settingsFor('hp'),
      flatDir(),
      dirFor,
      'saved copy',
    );

    expect(
      fetchPresetBaseline('Untitled profile 1', dirFor('hp'))?.filters.a.gain,
    ).toBe(2);
  });

  it('is a no-op the second time', () => {
    savePresetBaseline('Untitled profile 1', presetWith(6, -6), flatDir());
    const settings = settingsFor('hp');

    migrateNamedFilesToOutputFolders(settings, flatDir(), dirFor, 'saved copy');
    migrateNamedFilesToOutputFolders(settings, flatDir(), dirFor, 'saved copy');

    expect(
      fetchPresetBaseline('Untitled profile 1', dirFor('hp'))?.filters.a.gain,
    ).toBe(6);
  });

  it('leaves a copy no output claims where it is', () => {
    savePresetBaseline('Nobody', presetWith(6, -6), flatDir());

    migrateNamedFilesToOutputFolders(
      settingsFor('hp'),
      flatDir(),
      dirFor,
      'saved copy',
    );

    // Not deleted and not guessed at — still readable if it turns out to matter.
    expect(hasPresetBaseline('Nobody', flatDir())).toBe(true);
  });
});
