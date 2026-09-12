import {
  AutoEqFormat,
  FilterTypeEnum,
  getDefaultState,
  IFilter,
  IState,
} from 'common/constants';
import {
  getEqMode,
  getStudioEqFilters,
  getStudioEqGraphic,
  TEqMode,
} from 'common/eqMode';
import { validatePresetV2, validateState } from 'common/validator';
import { getResolvedPreAmp, stateToApoFiles } from 'main/apoRender';
import { getTFCoefficients } from 'common/response';
import { biquadCoefficients } from 'renderer/dsp/biquad';

const band = (type = FilterTypeEnum.PK, gain = 12): IFilter => ({
  id: 'band',
  type,
  gain,
  quality: 1,
  frequency: 1000,
});
const stateFor = (eqMode: TEqMode): IState => ({
  ...getDefaultState(),
  eqMode,
  filters: { band: band() },
});
const lines = (state: IState) =>
  stateToApoFiles(state)?.features.find(({ feature }) => feature === 'eq')
    ?.lines ?? [];

describe('EQ mode contract', () => {
  it.each<TEqMode>(['normal', 'double', 'studio'])(
    'prefers explicit %s over a contradictory legacy flag',
    (eqMode) => {
      expect(getEqMode({ eqMode, isEqDoubleOn: true })).toBe(eqMode);
      expect(getEqMode({ eqMode, isEqDoubleOn: false })).toBe(eqMode);
    },
  );
  it('falls back to the old x2 flag and treats legacy absence as normal', () => {
    expect(getEqMode({ isEqDoubleOn: true })).toBe('double');
    expect(getEqMode({})).toBe('normal');
    expect(
      getEqMode({ eqMode: 'invalid' as TEqMode, isEqDoubleOn: true }),
    ).toBe('double');
  });
  it.each<TEqMode>(['normal', 'double', 'studio'])(
    'validates %s in both persisted schemas',
    (eqMode) => {
      expect(validateState(stateFor(eqMode))).toBe(true);
      expect(validatePresetV2(stateFor(eqMode))).toBe(true);
    },
  );
  it.each(['other', true, 1, null])(
    'rejects invalid persisted mode %p',
    (eqMode) => {
      expect(validateState({ ...getDefaultState(), eqMode })).toBe(false);
      expect(validatePresetV2({ preAmp: 0, filters: {}, eqMode })).toBe(false);
    },
  );
});

describe('Studio curve law', () => {
  it.each([FilterTypeEnum.LSC, FilterTypeEnum.HSC])(
    'keeps %s coefficients finite and poles stable across the UI Q range at +/-30 dB',
    (type) => {
      [0.01, 0.1, 0.5, 0.71, 1, 2, 3, 10, 20, 33.3333].forEach((quality) => {
        [-20, -12, 0, 12, 20].forEach((gain) => {
          const effective = getStudioEqFilters([
            { ...band(type, gain), quality },
          ])[0];
          expect(effective.quality).toBe(Math.round(quality * 100) / 100);
          [20, 1000, 20000].forEach((frequency) => {
            [44100, 48000, 96000, 192000].forEach((sampleRate) => {
              const coefficients = getTFCoefficients(
                { ...effective, frequency },
                sampleRate,
              );
              const reference = biquadCoefficients(
                {
                  type,
                  frequency,
                  quality: effective.quality,
                  gainDb: effective.gain,
                },
                sampleRate,
              );
              (['b0', 'b1', 'b2', 'a1', 'a2'] as const).forEach((key) => {
                expect(coefficients[key]).toBeCloseTo(reference[key], 12);
              });
              expect(Object.values(coefficients).every(Number.isFinite)).toBe(
                true,
              );
              expect(Math.abs(coefficients.a2)).toBeLessThan(1);
              expect(1 + coefficients.a1 + coefficients.a2).toBeGreaterThan(0);
              expect(1 - coefficients.a1 + coefficients.a2).toBeGreaterThan(0);
            });
          });
        });
      });
    },
  );
  it('scales gain by 1.5 and moderately tightens PK Q, preserving the editable band', () => {
    const original = band();
    expect(getStudioEqFilters([original])).toEqual([
      { ...original, gain: 18, quality: 1.41 },
    ]);
    expect(original.gain).toBe(12);
    expect(original.quality).toBe(1);
    expect(getStudioEqFilters([band(FilterTypeEnum.PK, -12)])[0]).toMatchObject(
      { gain: -18, quality: 1.41 },
    );
  });
  it.each([FilterTypeEnum.LSC, FilterTypeEnum.HSC])(
    'does not change %s shelf Q',
    (type) => {
      const original = { ...band(type), quality: 0.73 };
      expect(getStudioEqFilters([original])[0]).toEqual({
        ...original,
        gain: 18,
      });
    },
  );
  it.each([
    FilterTypeEnum.NO,
    FilterTypeEnum.BP,
    FilterTypeEnum.HPQ,
    FilterTypeEnum.LPQ,
  ])('leaves non-gain %s filters unchanged', (type) => {
    expect(getStudioEqFilters([band(type)])[0]).toEqual(band(type));
  });
  it('bounds source gains before scaling and bounds and rounds effective PK quality', () => {
    expect(
      getStudioEqFilters([{ ...band(), gain: 100, quality: 100 }])[0],
    ).toMatchObject({ gain: 30, quality: 33.33 });
    expect(getStudioEqFilters([band(FilterTypeEnum.PK, -100)])[0].gain).toBe(
      -30,
    );
    expect(getStudioEqFilters([band(FilterTypeEnum.PK, 1.234)])[0].gain).toBe(
      1.85,
    );
  });
  it('scales graphic gains by 1.5 once, without creating Q or modifying input points', () => {
    const points = [
      { frequency: 20, gain: 20 },
      { frequency: 20000, gain: -12 },
    ];
    expect(getStudioEqGraphic(points)).toEqual([
      { frequency: 20, gain: 30 },
      { frequency: 20000, gain: -18 },
    ]);
    expect(points[0].gain).toBe(20);
  });
});

