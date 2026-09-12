import { FilterTypeEnum, getDefaultState, IState } from 'common/constants';
import { getCurveEqMode, getEqMode, TEqMode } from 'common/eqMode';
import {
  getResolvedPreAmp,
  stateToApoFiles,
  serializeState,
} from 'main/apoRender';
import { validatePresetV2, validateState } from 'common/validator';

const modes: TEqMode[] = ['normal', 'studio', 'double'];
const stateFor = (eqMode: TEqMode, curveEqMode: TEqMode): IState => ({
  ...getDefaultState(),
  eqMode,
  curveEqMode,
  isAutoPreAmpOn: false,
  filters: {
    own: {
      id: 'own',
      frequency: 1000,
      gain: 4,
      quality: 1,
      type: FilterTypeEnum.PK,
    },
  },
  headphone: {
    intensity: 1,
    filters: {
      correction: {
        id: 'correction',
        frequency: 2000,
        gain: -4,
        quality: 2,
        type: FilterTypeEnum.PK,
      },
    },
  },
});

describe('independent EQ mode groups', () => {
  it.each(modes.flatMap((eq) => modes.map((curves) => [eq, curves] as const)))(
    'renders and persists Your EQ=%s independently of Curves=%s',
    (eqMode, curveEqMode) => {
      const state = stateFor(eqMode, curveEqMode);
      const output = stateToApoFiles(state);
      const own = output?.features.find(
        (feature) => feature.feature === 'eq',
      )?.lines;
      const correction = output?.features.find(
        (feature) => feature.feature === 'headphone',
      )?.lines;
      expect(own).toHaveLength(eqMode === 'double' ? 2 : 1);
      expect(correction).toHaveLength(curveEqMode === 'double' ? 2 : 1);
      expect(own?.[0]).toContain(`Gain ${eqMode === 'studio' ? 6 : 4} dB`);
      expect(correction?.[0]).toContain(
        `Gain ${curveEqMode === 'studio' ? -6 : -4} dB`,
      );
      expect(output?.preAmp).toBe('Preamp: 0 dB');
      expect(validateState(state)).toBe(true);
      expect(validatePresetV2(state)).toBe(true);
      const restored = JSON.parse(serializeState(state));
      expect(getEqMode(restored)).toBe(eqMode);
      expect(getCurveEqMode(restored)).toBe(curveEqMode);
      expect(state.filters.own.gain).toBe(4);
    },
  );
  it('preserves legacy curves while honoring an explicit Normal override', () => {
    expect(getCurveEqMode({ eqMode: 'studio' })).toBe('studio');
    expect(getCurveEqMode({ isEqDoubleOn: true })).toBe('double');
    expect(getCurveEqMode({ eqMode: 'double', curveEqMode: 'normal' })).toBe(
      'normal',
    );
    expect(
      validateState({
        ...stateFor('normal', 'normal'),
        curveEqMode: 'invalid',
      }),
    ).toBe(false);
  });
  it('uses Curves strength, not Your EQ strength, for convolution', () => {
    const state = stateFor('double', 'normal');
    state.convolution = {
      name: 'IR',
      fileName: 'impulse.wav',
      response: [
        { frequency: 20, gain: 4 },
        { frequency: 20000, gain: 4 },
      ],
    } as IState['convolution'];
    expect(stateToApoFiles(state, 'impulse.wav')?.convolution).toBe(
      'Convolution: impulse.wav',
    );
    state.curveEqMode = 'double';
    expect(stateToApoFiles(state, 'impulse.wav')?.convolution).toBe(
      'Convolution: impulse.wav\r\nConvolution: impulse.wav',
    );
    state.curveEqMode = 'studio';
    expect(stateToApoFiles(state, 'impulse.wav')?.convolution).toBe(
      'Convolution: impulse.wav\r\nGraphicEQ: 20 2; 20000 2',
    );
    state.filters = {};
    state.headphone = undefined;
    state.isAutoPreAmpOn = true;
    expect(getResolvedPreAmp(state)).toBeCloseTo(-6.2, 1);
  });
});
