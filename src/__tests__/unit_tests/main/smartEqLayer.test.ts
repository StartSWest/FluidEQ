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
  FilterTypeEnum,
  IDeviceProfileSettings,
  IPresetV2,
  IState,
  getDefaultFilters,
  getDefaultState,
} from 'common/constants';
import {
  ISmartEqSettings,
  getSmartEqFilters,
  hasSmartEqLayer,
} from 'common/smartEq';
import { getChainPeakGain } from 'common/response';
import { fetchPreset, savePreset, stateToString } from 'main/flush';
import {
  deviceProfilesToFiles,
  getStateForAudioDevice,
} from 'main/deviceProfiles';
import expandApoConfig from '../../utils/apoConfig';

const smartLayer = (
  gainsByFrequency: Record<number, number>,
  extra: Partial<ISmartEqSettings> = {},
): ISmartEqSettings => ({
  filters: Object.fromEntries(
    Object.entries(gainsByFrequency).map(([frequency, gain]) => [
      `smart-${frequency}`,
      {
        id: `smart-${frequency}`,
        frequency: Number(frequency),
        gain,
        quality: 1.4,
        type: FilterTypeEnum.PK,
      },
    ]),
  ),
  ...extra,
});

const configLines = (state: IState) =>
  stateToString(state).replace(/\r/g, '').split('\n');

const filterLines = (state: IState) =>
  configLines(state).filter((line) => line.startsWith('Filter '));

const indexOfLine = (state: IState, needle: string) =>
  configLines(state).findIndex((line) => line.includes(needle));

/** A chain with something in every layer, so ordering is actually testable. */
const fullyLoaded = (): IState => {
  const state = getDefaultState();
  state.isFlat = false;
  state.filters = {
    band: {
      id: 'band',
      frequency: 100,
      gain: 4,
      quality: 1,
      type: FilterTypeEnum.PK,
    },
  };
  state.voicing = { profileId: 'music', intensity: 1 };
  state.driver = { profileId: 'balanced-armature-iem', intensity: 1 };
  state.smartEq = smartLayer({ 1000: 3, 5000: -2 });
  return state;
};

/**
 * Smart EQ is a layer, not a rewrite of the user's bands.
 *
 * It used to write its answer straight into the band editor, which meant a
 * measurement silently overwrote a tuning somebody had built by hand and there
 * was no way to undo one without losing the other. These are the properties
 * that being a layer is supposed to buy, and every one of them is a thing that
 * broke at least once while it was not.
 */
describe('the Smart EQ layer in the Equalizer APO config', () => {
  it('writes nothing when there is no correction', async () => {
    const state = getDefaultState();
    state.isFlat = true;
    state.smartEq = smartLayer({ 1000: 0 });

    expect(stateToString(state)).not.toContain('Filter ');
  });

  it('writes its bands with the numbering continued from the layers above', async () => {
    const state = fullyLoaded();
    const indices = filterLines(state).map((line) =>
      Number(/^Filter (\d+):/.exec(line)?.[1]),
    );

    // APO numbers filters globally: a duplicate or a skipped index silently
    // breaks the config it appends to.
    expect(indices).toEqual(
      Array.from({ length: indices.length }, (_value, i) => i + 1),
    );
    expect(new Set(indices).size).toBe(indices.length);
  });

  it('comes after every other layer and before the preamp', async () => {
    const state = fullyLoaded();

    const band = indexOfLine(state, 'Fc 100 Hz Gain 4 dB');
    // 'music' voicing: a low shelf at 105 Hz. IEM driver profile: 3 kHz.
    const voicing = indexOfLine(state, 'ON LSC Fc 105 Hz');
    const driver = indexOfLine(state, 'Fc 3000 Hz');
    const smart = indexOfLine(state, 'Fc 1000 Hz Gain 3 dB Q 1.4');
    const preamp = indexOfLine(state, 'Preamp:');

    // Physical, intended, taste, measured: the driver correction sits with the
    // hardware at the head of the chain, then the bands, then the voicing on
    // top of them. Order changes nothing audible — cascaded biquads add in dB
    // whatever the sequence — it is how the config reads.
    expect(driver).toBeGreaterThan(-1);
    expect(band).toBeGreaterThan(driver);
    expect(voicing).toBeGreaterThan(band);
    // The user asked for it "on top of any other filters", and it is a
    // correction of everything below it: anything written after it would be
    // un-measured.
    expect(smart).toBeGreaterThan(voicing);
    expect(preamp).toBeGreaterThan(smart);
  });

  it('survives the reset that Clear EQ and Clear reference perform', async () => {
    // Both of those go through the same reset, which rebuilds the bands and
    // sets isFlat. The layer is written outside that check on purpose: clearing
    // the bands the user tuned does not un-measure what came out of the
    // speakers.
    const state = fullyLoaded();
    state.filters = getDefaultFilters();
    state.isFlat = true;

    const output = stateToString(state);
    expect(output).toContain('Fc 1000 Hz Gain 3 dB Q 1.4');
    expect(output).toContain('Fc 5000 Hz Gain -2 dB Q 1.4');
    expect(output).not.toContain('Fc 100 Hz Gain 4 dB');
  });
});

