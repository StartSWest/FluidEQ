import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  AutoEqFormat,
  FilterTypeEnum,
  getDefaultState,
  IState,
  MAX_NUM_FILTERS,
} from 'common/constants';
import { validatePresetV2, validateState } from 'common/validator';
import { parseChainBundle, serializeChainBundle } from 'common/chainBundle';
import { adoptBlock, hasChainDrifted } from 'common/apoSync';
import { describeApoFeatureText } from 'common/apoFeatureSync';
import {
  getResolvedPreAmp,
  stateToApoFiles,
  stateToString,
} from 'main/apoRender';
import { fetchPreset, fetchSettings, save, savePreset } from 'main/flush';
import {
  deviceProfilesToFiles,
  getDefaultDeviceProfileSettings,
  getStateForAudioDevice,
} from 'main/deviceProfiles';
import { importEqFile } from 'main/importSettings';
import { getEqMode, TEqMode } from 'common/eqMode';
import expandApoConfig from '../../utils/apoConfig';

type DoubleState = IState & { isEqDoubleOn?: boolean };

const shaped = (): DoubleState => ({
  ...getDefaultState(),
  isEqDoubleOn: true,
  filters: {
    peak: {
      id: 'peak',
      type: FilterTypeEnum.PK,
      frequency: 1000,
      gain: 4,
      quality: 1,
    },
    pass: {
      id: 'pass',
      type: FilterTypeEnum.HPQ,
      frequency: 40,
      gain: 0,
      quality: 0.7,
    },
    disabled: {
      id: 'disabled',
      type: FilterTypeEnum.PK,
      frequency: 2000,
      gain: 12,
      quality: 1,
      isEnabled: false,
    },
    neutral: {
      id: 'neutral',
      type: FilterTypeEnum.PK,
      frequency: 4000,
      gain: 0,
      quality: 1,
    },
  },
});

const eqLines = (state: IState) =>
  stateToApoFiles(state)?.features.find(({ feature }) => feature === 'eq')
    ?.lines ?? [];

