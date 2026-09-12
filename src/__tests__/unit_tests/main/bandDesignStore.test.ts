import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  cloneBandDesign,
  filtersFromBandDesign,
  isBandDesign,
  snapshotBandDesign,
} from 'common/bandDesigns';
import {
  FilterTypeEnum,
  getDefaultFilterWithId,
  getDefaultState,
} from 'common/constants';
import {
  deleteBandDesign,
  readBandDesigns,
  writeBandDesign,
} from 'main/bandDesignStore';
import { fetchSettings, fetchPreset, save, savePreset } from 'main/flush';
import { flushPendingWrites } from 'main/asyncWriter';
import { validateState, validatePresetV2 } from 'common/validator';
import {
  getDefaultDeviceProfileSettings,
  getStateForAudioDevice,
} from 'main/deviceProfiles';

const design = {
  id: 'custom',
  name: 'Gentle bass',
  bands: [
    { frequency: 73, quality: 1.7 },
    { frequency: 2111, quality: 3.4 },
  ],
};

describe('band design catalog and persistence', () => {
  let directory: string;
  let filename: string;
  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-band-design-'));
    filename = path.join(directory, 'band-designs.json');
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await flushPendingWrites();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('saves only frequencies and Q, never gain, type or EQ mode', () => {
    const filter = {
      ...getDefaultFilterWithId(),
      frequency: 73,
      quality: 1.7,
      gain: 9,
      type: FilterTypeEnum.HSC,
    };
    expect(snapshotBandDesign({ [filter.id]: filter })).toEqual([
      design.bands[0],
    ]);
    const legacy = {
      ...design,
      eqMode: 'double',
      bands: design.bands.map((band) => ({
        ...band,
        gain: 9,
        type: FilterTypeEnum.HSC,
        isEnabled: false,
      })),
    };
    writeBandDesign(directory, legacy);
    expect(JSON.parse(fs.readFileSync(filename, 'utf8'))).toEqual({
      version: 2,
      designs: [design],
    });
    expect(readBandDesigns(directory)).toEqual([design]);
    const filters = Object.values(filtersFromBandDesign(legacy));
    expect(
      filters.map(({ frequency, quality }) => ({ frequency, quality })),
    ).toEqual(design.bands);
    expect(
      filters.every(
        (filterEntry) =>
          filterEntry.gain === 0 &&
          filterEntry.type === FilterTypeEnum.PK &&
          filterEntry.isEnabled !== false,
      ),
    ).toBe(true);
    expect(new Set(filters.map((filterEntry) => filterEntry.id)).size).toBe(2);
  });

  it('starts empty, updates by id, and deletes just the named design', () => {
    expect(readBandDesigns(directory)).toEqual([]);
    writeBandDesign(directory, design);
    writeBandDesign(directory, { ...design, id: 'second', name: 'Second' });
    const updated = { ...design, bands: [{ frequency: 91, quality: 4.2 }] };
    writeBandDesign(directory, updated);
    expect(readBandDesigns(directory)).toEqual([
      updated,
      { ...design, id: 'second', name: 'Second' },
    ]);
    expect(deleteBandDesign(directory, 'missing')).toBe(false);
    expect(deleteBandDesign(directory, 'custom')).toBe(true);
    expect(readBandDesigns(directory).map((entry) => entry.id)).toEqual([
      'second',
    ]);
  });

  it('drops legacy gains and mode when reading version one and writes version two', () => {
    fs.writeFileSync(
      filename,
      JSON.stringify({
        version: 1,
        designs: [
          {
            ...design,
            eqMode: 'double',
            bands: design.bands.map((band) => ({ ...band, gain: 12 })),
          },
        ],
      }),
    );
    expect(readBandDesigns(directory)).toEqual([design]);
    writeBandDesign(directory, design);
    expect(JSON.parse(fs.readFileSync(filename, 'utf8'))).toEqual({
      version: 2,
      designs: [design],
    });
  });

  it('does not alias snapshots or admit invalid frequencies, Q and names', () => {
    const copy = cloneBandDesign(design);
    copy.bands[0].quality = 9;
    expect(design.bands[0].quality).toBe(1.7);
    expect(isBandDesign(design)).toBe(true);
    [
      { ...design, name: '  ' },
      { ...design, name: 'line\nbreak' },
      { ...design, bands: [] },
      { ...design, bands: [{ frequency: NaN, quality: 2 }] },
      { ...design, bands: [{ frequency: 1000, quality: -1 }] },
    ].forEach((invalid) => {
      expect(isBandDesign(invalid)).toBe(false);
    });
  });

  it('rejects duplicates and corruption without replacing the existing catalog', () => {
    writeBandDesign(directory, design);
    const before = fs.readFileSync(filename, 'utf8');
    expect(() =>
      writeBandDesign(directory, {
        ...design,
        id: 'duplicate',
        name: ' GENTLE BASS ',
      }),
    ).toThrow('already exists');
    expect(fs.readFileSync(filename, 'utf8')).toBe(before);
    fs.writeFileSync(filename, '{invalid');
    expect(() => writeBandDesign(directory, design)).toThrow();
    expect(fs.readFileSync(filename, 'utf8')).toBe('{invalid');
  });

  it('preserves the catalog and cleans its temporary file if replacement fails', () => {
    writeBandDesign(directory, design);
    const before = fs.readFileSync(filename, 'utf8');
    jest.spyOn(fs, 'renameSync').mockImplementationOnce(() => {
      throw new Error('locked');
    });
    expect(() => deleteBandDesign(directory, design.id)).toThrow('locked');
    expect(fs.readFileSync(filename, 'utf8')).toBe(before);
    expect(fs.readdirSync(directory)).toEqual(['band-designs.json']);
  });

  it('round trips state and profiles while preserving tuning independently of the design', async () => {
    const state = {
      ...getDefaultState(),
      eqBandDesign: design,
      eqMode: 'double' as const,
      preAmp: -8,
    };
    const filter = Object.values(state.filters)[0];
    filter.gain = 5;
    filter.quality = 6.5;
    expect(validateState(state)).toBe(true);
    await save(state, directory);
    expect(fetchSettings(directory)).toMatchObject({
      eqBandDesign: design,
      eqMode: 'double',
      preAmp: -8,
      filters: state.filters,
    });
    const preset = {
      filters: state.filters,
      preAmp: -8,
      eqBandDesign: design,
      eqMode: 'double' as const,
    };
    expect(validatePresetV2(preset)).toBe(true);
    await savePreset('Saved', preset, directory);
    expect(fetchPreset('Saved', directory)).toMatchObject(preset);
    const assignments = getDefaultDeviceProfileSettings();
    assignments.assignments.output = {
      deviceId: 'output',
      deviceGuid: '{OUTPUT}',
      deviceName: 'Output',
      presetName: 'Saved',
    };
    expect(
      getStateForAudioDevice(assignments, 'output', () => directory),
    ).toMatchObject(preset);
    expect(
      getStateForAudioDevice(assignments, 'another', () => directory)
        .eqBandDesign,
    ).toBeUndefined();
    expect(
      validateState({ ...state, eqBandDesign: { ...design, bands: [] } }),
    ).toBe(false);
  });
});
