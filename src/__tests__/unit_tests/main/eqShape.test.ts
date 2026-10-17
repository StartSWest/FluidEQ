import {
  curveSmoothingOf,
  DEFAULT_CURVE_SMOOTHING,
  shapeEqFilters,
  smoothEqCurve,
  filterSmoothingCorrection,
} from 'common/eqShape';
import {
  getAppliedEqFilters,
  convolutionCorrection,
  getBandQ,
} from 'common/eqMode';
import {
  FilterTypeEnum,
  getDefaultState,
  IState,
  AutoEqFormat,
} from 'common/constants';
import { stateToApoFiles, serializeState } from 'main/apoRender';
import { validateState, validatePresetV2 } from 'common/validator';

const band = {
  id: 'test',
  type: FilterTypeEnum.PK,
  frequency: 1000,
  gain: 12,
  quality: 1,
};
const curve = [
  { frequency: 500, gain: 0 },
  { frequency: 990, gain: 0 },
  { frequency: 1000, gain: 12 },
  { frequency: 1010, gain: 0 },
  { frequency: 2000, gain: 0 },
];

describe('independent EQ shaping', () => {
  it('preserves original bands and separates Q from strength', () => {
    expect(shapeEqFilters([band], 'off')[0]).toBe(band);
    expect(shapeEqFilters([band], 'proportional')[0].quality).toBe(1.41);
    expect(shapeEqFilters([band], 'asymmetric')[0].quality).toBe(0.71);
    expect(
      shapeEqFilters([{ ...band, gain: -12 }], 'asymmetric')[0].quality,
    ).toBe(1.41);
    expect(getAppliedEqFilters([band], 'studio', 'off')[0]).toMatchObject({
      gain: 18,
      quality: 1,
    });
    const doubled = getAppliedEqFilters([band], 'double', 'asymmetric');
    expect(doubled).toHaveLength(2);
    expect(doubled[0]).toEqual(doubled[1]);
    expect(doubled[0]).toMatchObject({ gain: 12, quality: 0.71 });
    expect(band.quality).toBe(1);
    const personal = [
      { ...band, quality: 0.4 },
      { ...band, quality: 7 },
    ];
    expect(shapeEqFilters(personal, 'off')).toEqual(personal);
    (['eq', 'curves'] as const).forEach((scope) => {
      (['off', 'constant', 'fixed'] as const).forEach((legacy) => {
        const shape = getBandQ({ eqBandQ: legacy, curveBandQ: legacy }, scope);
        expect(shape).toBe('off');
        expect(shapeEqFilters(personal, shape)).toEqual(personal);
      });
    });
    expect(getBandQ({ eqBandQ: 'constant' }, 'eq')).toBe('off');
    expect(getBandQ({ eqMode: 'studio' }, 'eq')).toBe('proportional');
    expect(getBandQ({ eqMode: 'studio', eqBandQ: 'off' }, 'eq')).toBe('off');
  });

  it.each([
    FilterTypeEnum.LSC,
    FilterTypeEnum.HSC,
    FilterTypeEnum.LPQ,
    FilterTypeEnum.HPQ,
    FilterTypeEnum.NO,
  ])('does not change Q of non-bell %s filters', (type) => {
    expect(shapeEqFilters([{ ...band, type }], 'asymmetric')[0].quality).toBe(
      1,
    );
  });

  it('smooths the actual curve with octave widths, not a sample-count average', () => {
    expect(smoothEqCurve(curve, 'off')).toBe(curve);
    const narrow = smoothEqCurve(curve, 'twelfth');
    const broad = smoothEqCurve(curve, 'third');
    expect(narrow[2].gain).toBeLessThan(12);
    expect(narrow[2].gain).toBeGreaterThan(broad[2].gain);
    const flat = curve.map((point) => ({ ...point, gain: -3 }));
    smoothEqCurve(flat, 'third').forEach((point) =>
      expect(point.gain).toBeCloseTo(-3, 10),
    );
    const inserted = { frequency: Math.sqrt(500 * 990), gain: 0 };
    const dense = smoothEqCurve(
      [curve[0], inserted, ...curve.slice(1)],
      'third',
    );
    expect(dense.find((point) => point.frequency === 1000)?.gain).toBeCloseTo(
      broad[2].gain,
      10,
    );
    expect(curve[2].gain).toBe(12);
  });

  it('renders Q independently for main bands and correction bands and persists every choice', () => {
    const state: IState = {
      ...getDefaultState(),
      eqMode: 'normal',
      curveEqMode: 'normal',
      eqBandQ: 'asymmetric',
      curveBandQ: 'proportional',
      curveSmoothing: 'third',
      filters: { test: band },
      headphone: { filters: { test: band }, intensity: 1 },
    };
    const rendered = stateToApoFiles(state);
    expect(
      rendered?.features.find((feature) => feature.feature === 'eq')?.lines[0],
    ).toContain('Q 0.71');
    expect(
      rendered?.features.find((feature) => feature.feature === 'headphone')
        ?.lines[0],
    ).toContain('Q 1.41');
    expect(JSON.parse(serializeState(state))).toMatchObject({
      eqBandQ: 'asymmetric',
      curveBandQ: 'proportional',
      curveSmoothing: 'third',
    });
    expect(validateState(state)).toBe(true);
    expect(validatePresetV2(state)).toBe(true);
    expect(validateState({ ...state, curveSmoothing: 'invalid' })).toBe(false);
    expect(validatePresetV2({ ...state, eqBandQ: 'invalid' })).toBe(false);
  });

  it('changes rendered graphic correction audio without smoothing the main EQ', () => {
    const state: IState = {
      ...getDefaultState(),
      eqFormat: AutoEqFormat.GRAPHIC,
      graphicEq: curve,
      headphone: { graphicEq: curve, filters: {}, intensity: 1 },
      curveSmoothing: 'third',
    };
    const rendered = stateToApoFiles(state);
    expect(
      rendered?.features.find((feature) => feature.feature === 'eq')?.lines[0],
    ).toContain('1000 12');
    expect(
      rendered?.features.find((feature) => feature.feature === 'headphone')
        ?.lines[0],
    ).not.toContain('1000 12');
  });

  it('compensates original convolution audio rather than only smoothing its graph', () => {
    const profile = {
      fileName: 'impulse.wav',
      response: curve,
    } as IState['convolution'];
    const correction = convolutionCorrection(profile, 'normal', 'off', 'third');
    expect(correction[2].gain + 12).toBeCloseTo(
      smoothEqCurve(curve, 'third')[2].gain,
      9,
    );
    const state = {
      ...getDefaultState(),
      convolution: profile,
      curveSmoothing: 'third' as const,
    };
    const output = stateToApoFiles(state, 'impulse.wav')?.convolution;
    expect(output).toContain('Convolution: impulse.wav');
    expect(output).toContain('GraphicEQ:');
    // Off corrects nothing, and Off is what nothing chosen is.
    expect(convolutionCorrection(profile, 'normal', 'off', 'off')).toEqual([]);
    expect(convolutionCorrection(profile, 'normal')).toEqual([]);
    // CONTROL: smoothed, the same audio does get a correction.
    expect(
      convolutionCorrection(profile, 'normal', 'off', 'twelfth'),
    ).not.toEqual([]);
  });
});

