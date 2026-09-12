import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  AutoEqFormat,
  getDefaultState,
  IState,
  MAX_NUM_FILTERS,
} from 'common/constants';
import {
  adoptApoFeatureText,
  describeApoFeatureText,
} from 'common/apoFeatureSync';
import { createApoAdoption } from 'main/apoAdopt';
import { stateToApoFiles, stateToString } from 'main/apoRender';
import { flushPendingWrites } from 'main/asyncWriter';
import { getEqMode } from 'common/eqMode';
import {
  deviceProfilesToFiles,
  getDefaultDeviceProfileSettings,
} from 'main/deviceProfiles';

const shaped = (): IState => {
  const state = getDefaultState();
  const band = Object.values(state.filters)[0];
  state.filters = {
    [band.id]: { ...band, frequency: 1000, gain: 4, quality: 1 },
  };
  state.isEqDoubleOn = true;
  state.isAutoPreAmpOn = false;
  state.preAmp = -8;
  return state;
};
const eqText = (state: IState) =>
  stateToApoFiles(state)
    ?.features.find(({ feature }) => feature === 'eq')
    ?.lines.join('\n') ?? '';

describe('two-pass external EQ adoption', () => {
  it.each(['double', 'studio'] as const)(
    'refuses external curve edits that would reset other strengthened layers in %s',
    (eqMode) => {
      const state = shaped();
      state.eqMode = eqMode;
      state.headphone = { intensity: 1, filters: state.filters };
      const before = JSON.stringify(state);
      const external = 'Filter 1: ON PK Fc 1000 Hz Gain 6 dB Q 1';
      expect(
        adoptApoFeatureText(state, 'eq', external).unsupported,
      ).toBeGreaterThan(0);
      expect(
        adoptApoFeatureText(state, 'headphone', external).unsupported,
      ).toBeGreaterThan(0);
      expect(JSON.stringify(state)).toBe(before);
      state.eqMode = 'normal';
      expect(adoptApoFeatureText(state, 'headphone', external).changed).toBe(
        true,
      );
    },
  );
  it.each(['double', 'studio'] as const)(
    'does not adopt generated %s output as new editable input',
    (eqMode) => {
      const state = shaped();
      state.eqMode = eqMode;
      Object.values(state.filters)[0].gain = 20;
      const before = JSON.stringify(state);
      const expected = eqText(state);
      expect(
        adoptApoFeatureText(
          state,
          'eq',
          `# generated header\n${expected}`,
          expected,
        ),
      ).toEqual({ changed: false, unsupported: 0 });
      expect(JSON.stringify(state)).toBe(before);
    },
  );

  it('resets Studio to Normal for an actual representable external replacement', () => {
    const state = shaped();
    state.eqMode = 'studio';
    const expected = eqText(state);
    const external = 'Filter 1: ON PK Fc 1000 Hz Gain 11 dB Q 1.73';
    expect(adoptApoFeatureText(state, 'eq', external, expected).changed).toBe(
      true,
    );
    expect(getEqMode(state)).toBe('normal');
    expect(eqText(state)).toBe(external);
  });
  it('retains both externally edited biquads exactly once and stops subsequent growth', () => {
    const state = shaped();
    const external = eqText(state).replace(
      'Filter 2: ON PK Fc 1000 Hz Gain 4',
      'Filter 2: ON PK Fc 1000 Hz Gain 7',
    );
    expect(adoptApoFeatureText(state, 'eq', external)).toEqual({
      changed: true,
      unsupported: 0,
    });
    expect(state.isEqDoubleOn).toBe(false);
    expect(Object.values(state.filters).map(({ gain }) => gain)).toEqual([
      4, 7,
    ]);
    expect(describeApoFeatureText(eqText(state))).toBe(
      describeApoFeatureText(external),
    );
    adoptApoFeatureText(state, 'eq', eqText(state));
    expect(Object.values(state.filters)).toHaveLength(2);
    expect(eqText(state).match(/Filter /g)).toHaveLength(2);
  });

  it('adopts a deliberate single GraphicEQ replacement without leaving x2 enabled', () => {
    const state = shaped();
    const external = 'GraphicEQ: 20 3; 1000 -2; 20000 1';
    expect(adoptApoFeatureText(state, 'eq', external).changed).toBe(true);
    expect(state.isEqDoubleOn).toBe(false);
    expect(eqText(state)).toBe(external);
  });

  it.each([
    'GraphicEQ: 20 3; 20000 1\nGraphicEQ: 20 4; 20000 -2',
    'GraphicEQ: 20 3; 20000 1\nFilter 1: ON PK Fc 1000 Hz Gain 2 dB Q 1',
    'Filter 1: ON PK Fc 1000 Hz Gain 31 dB Q 1',
    'Filter 1: ON PK Fc 1000 Hz Gain 2 dB Q 1\nCopy: L=R',
  ])(
    'refuses unrepresentable stages without mutating live state: %s',
    (external) => {
      const state = shaped();
      const before = JSON.stringify(state);
      expect(
        adoptApoFeatureText(state, 'eq', external).unsupported,
      ).toBeGreaterThan(0);
      expect(JSON.stringify(state)).toBe(before);
    },
  );

  it('distinguishes separate GraphicEQ stages from concatenated points', () => {
    const stages = 'GraphicEQ: 20 3; 20000 1\nGraphicEQ: 20 4; 20000 -2';
    const concatenated = 'GraphicEQ: 20 3; 20000 1; 20 4; 20000 -2';
    expect(describeApoFeatureText(stages)).not.toBe(
      describeApoFeatureText(concatenated),
    );
    expect(describeApoFeatureText(stages)).toBe(
      describeApoFeatureText(`# external comment\n${stages}`),
    );
  });
});

