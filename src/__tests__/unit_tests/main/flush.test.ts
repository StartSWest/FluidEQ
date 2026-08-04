/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

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

import {
  addFileToPath,
  checkConfigFile,
  deletePreset,
  doesPresetExist,
  fetchPreset,
  fetchSettings,
  renamePreset,
  save,
  savePreset,
  serializePreset,
  serializeState,
  stateToString,
  updateConfig,
} from 'main/flush';
import fs from 'fs';
import {
  AutoEqFormat,
  FilterTypeEnum,
  getDefaultState,
  IPresetV2,
  IState,
} from 'common/constants';

const TEST_DATA_DIR = 'src/__tests__/data';
const TEST_DATA_READ_DIR = addFileToPath(TEST_DATA_DIR, 'read_only');
const TEST_DATA_WRITE_DIR = addFileToPath(TEST_DATA_DIR, 'write');
const mockSettings = {
  isEnabled: true,
  isAutoPreAmpOn: true,
  isGraphViewOn: true,
  isCaseSensitiveFs: false,
  preAmp: 13,
  filters: {
    '7cf32e8a': {
      id: '7cf32e8a',
      frequency: 32,
      gain: 8,
      quality: 1.5,
      type: FilterTypeEnum.PK,
    },
    '3e97b5dc': {
      id: '3e97b5dc',
      frequency: 16000,
      gain: -10,
      quality: 2.3,
      type: FilterTypeEnum.HSC,
    },
  },
};