// Ivan, 2026-10-15: "remove curve smoothing as default for normal EQ put
// it as off" (it had been 1/12 octave since 10-06). A choice never made is
// Off everywhere it is read — the written curves, the graph, the headroom —
// and 1/12 and 1/3 octave are choices like any other.
describe('curve smoothing with nothing chosen', () => {
  const sharp = { ...band, quality: 7 };

  it('reads a missing or unknown choice as Off, and a real one as itself', () => {
    expect(DEFAULT_CURVE_SMOOTHING).toBe('off');
    [undefined, null, '', 'sixth', 3].forEach((saved) =>
      expect(curveSmoothingOf(saved)).toBe('off'),
    );
    (['off', 'twelfth', 'third'] as const).forEach((saved) =>
      expect(curveSmoothingOf(saved)).toBe(saved),
    );
  });

  it('leaves a curve and a correction as they are, as Off does', () => {
    expect(smoothEqCurve(curve)).toEqual(curve);
    expect(smoothEqCurve(curve, 'off')).toBe(curve);
    // The control: 1/12 octave does change this curve, or the lines above
    // would hold for a curve no smoothing could touch.
    expect(smoothEqCurve(curve, 'twelfth')).not.toEqual(curve);
    expect(filterSmoothingCorrection([sharp])).toEqual([]);
    expect(filterSmoothingCorrection([sharp], 'twelfth')).not.toEqual([]);
  });

  it('writes a headphone correction with nothing chosen unsmoothed', () => {
    const state: IState = {
      ...getDefaultState(),
      headphone: { filters: { test: sharp }, intensity: 1 },
    };
    expect(state.curveSmoothing).toBeUndefined();
    const correction = (smoothing?: IState['curveSmoothing']) =>
      stateToApoFiles({ ...state, curveSmoothing: smoothing })?.features.find(
        (feature) => feature.feature === 'headphone',
      )?.lines;
    expect(correction()).toEqual(correction('off'));
    // Unsmoothed it is its own bands; smoothed it becomes a sampled curve.
    expect(correction()?.some((line) => line.startsWith('Filter'))).toBe(true);
    expect(correction('twelfth')?.[1]).toMatch(/^GraphicEQ:/);
  });

  it('plays the custom file as written with nothing chosen', () => {
    const state: IState = {
      ...getDefaultState(),
      customFx: {
        fileName: 'custom.txt',
        filters: {},
        preAmp: 0,
        graphicEq: curve,
      },
    };
    const compensation = (smoothing?: IState['curveSmoothing']) =>
      stateToApoFiles({ ...state, curveSmoothing: smoothing })
        ?.customEqCompensation;
    expect(compensation()).toEqual([]);
    expect(compensation('off')).toEqual([]);
    // CONTROL: smoothed, a compensation is added.
    expect(compensation('twelfth')?.[0]).toMatch(/^GraphicEQ:/);
  });
});
it('smooths parametric curve audio while preserving every source Q when off', () => {
  const personal = { ...band, quality: 7 };
  const state: IState = {
    ...getDefaultState(),
    eqBandQ: 'off',
    curveBandQ: 'off',
    filters: { test: personal },
    headphone: { filters: { test: personal }, intensity: 1 },
    curveSmoothing: 'third',
  };
  const result = stateToApoFiles(state);
  const main =
    result?.features.find((feature) => feature.feature === 'eq')?.lines ?? [];
  const correction =
    result?.features.find((feature) => feature.feature === 'headphone')
      ?.lines ?? [];
  expect(main).toHaveLength(1);
  expect(main[0]).toContain('Q 7');
  expect(correction[0]).toContain('Q 7');
  expect(correction[1]).toMatch(/^GraphicEQ:/);
  expect(
    filterSmoothingCorrection([personal], 'third').find(
      (point) => point.frequency === 1000,
    )?.gain,
  ).toBeLessThan(0);
  expect(filterSmoothingCorrection([personal], 'off')).toEqual([]);
  expect(getBandQ({ curveBandQ: 'fixed' }, 'curves')).toBe('off');
});