describe('the Smart EQ layer and the shared preamp', () => {
  it('still writes exactly one preamp for the whole chain', async () => {
    // Every layer used to have its own, and stacking them buried the signal.
    const lines = configLines(fullyLoaded()).filter((line) =>
      line.startsWith('Preamp:'),
    );
    expect(lines).toHaveLength(1);
  });

  it('reserves the headroom its boost needs', async () => {
    const withoutLayer = getDefaultState();
    withoutLayer.isFlat = true;

    const withLayer = getDefaultState();
    withLayer.isFlat = true;
    withLayer.smartEq = smartLayer({ 1000: 5 });

    const preampOf = (state: IState) =>
      Number(
        /-?[\d.]+/.exec(
          configLines(state).find((line) => line.startsWith('Preamp:')) ?? '',
        )?.[0],
      );

    expect(preampOf(withoutLayer)).toBe(0);
    expect(preampOf(withLayer)).toBeLessThan(0);
    // Derived from the real chain peak, not from a stored number.
    expect(preampOf(withLayer)).toBeCloseTo(
      -(getChainPeakGain(getSmartEqFilters(withLayer.smartEq)) + 0.2),
      1,
    );
  });

  it('counts the layer as part of the combined peak, not on top of it', async () => {
    // Boosts at different frequencies never coincide, so summing each layer's
    // own peak would throw away volume for headroom nothing is using.
    const combined = getDefaultState();
    combined.isFlat = true;
    combined.voicing = { profileId: 'music', intensity: 1 };
    combined.smartEq = smartLayer({ 5000: 5 });

    const preampOf = (state: IState) =>
      Number(
        /-?[\d.]+/.exec(
          configLines(state).find((line) => line.startsWith('Preamp:')) ?? '',
        )?.[0],
      );

    const voicingOnly = getDefaultState();
    voicingOnly.isFlat = true;
    voicingOnly.voicing = { profileId: 'music', intensity: 1 };

    const smartOnly = getDefaultState();
    smartOnly.isFlat = true;
    smartOnly.smartEq = smartLayer({ 5000: 5 });

    expect(preampOf(combined)).toBeLessThan(preampOf(voicingOnly));
    expect(preampOf(combined)).toBeGreaterThan(
      preampOf(voicingOnly) + preampOf(smartOnly),
    );
  });
});