describe('Main EQ x2 rendering', () => {
  it('writes two complete unmodified passes in a single feature, without changing editable bands', () => {
    const state = shaped();
    const original = JSON.stringify(state.filters);
    const files = stateToApoFiles(state);
    expect(
      files?.features.filter(({ feature }) => feature === 'eq'),
    ).toHaveLength(1);
    expect(eqLines(state)).toEqual([
      'Filter 1: ON PK Fc 1000 Hz Gain 4 dB Q 1',
      'Filter 2: ON HPQ Fc 40 Hz Q 0.7',
      'Filter 3: ON PK Fc 1000 Hz Gain 4 dB Q 1',
      'Filter 4: ON HPQ Fc 40 Hz Q 0.7',
    ]);
    expect(JSON.stringify(state.filters)).toBe(original);
    expect(
      eqLines({ ...state, isEqDoubleOn: false } as DoubleState),
    ).toHaveLength(2);
    expect(
      eqLines({ ...state, isEqDoubleOn: undefined } as DoubleState),
    ).toHaveLength(2);
  });

  it.each(Object.values(FilterTypeEnum))(
    'repeats the actual %s filter rather than doubling its gain',
    (type) => {
      const state = shaped();
      state.filters = { peak: { ...state.filters.peak, type } };
      const single = eqLines({ ...state, isEqDoubleOn: false } as DoubleState);
      expect(single).toHaveLength(1);
      expect(eqLines(state)).toEqual([
        single[0],
        single[0].replace('Filter 1:', 'Filter 2:'),
      ]);
    },
  );

  it('duplicates GraphicEQ commands without duplicating their editable points', () => {
    const state = shaped();
    state.eqFormat = AutoEqFormat.GRAPHIC;
    state.graphicEq = [
      { frequency: 20, gain: 3 },
      { frequency: 20000, gain: 3 },
    ];
    expect(eqLines(state)).toEqual([
      'GraphicEQ: 20 3; 20000 3',
      'GraphicEQ: 20 3; 20000 3',
    ]);
    expect(state.graphicEq).toHaveLength(2);
    expect(getResolvedPreAmp(state)).toBeCloseTo(-6.2, 1);
    expect(
      getResolvedPreAmp({ ...state, isEqDoubleOn: false } as DoubleState),
    ).toBeCloseTo(-3.2, 1);
  });

  it('reserves headroom from both actual biquad passes', () => {
    const state = shaped();
    state.filters = { peak: state.filters.peak };
    expect(getResolvedPreAmp(state)).toBeCloseTo(-8.2, 1);
    expect(
      getResolvedPreAmp({ ...state, isEqDoubleOn: false } as DoubleState),
    ).toBeCloseTo(-4.2, 1);
  });

  it('reserves more than 20 dB for a fully boosted doubled EQ', () => {
    const state = shaped();
    state.filters = { peak: { ...state.filters.peak, gain: 20 } };
    expect(getResolvedPreAmp(state)).toBeCloseTo(-40.2, 1);
    state.eqFormat = AutoEqFormat.GRAPHIC;
    state.graphicEq = [
      { frequency: 20, gain: 20 },
      { frequency: 20000, gain: 20 },
    ];
    expect(getResolvedPreAmp(state)).toBeCloseTo(-40.2, 1);
  });

  it('doubles all EQ features and convolution but keeps manual preamp single', () => {
    const state: DoubleState = {
      ...shaped(),
      isAutoPreAmpOn: false,
      preAmp: -7,
      voicing: { profileId: 'music', intensity: 1 },
      driver: { profileId: 'balanced-armature-iem', intensity: 1 },
      headphone: { filters: shaped().filters, intensity: 1 },
      smartEq: { filters: shaped().filters },
      convolution: { name: 'IR', filters: {}, fileName: 'ir.wav' },
    };
    const single = stateToApoFiles(
      { ...state, isEqDoubleOn: false } as DoubleState,
      'ir.wav',
    );
    const double = stateToApoFiles(state, 'ir.wav');
    const otherFeatures = double?.features.filter(
      ({ feature }) => feature !== 'eq',
    );
    expect(otherFeatures?.map(({ feature }) => feature)).toEqual([
      'driver',
      'headphone',
      'voicing',
      'smart',
    ]);
    otherFeatures?.forEach(({ feature, lines }) => {
      const original =
        single?.features.find((entry) => entry.feature === feature)?.lines ??
        [];
      const withoutIndex = (line: string) =>
        line.replace(/Filter \d+:/, 'Filter:');
      expect(original.length).toBeGreaterThan(0);
      expect(lines.map(withoutIndex)).toEqual(
        [...original, ...original].map(withoutIndex),
      );
    });
    expect(double?.preAmp).toBe('Preamp: -7 dB');
    expect(double?.convolution).toBe(
      'Convolution: ir.wav\r\nConvolution: ir.wav',
    );
    expect(double?.custom).toBe(true);
    const flat = stateToString(state, 'ir.wav');
    expect(flat.match(/Preamp:/g)).toHaveLength(1);
    expect(flat.match(/Convolution:/g)).toHaveLength(2);
    const indices = [...flat.matchAll(/Filter (\d+):/g)].map((match) =>
      Number(match[1]),
    );
    expect(indices).toEqual(
      Array.from({ length: indices.length }, (_unused, index) => index + 1),
    );
  });

  it('suppresses both passes when flat, bypassed or disabled, and restores them unchanged', () => {
    const state = shaped();
    expect(eqLines(state)).toHaveLength(4);
    expect(eqLines({ ...state, isFlat: true })).toHaveLength(0);
    expect(eqLines({ ...state, bypassed: ['eq'] })).toHaveLength(0);
    expect(stateToApoFiles({ ...state, isEnabled: false })).toBeUndefined();
    expect(getResolvedPreAmp({ ...state, bypassed: ['eq'] })).toBe(0);
    expect(eqLines(state)).toHaveLength(4);
  });

  it('does not report its own two-pass file as external drift', () => {
    const state = shaped();
    const expected = stateToString(state);
    const adopted = adoptBlock({ devicePattern: 'all', text: expected });
    expect(adopted).toBeDefined();
    if (!adopted) {
      throw new Error('No audible chain was parsed');
    }
    expect(hasChainDrifted(expected, adopted)).toBe(false);
    const rendered = eqLines(state).join('\n');
    const single = eqLines({
      ...state,
      isEqDoubleOn: false,
    } as DoubleState).join('\n');
    expect(describeApoFeatureText(rendered)).not.toBe(
      describeApoFeatureText(single),
    );
  });

  it('writes both passes even at the editable band limit', () => {
    const state = shaped();
    state.filters = Object.fromEntries(
      Array.from({ length: MAX_NUM_FILTERS }, (_unused, index) => {
        const id = `band-${index}`;
        return [id, { ...state.filters.peak, id, frequency: 100 + index * 10 }];
      }),
    );
    expect(eqLines(state)).toHaveLength(MAX_NUM_FILTERS * 2);
  });
});