describe('flush', () => {
  describe('stateToString', () => {
    const defaultState = getDefaultState();
    it('should return empty string if state is disabled', () => {
      expect(stateToString({ ...defaultState, isEnabled: false })).toBe('');
    });

    it('should convert output to correct format', () => {
      const returnedString = stateToString(defaultState);
      expect(returnedString).toMatch(/Device: all\n\rChannel: all\n\r/);
      expect(returnedString).toMatch(/Preamp: 0 dB$/);

      // A flat/default state should not emit inert EQ commands to APO.
      expect(returnedString).not.toContain('Filter ');
    });

    // Equalizer APO's ParametricEQ grammar only accepts a Gain token for the
    // peaking and shelf forms. A stray Gain on a band pass, notch or pass
    // filter makes APO reject the whole line.
    it('emits the Gain token only for filter types that take one', () => {
      const withGain = [
        FilterTypeEnum.PK,
        FilterTypeEnum.LSC,
        FilterTypeEnum.HSC,
      ];
      const withoutGain = [
        FilterTypeEnum.BP,
        FilterTypeEnum.NO,
        FilterTypeEnum.LPQ,
        FilterTypeEnum.HPQ,
      ];

      withGain.forEach((type) => {
        const state = getDefaultState();
        const filter = Object.values(state.filters)[0];
        filter.type = type;
        filter.gain = 4;
        filter.frequency = 1000;
        filter.quality = 1.5;
        state.filters = { [filter.id]: filter };

        expect(stateToString(state)).toContain(
          `Filter 1: ON ${type} Fc 1000 Hz Gain 4 dB Q 1.5`,
        );
      });

      withoutGain.forEach((type) => {
        const state = getDefaultState();
        const filter = Object.values(state.filters)[0];
        filter.type = type;
        filter.gain = 4;
        filter.frequency = 1000;
        filter.quality = 1.5;
        state.filters = { [filter.id]: filter };

        const returnedString = stateToString(state);
        expect(returnedString).toContain(
          `Filter 1: ON ${type} Fc 1000 Hz Q 1.5`,
        );
        expect(returnedString).not.toContain(`ON ${type} Fc 1000 Hz Gain`);
      });
    });

    // A gainless filter still shapes the signal at 0 dB, so unlike a flat
    // peak or shelf it must survive into the config.
    it('keeps zero-gain band pass and notch filters', () => {
      const state = getDefaultState();
      const filter = Object.values(state.filters)[0];
      filter.type = FilterTypeEnum.BP;
      filter.gain = 0;
      state.filters = { [filter.id]: filter };

      expect(stateToString(state)).toContain('ON BP');
    });

    // The voicing is a separate layer. APO numbers filters globally, so a
    // duplicate or skipped index silently breaks the config it appends to.
    describe('voicing layer', () => {
      it('writes nothing when no voicing is selected', () => {
        const state = getDefaultState();
        state.voicing = { profileId: '', intensity: 1 };
        expect(stateToString(state)).not.toContain('Filter ');
      });

      it('numbers straight on from the EQ bands', () => {
        const state = getDefaultState();
        const bands = Object.values(state.filters).slice(0, 2);
        bands.forEach((band, index) => {
          band.gain = index + 1;
        });
        state.filters = Object.fromEntries(
          bands.map((band) => [band.id, band]),
        );
        state.voicing = { profileId: 'music', intensity: 1 };

        const lines = stateToString(state)
          .split('\n\r')
          .filter((line) => line.startsWith('Filter '));
        const indices = lines.map((line) =>
          Number(line.match(/^Filter (\d+):/)?.[1]),
        );

        expect(indices).toEqual(
          Array.from({ length: indices.length }, (_value, i) => i + 1),
        );
        expect(new Set(indices).size).toBe(indices.length);
        expect(lines.length).toBeGreaterThan(bands.length);
      });

      // Clearing resets the bands the user tuned, not the target they chose.
      it('survives a flat EQ', () => {
        const state = getDefaultState();
        state.isFlat = true;
        state.voicing = { profileId: 'speech', intensity: 1 };

        const output = stateToString(state);
        expect(output).toContain('Filter 1: ON HPQ Fc 85 Hz Q');
        // The gainless high-pass still carries no Gain token.
        expect(output).not.toContain('ON HPQ Fc 85 Hz Gain');
      });

      it('scales gains by intensity and drops the ones that reach zero', () => {
        const state = getDefaultState();
        state.isFlat = true;

        state.voicing = { profileId: 'music', intensity: 1 };
        expect(stateToString(state)).toContain('Gain 3.5 dB');

        state.voicing = { profileId: 'music', intensity: 0.5 };
        expect(stateToString(state)).toContain('Gain 1.8 dB');

        // At zero the layer disappears rather than writing inert commands.
        state.voicing = { profileId: 'music', intensity: 0 };
        expect(stateToString(state)).not.toContain('Filter ');
      });

      it('ignores an unknown profile', () => {
        const state = getDefaultState();
        state.isFlat = true;
        state.voicing = { profileId: 'not-a-profile', intensity: 1 };
        expect(stateToString(state)).not.toContain('Filter ');
      });
    });

    it('clamps legacy gain values to the safe +/-20 dB range', () => {
      const state = getDefaultState();
      const firstFilter = Object.values(state.filters)[0];
      firstFilter.gain = 30;
      state.preAmp = -30;

      const returnedString = stateToString(state);

      expect(returnedString).toContain('Gain 20 dB');
      expect(returnedString).toContain('Preamp: -20 dB');
      expect(returnedString).not.toContain('Gain 30 dB');
      expect(returnedString).not.toContain('Preamp: -30 dB');
    });

    it('omits every filter while the state is explicitly flat', () => {
      const state = getDefaultState();
      const firstFilter = Object.values(state.filters)[0];
      firstFilter.type = FilterTypeEnum.NO;
      state.isFlat = true;

      expect(stateToString(state)).not.toContain('Filter ');
    });

    it('keeps convolution active when the EQ chain is flat', () => {
      const state = getDefaultState();
      state.isFlat = true;
      state.convolution = {
        name: 'Reference headphones',
        filters: {},
      };

      const returnedString = stateToString(
        state,
        'fluideq-convolution-test.wav',
      );

      expect(returnedString).toContain(
        'Convolution: fluideq-convolution-test.wav',
      );
      expect(returnedString).not.toContain('Filter ');
    });

    it('writes GraphicEQ profiles using APO native syntax', () => {
      const state = getDefaultState();
      state.eqFormat = AutoEqFormat.GRAPHIC;
      state.graphicEq = [
        { frequency: 25, gain: 0 },
        { frequency: 160, gain: 6.2 },
      ];

      const returnedString = stateToString(state);

      expect(returnedString).toContain('GraphicEQ: 25 0; 160 6.2');
      expect(returnedString).not.toContain('Filter ');
    });
  });

  describe('fetchSettings', () => {
    it('should succesfully fetch settings from the state file', () => {
      const settings: IState = fetchSettings(TEST_DATA_READ_DIR);
      expect(settings).toStrictEqual(mockSettings);
    });
  });

  describe('save', () => {
    it('should succesfully save settings to the state file', () => {
      save(mockSettings, TEST_DATA_WRITE_DIR);
      expect(
        fs
          .readFileSync(addFileToPath(TEST_DATA_WRITE_DIR, 'state.txt'))
          .toString(),
      ).toBe(serializeState(mockSettings));
    });
  });

  describe('fetchPreset', () => {
    beforeAll(() => {
      fs.copyFileSync(
        addFileToPath(TEST_DATA_READ_DIR, 'presetV1'),
        addFileToPath(TEST_DATA_WRITE_DIR, 'presetV1'),
      );
    });
    it('should read succesfully a preset of the IPresetV2 format', () => {
      const presetName = 'presetV2';
      const preset = fetchPreset(presetName, TEST_DATA_READ_DIR);
      expect(preset).toStrictEqual({
        preAmp: 0,
        filters: {
          '0a04dcf8': {
            id: '0a04dcf8',
            frequency: 32,
            gain: -4,
            quality: 1,
            type: FilterTypeEnum.PK,
          },
          d77a7415: {
            id: 'd77a7415',
            frequency: 16000,
            gain: 0,
            quality: 1,
            type: FilterTypeEnum.PK,
          },
        },
      });
    });

    it('should read succesfully a preset of the IPresetV1 format and replace it with a IPresetV2 format', () => {
      const preset = fetchPreset('presetV1', TEST_DATA_WRITE_DIR);
      expect(preset).toStrictEqual({
        preAmp: 0,
        filters: {
          '123': { id: '123', frequency: 2, gain: -4, quality: 6, type: 'PK' },
          '456': {
            id: '456',
            frequency: 8,
            gain: -10,
            quality: 1.2,
            type: FilterTypeEnum.PK,
          },
        },
      });
    });
  });

  describe('save and delete preset', () => {
    it('should save and delete a preset', () => {
      const presetName = 'newPreset';
      const preset: IPresetV2 = {
        preAmp: 0,
        filters: {
          '123': {
            id: '123',
            frequency: 2,
            gain: -4,
            quality: 6,
            type: FilterTypeEnum.PK,
          },
        },
      };
      savePreset(presetName, preset, TEST_DATA_WRITE_DIR);
      expect(doesPresetExist(presetName, TEST_DATA_WRITE_DIR)).toBe(true);
      deletePreset(presetName, TEST_DATA_WRITE_DIR);
      expect(doesPresetExist(presetName, TEST_DATA_WRITE_DIR)).toBe(false);
    });
  });

  describe('doesPresetExist', () => {
    it('should return true for an existing preset', () => {
      const presetName = 'presetV1';
      expect(doesPresetExist(presetName, TEST_DATA_READ_DIR)).toBe(true);
    });

    it('should return false for a non-existing preset', () => {
      const presetName = '404_not_found';
      expect(doesPresetExist(presetName, TEST_DATA_READ_DIR)).toBe(false);
    });
  });

  describe('renamePreset', () => {
    const oldPresetName = 'oldPresetName';
    const newPresetName = 'newPresetName';
    const preset: IPresetV2 = {
      preAmp: 0,
      filters: {
        '123': {
          id: '123',
          frequency: 2,
          gain: -4,
          quality: 6,
          type: FilterTypeEnum.PK,
        },
        '456': {
          id: '456',
          frequency: 8,
          gain: -10,
          quality: 1.2,
          type: FilterTypeEnum.PK,
        },
      },
    };

    beforeAll(() => {
      // Create a file with the old file name in case if it doesn't exist
      if (!doesPresetExist(oldPresetName, TEST_DATA_WRITE_DIR)) {
        fs.writeFileSync(
          addFileToPath(TEST_DATA_WRITE_DIR, oldPresetName),
          serializePreset(preset),
          {
            encoding: 'utf8',
          },
        );
      }
    });

    it('should sucessfully rename a preset', () => {
      renamePreset(oldPresetName, newPresetName, TEST_DATA_WRITE_DIR);
      expect(doesPresetExist(oldPresetName, TEST_DATA_WRITE_DIR)).toBe(false);
      expect(fetchPreset(newPresetName, TEST_DATA_WRITE_DIR)).toStrictEqual(
        preset,
      );
      renamePreset(newPresetName, oldPresetName, TEST_DATA_WRITE_DIR);
    });
  });

  describe('checkConfig', () => {
    it('should return true for an existing preset', () => {
      expect(() => checkConfigFile(TEST_DATA_DIR)).toThrow();
    });

    it('should return false for a non-existing preset', () => {
      expect(checkConfigFile(TEST_DATA_READ_DIR)).toBe(false);
    });
  });

  describe('updateConfig', () => {
    it('should result in a valid config file', () => {
      updateConfig(TEST_DATA_WRITE_DIR);
      expect(checkConfigFile(TEST_DATA_WRITE_DIR)).toBe(true);
    });
  });
});