describe('startup adoption of x2 output', () => {
  let directory: string;
  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-double-adopt-'));
  });
  afterEach(async () => {
    await flushPendingWrites();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  const adopt = (state: IState, text?: string) => {
    if (text !== undefined) {
      fs.writeFileSync(path.join(directory, 'fluideq.txt'), text);
    }
    const adoption = createApoAdoption({
      state,
      userDataDir: directory,
      session: {
        configPath: directory,
        activeAudioDeviceId: 'output',
        activeAudioDevice: {
          id: 'output',
          name: 'Output',
          guid: '{OUTPUT}',
          isDefault: true,
          isActive: true,
        },
        hasActiveSessionOverride: false,
      },
      hydrateActiveConvolution: jest.fn(),
    });
    return adoption.adoptExistingApoConfig();
  };

  it('keeps the single editable curve through split-file startup and detects a real second-pass edit', () => {
    const state = shaped();
    const original = state.filters;
    const files = deviceProfilesToFiles(
      getDefaultDeviceProfileSettings(),
      () => directory,
      undefined,
      { deviceId: 'output', devicePattern: '{OUTPUT}', state },
    );
    files.forEach((contents, name) => {
      fs.writeFileSync(path.join(directory, name), contents);
    });
    adopt(state);
    expect(state.filters).toBe(original);
    const eqFile = [...files.keys()].find((name) => name.endsWith('-eq.txt'));
    expect(eqFile).toBeDefined();
    if (!eqFile) {
      throw new Error('No EQ file was generated');
    }
    const filePath = path.join(directory, eqFile);
    fs.writeFileSync(
      filePath,
      fs
        .readFileSync(filePath, 'utf8')
        .replace(
          'Filter 2: ON PK Fc 1000 Hz Gain 4',
          'Filter 2: ON PK Fc 1000 Hz Gain 7',
        ),
    );
    adopt(state);
    expect(getEqMode(state)).toBe('normal');
    expect(Object.values(state.filters).map(({ gain }) => gain)).toEqual([
      4, 7,
    ]);
  });

  it.each([AutoEqFormat.PARAMETRIC, AutoEqFormat.GRAPHIC])(
    'never adopts its own generated %s passes, even when only the preamp changes',
    (format) => {
      const state = shaped();
      state.eqFormat = format;
      if (format === AutoEqFormat.GRAPHIC) {
        state.graphicEq = [
          { frequency: 20, gain: 4 },
          { frequency: 20000, gain: 4 },
        ];
      }
      const originalFilters = state.filters;
      const originalPoints = state.graphicEq;
      const generated = stateToString(state, undefined, '{OUTPUT}');
      adopt(state, generated);
      expect(state.filters).toBe(originalFilters);
      adopt(state, generated.replace('Preamp: -8 dB', 'Preamp: -11 dB'));
      expect(state.preAmp).toBe(-11);
      expect(state.filters).toBe(originalFilters);
      expect(state.graphicEq).toBe(originalPoints);
      expect(state.isEqDoubleOn).toBe(true);
      expect(eqText(state)).toBe(
        eqText({
          ...state,
          filters: originalFilters,
          graphicEq: originalPoints,
        }),
      );
    },
  );

  it('adopts an actual combined parametric edit with x2 off', () => {
    const state = shaped();
    const external = stateToString(state, undefined, '{OUTPUT}').replace(
      'Filter 2: ON PK Fc 1000 Hz Gain 4',
      'Filter 2: ON PK Fc 1000 Hz Gain 7',
    );
    adopt(state, external);
    expect(state.isEqDoubleOn).toBe(false);
    expect(Object.values(state.filters).map(({ gain }) => gain)).toEqual([
      4, 7,
    ]);
  });

  it('refuses partial adoption and signals callers not to overwrite unrepresentable stages', () => {
    const state = shaped();
    const before = JSON.stringify(state);
    const external =
      'Device: {OUTPUT}\nGraphicEQ: 20 3; 20000 1\nGraphicEQ: 20 4; 20000 -2\nPreamp: -11 dB';
    expect(adopt(state, external)).toBe(false);
    expect(JSON.stringify(state)).toBe(before);
    expect(fs.readFileSync(path.join(directory, 'fluideq.txt'), 'utf8')).toBe(
      external,
    );
  });

  it('compares every generated band beyond the editable limit before adopting a preamp edit', () => {
    const state = shaped();
    const band = Object.values(state.filters)[0];
    state.filters = Object.fromEntries(
      Array.from({ length: MAX_NUM_FILTERS }, (_unused, index) => [
        `band-${index}`,
        { ...band, id: `band-${index}`, frequency: 100 + index * 10 },
      ]),
    );
    const original = state.filters;
    adopt(
      state,
      stateToString(state, undefined, '{OUTPUT}').replace(
        'Preamp: -8 dB',
        'Preamp: -11 dB',
      ),
    );
    expect(state.preAmp).toBe(-11);
    expect(state.filters).toBe(original);
    expect(state.isEqDoubleOn).toBe(true);
    expect(eqText(state).match(/Filter /g)).toHaveLength(MAX_NUM_FILTERS * 2);
  });
});