describe('Main EQ x2 persistence', () => {
  let directory: string;
  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-eq-double-'));
  });
  afterEach(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it.each<TEqMode>(['normal', 'double', 'studio'])(
    'round-trips %s through state recovery, profile files, bundles, imports and output switching',
    async (eqMode) => {
      const state: IState = {
        ...shaped(),
        eqMode,
        isEqDoubleOn: eqMode !== 'double',
      };
      await save(state, directory);
      await savePreset('Mode', state, directory);
      expect(getEqMode(fetchSettings(directory))).toBe(eqMode);
      const preset = fetchPreset('Mode', directory);
      expect(getEqMode(preset)).toBe(eqMode);
      expect(getEqMode(importEqFile(path.join(directory, 'Mode')))).toBe(
        eqMode,
      );
      const bundle = parseChainBundle(
        JSON.parse(serializeChainBundle({ version: 1, preset })),
      );
      expect(bundle?.preset.eqMode).toBe(eqMode);
      const settings = getDefaultDeviceProfileSettings();
      settings.assignments.output = {
        deviceId: 'output',
        deviceName: 'Output',
        deviceGuid: '{OUTPUT}',
        presetName: 'Mode',
      };
      const loaded = getStateForAudioDevice(
        settings,
        'output',
        () => directory,
      );
      expect(getEqMode(loaded)).toBe(eqMode);
      expect(loaded.isEqDoubleOn).toBe(eqMode === 'double');
      Object.assign(
        loaded,
        getStateForAudioDevice(settings, 'empty', () => directory),
      );
      expect(getEqMode(loaded)).toBe('normal');
      fs.writeFileSync(
        path.join(directory, 'state.txt'),
        JSON.stringify({ ...state, isGraphViewOn: 'invalid' }),
      );
      expect(getEqMode(fetchSettings(directory))).toBe(eqMode);
    },
  );

  it.each([true, false, undefined])(
    'round-trips state, profiles, chain bundles and JSON EQ import with %s',
    async (isEqDoubleOn) => {
      const state = { ...shaped(), isEqDoubleOn };
      await save(state, directory);
      await savePreset('Double', state, directory);
      expect(fetchSettings(directory).isEqDoubleOn ?? false).toBe(
        isEqDoubleOn ?? false,
      );
      const preset = fetchPreset('Double', directory);
      expect(preset.isEqDoubleOn ?? false).toBe(isEqDoubleOn ?? false);
      const bundle = parseChainBundle(
        JSON.parse(serializeChainBundle({ version: 1, preset })),
      );
      expect(bundle?.preset.isEqDoubleOn ?? false).toBe(isEqDoubleOn ?? false);
      expect(
        importEqFile(path.join(directory, 'Double')).isEqDoubleOn ?? false,
      ).toBe(isEqDoubleOn ?? false);
    },
  );

  it('preserves the switch through state recovery and disables malformed switches', () => {
    fs.writeFileSync(
      path.join(directory, 'state.txt'),
      JSON.stringify({ ...shaped(), isGraphViewOn: 'invalid' }),
    );
    expect(fetchSettings(directory).isEqDoubleOn).toBe(true);
    fs.writeFileSync(
      path.join(directory, 'state.txt'),
      JSON.stringify({ ...shaped(), isEqDoubleOn: 'true' }),
    );
    expect(fetchSettings(directory).isEqDoubleOn ?? false).toBe(false);
  });

  it('restores per-output x2 without leaking it onto legacy or unassigned outputs', async () => {
    const settings = getDefaultDeviceProfileSettings();
    await savePreset('Double', shaped(), directory);
    await savePreset(
      'Legacy',
      { ...shaped(), isEqDoubleOn: undefined },
      directory,
    );
    settings.assignments.double = {
      deviceId: 'double',
      deviceName: 'Double',
      deviceGuid: '{DOUBLE}',
      presetName: 'Double',
    };
    settings.assignments.legacy = {
      deviceId: 'legacy',
      deviceName: 'Legacy',
      deviceGuid: '{LEGACY}',
      presetName: 'Legacy',
    };
    const live = getStateForAudioDevice(settings, 'double', () => directory);
    expect(live.isEqDoubleOn).toBe(true);
    const files = deviceProfilesToFiles(settings, () => directory);
    const expanded = expandApoConfig(files);
    expect(expanded.match(/Fc 1000 Hz Gain 4 dB/g)).toHaveLength(3);
    Object.assign(
      live,
      getStateForAudioDevice(settings, 'legacy', () => directory),
    );
    expect(live.isEqDoubleOn).toBe(false);
    Object.assign(
      live,
      getStateForAudioDevice(settings, 'double', () => directory),
    );
    expect(live.isEqDoubleOn).toBe(true);
    Object.assign(
      live,
      getStateForAudioDevice(settings, 'unassigned', () => directory),
    );
    expect(live.isEqDoubleOn).toBe(false);
  });

  it.each(['true', 1, null, {}, []])(
    'rejects non-boolean flags in state and preset schemas: %p',
    (isEqDoubleOn) => {
      expect(validateState({ ...shaped(), isEqDoubleOn })).toBe(false);
      expect(validatePresetV2({ ...shaped(), isEqDoubleOn })).toBe(false);
    },
  );

  it.each([true, false, undefined])(
    'accepts boolean and legacy flags: %s',
    (isEqDoubleOn) => {
      expect(validateState({ ...shaped(), isEqDoubleOn })).toBe(true);
      expect(validatePresetV2({ ...shaped(), isEqDoubleOn })).toBe(true);
    },
  );
});