describe('the Smart EQ layer and the profile it belongs to', () => {
  let presetsDir: string;

  beforeEach(async () => {
    presetsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-smart-'));
  });

  afterEach(async () => {
    fs.rmSync(presetsDir, { recursive: true, force: true });
  });

  it('round-trips through a profile save and load', async () => {
    // Device profile blocks are rendered from the preset file alone, so a
    // layer missing from it reaches APO for the active output only and
    // vanishes the moment a profile is attached.
    const preset: IPresetV2 = {
      preAmp: 0,
      filters: getDefaultFilters(),
      smartEq: smartLayer(
        { 1000: 3, 5000: -2 },
        { status: 'partial', lowFrequency: 70, highFrequency: 8960 },
      ),
    };

    await savePreset('measured', preset, presetsDir);
    const loaded = fetchPreset('measured', presetsDir);

    expect(loaded.smartEq).toEqual(preset.smartEq);
    expect(hasSmartEqLayer(loaded.smartEq)).toBe(true);
    expect(loaded.smartEq?.status).toBe('partial');
  });

  it('reaches Equalizer APO for a device that only has a profile', async () => {
    await savePreset(
      'measured',
      {
        preAmp: 0,
        isFlat: true,
        filters: getDefaultFilters(),
        smartEq: smartLayer({ 1000: 3 }),
      },
      presetsDir,
    );

    const settings: IDeviceProfileSettings = {
      version: 1,
      assignments: {
        headphones: {
          deviceId: 'headphones',
          deviceName: 'Headphones',
          deviceGuid: '{HEADPHONES}',
          presetName: 'measured',
        },
      },
    };

    expect(
      expandApoConfig(deviceProfilesToFiles(settings, () => presetsDir)),
    ).toContain('Fc 1000 Hz Gain 3 dB Q 1.4');
  });

  it('does not follow the user onto an output that never measured', async () => {
    // getStateForAudioDevice is applied over the live state with Object.assign,
    // so a key it omits leaves the previous device's value in place — and
    // auto-save then writes the leak into that device's profile for good.
    await savePreset(
      'measured',
      {
        preAmp: 0,
        filters: getDefaultFilters(),
        smartEq: smartLayer({ 1000: 3 }),
      },
      presetsDir,
    );
    await savePreset(
      'bare',
      { preAmp: 0, filters: getDefaultFilters() },
      presetsDir,
    );

    const settings: IDeviceProfileSettings = {
      version: 1,
      assignments: {
        measured: {
          deviceId: 'measured',
          deviceName: 'Headphones',
          deviceGuid: '{HEADPHONES}',
          presetName: 'measured',
        },
        bare: {
          deviceId: 'bare',
          deviceName: 'Speakers',
          deviceGuid: '{SPEAKERS}',
          presetName: 'bare',
        },
      },
    };

    const bare = getStateForAudioDevice(settings, 'bare', () => presetsDir);
    expect(Object.prototype.hasOwnProperty.call(bare, 'smartEq')).toBe(true);
    expect(bare.smartEq).toBeUndefined();

    const live = getDefaultState();
    Object.assign(
      live,
      getStateForAudioDevice(settings, 'measured', () => presetsDir),
    );
    expect(hasSmartEqLayer(live.smartEq)).toBe(true);

    Object.assign(
      live,
      getStateForAudioDevice(settings, 'bare', () => presetsDir),
    );
    expect(live.smartEq).toBeUndefined();
  });
});

/**
 * Clearing the reference must not clear the measurement.
 *
 * This is the requirement in the user's own words. The reference wrote the
 * bands, so dropping it takes the bands with it — but the Smart EQ layer
 * describes what came out of the speakers, not what went into the bands, and
 * nothing about removing an attribution makes that measurement untrue.
 */
describe('clearing the headphone reference', () => {
  /** What CLEAR_HEADSET does in main, minus the electron. */
  const resetEqToDefaults = (state: IState) => {
    state.filters = getDefaultFilters();
    state.preAmp = 0;
    state.isFlat = true;
    state.headset = undefined;
    state.headsetTarget = undefined;
    state.headsetSource = undefined;
  };

  it('leaves the measured correction standing', async () => {
    const state = fullyLoaded();
    state.headset = 'HD 600';
    state.headsetTarget = 'Harman 2018';

    resetEqToDefaults(state);

    expect(state.headset).toBeUndefined();
    expect(hasSmartEqLayer(state.smartEq)).toBe(true);
    // Not merely present in the state — still audible in what APO is handed.
    expect(stateToString(state)).toContain('Fc 1000 Hz Gain 3 dB Q 1.4');
  });

  it('and clearing the correction leaves the reference and the bands', async () => {
    const state = fullyLoaded();
    state.headset = 'HD 600';

    state.smartEq = undefined;

    expect(state.headset).toBe('HD 600');
    expect(state.filters.band.gain).toBe(4);
    expect(stateToString(state)).toContain('Fc 100 Hz Gain 4 dB');
  });
});
