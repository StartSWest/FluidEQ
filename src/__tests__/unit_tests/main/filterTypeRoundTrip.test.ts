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
  fetchPreset,
  fetchSettings,
  save,
  savePreset,
} from '../../../main/flush';
import { validatePresetV2, validateState } from '../../../common/validator';
import { FilterTypeEnum, getDefaultState } from '../../../common/constants';

const ALL_TYPES = Object.values(FilterTypeEnum);

/**
 * Every filter type the band dropdown offers has to survive being saved.
 *
 * The schemas hard-coded ['HSC', 'LSC', 'PK'] while the UI offered seven types
 * and the IPC handler accepted all seven. Choosing Notch, Low Pass, High Pass
 * or Band Pass wrote a state file that failed its own validation on the next
 * launch, and the recovery path preserves the type so it failed too — the app
 * silently fell back to ten default bands, which auto-save then wrote over the
 * user's named profile. Losing a tuning to a dropdown entry is about the worst
 * thing this app can do, so every type is checked rather than a sample.
 */
describe('filter types survive a save and reload', () => {
  let dir: string;

  beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-types-'));
  });

  afterEach(async () => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('offers more than the three the schema used to allow', async () => {
    // Guards the premise: if the enum ever shrinks back to three, the rest of
    // this file would pass while proving nothing.
    expect(ALL_TYPES.length).toBeGreaterThan(3);
  });

  it.each(ALL_TYPES)('validates a state using %s', (type) => {
    const state = getDefaultState();
    state.filters = {
      a: { id: 'a', frequency: 120, gain: 0, quality: 0.7, type },
    };

    expect(validateState(state)).toBe(true);
  });

  it.each(ALL_TYPES)('round-trips %s through the state file', async (type) => {
    const state = getDefaultState();
    state.filters = {
      a: { id: 'a', frequency: 120, gain: 0, quality: 0.7, type },
    };
    await save(state, dir);

    const loaded = fetchSettings(dir);
    const loadedTypes = Object.values(loaded.filters).map(
      (filter) => filter.type,
    );

    // Exactly the one band back, not the ten-band default set.
    expect(loadedTypes).toEqual([type]);
  });

  it.each(ALL_TYPES)('round-trips %s through a saved profile', async (type) => {
    const preset = {
      preAmp: -2,
      filters: {
        a: { id: 'a', frequency: 120, gain: 0, quality: 0.7, type },
      },
    };

    expect(validatePresetV2(preset)).toBe(true);

    await savePreset('Mine', preset, dir);
    const loaded = fetchPreset('Mine', dir);

    expect(Object.values(loaded.filters).map((filter) => filter.type)).toEqual([
      type,
    ]);
  });
});