describe('mode rendering', () => {
  it.each(['double', 'studio'] as const)(
    'strengthens a correction even with no editable bands in %s',
    (eqMode) => {
      const state = {
        ...stateFor(eqMode),
        isFlat: true,
        filters: {},
        headphone: { filters: { band: band() }, intensity: 1 },
      };
      const output = stateToApoFiles(state);
      expect(output?.features.map(({ feature }) => feature)).toEqual([
        'headphone',
      ]);
      expect(output?.features[0].lines).toHaveLength(
        eqMode === 'double' ? 2 : 1,
      );
      expect(getResolvedPreAmp(state)).toBeLessThan(
        eqMode === 'double' ? -23.9 : -17.9,
      );
      expect(getResolvedPreAmp({ ...state, eqMode: 'normal' })).toBeGreaterThan(
        -12.3,
      );
    },
  );

  it.each(['double', 'studio'] as const)(
    'strengthens custom EQ without rewriting or doubling its preamp in %s',
    (eqMode) => {
      const customFx = {
        fileName: 'custom.txt',
        filters: {},
        preAmp: 2,
        graphicEq: [
          { frequency: 20, gain: 4 },
          { frequency: 20000, gain: 4 },
        ],
      };
      const state = {
        ...stateFor(eqMode),
        filters: {},
        isFlat: true,
        customFx,
      };
      expect(stateToApoFiles(state)?.customEqCompensation).toEqual([
        eqMode === 'double'
          ? 'GraphicEQ: 20 4; 20000 4'
          : 'GraphicEQ: 20 2; 20000 2',
      ]);
      expect(getResolvedPreAmp(state)).toBeCloseTo(
        eqMode === 'double' ? -10.2 : -8.2,
        1,
      );
      expect(
        stateToApoFiles({ ...state, eqMode: 'normal' })?.customEqCompensation,
      ).toEqual([]);
      expect(customFx.graphicEq[0].gain).toBe(4);
    },
  );
  it('keeps Normal, exact x2 and Studio mutually exclusive', () => {
    expect(lines(stateFor('normal'))).toEqual([
      'Filter 1: ON PK Fc 1000 Hz Gain 12 dB Q 1',
    ]);
    expect(lines(stateFor('double'))).toEqual([
      'Filter 1: ON PK Fc 1000 Hz Gain 12 dB Q 1',
      'Filter 2: ON PK Fc 1000 Hz Gain 12 dB Q 1',
    ]);
    expect(lines(stateFor('studio'))).toEqual([
      'Filter 1: ON PK Fc 1000 Hz Gain 18 dB Q 1.41',
    ]);
    expect(lines({ ...stateFor('studio'), isEqDoubleOn: true })).toHaveLength(
      1,
    );
    expect(lines({ ...stateFor('normal'), isEqDoubleOn: true })).toHaveLength(
      1,
    );
  });
  it('reserves Studio headroom above 20 dB from the rendered coefficients', () => {
    const state = stateFor('studio');
    state.filters.band.gain = 20;
    expect(lines(state)[0]).toContain('Gain 30 dB Q 1.63');
    expect(getResolvedPreAmp(state)).toBeCloseTo(-30.2, 1);
  });
  it('emits one graphic stage at 1.5 strength and reserves its complete headroom', () => {
    const state = stateFor('studio');
    state.eqFormat = AutoEqFormat.GRAPHIC;
    state.graphicEq = [
      { frequency: 20, gain: 20 },
      { frequency: 20000, gain: 20 },
    ];
    expect(lines(state)).toEqual(['GraphicEQ: 20 30; 20000 30']);
    expect(getResolvedPreAmp(state)).toBeCloseTo(-30.2, 1);
  });
  it('transforms headphone correction as well as main EQ and retains bypass behavior', () => {
    const state = stateFor('studio');
    state.headphone = { filters: { band: band() }, intensity: 1 };
    const features = stateToApoFiles(state)?.features;
    expect(
      features?.find(({ feature }) => feature === 'headphone')?.lines[0],
    ).toContain('Gain 18 dB Q 1.41');
    expect(lines({ ...state, bypassed: ['eq'] })).toEqual([]);
    expect(lines({ ...state, isFlat: true })).toEqual([]);
    expect(state.filters.band).toEqual(band());
  });
});
