import { FilterTypeEnum, getDefaultState, IState } from 'common/constants';
import { getMainBandQ } from 'common/eqMode';
import { createLayerLines } from 'renderer/graph/layerLines';
import { stateToApoFiles } from 'main/apoRender';

const filter = {
  id: 'band',
  type: FilterTypeEnum.PK,
  frequency: 1000,
  gain: 12,
  quality: 1.44,
};

it.each(['off', 'proportional', 'asymmetric'] as const)(
  'changes only main bands for Q behavior %s',
  (mainBandQ) => {
    const state: IState = {
      ...getDefaultState(),
      eqMode: 'studio',
      curveEqMode: 'normal',
      eqBandQ: 'proportional',
      curveBandQ: 'asymmetric',
      filters: { band: filter },
      tone: { bass: 3, mid: -2, treble: 4 },
      smartEq: { filters: { band: filter }, intensity: 1 },
      headphone: { filters: { band: filter }, intensity: 1 },
      voicing: {
        profileId: 'Music',
        intensity: 1,
        apoOverride: { filters: { band: filter } },
      },
      driver: {
        profileId: 'driver',
        intensity: 1,
        apoOverride: { filters: { band: filter } },
      },
    };
    const snapshot = JSON.stringify(state);
    const before = stateToApoFiles(state);
    const after = stateToApoFiles({ ...state, mainBandQ });
    expect(
      after?.features.filter((feature) => feature.feature !== 'eq'),
    ).toEqual(before?.features.filter((feature) => feature.feature !== 'eq'));
    expect(
      after?.features.find((feature) => feature.feature === 'eq')?.lines[0],
    ).toContain(
      `Q ${{ off: '1.44', proportional: '2.04', asymmetric: '1.02' }[mainBandQ]}`,
    );
    [false, true].forEach((matched) => {
      const baseline = createLayerLines(
        state,
        { eq: matched, curves: matched },
        48000,
      );
      const changed = createLayerLines(
        { ...state, mainBandQ },
        { eq: matched, curves: matched },
        48000,
      );
      (['voicing', 'driver', 'smart', 'tone', 'headphone'] as const).forEach(
        (feature) => {
          expect(changed.filterLine(filter, feature)).toEqual(
            baseline.filterLine(filter, feature),
          );
        },
      );
      expect(changed.filterLine(filter)).toEqual(baseline.filterLine(filter));
      expect(
        JSON.stringify(changed.filterLine(filter, 'eq')) ===
          JSON.stringify(baseline.filterLine(filter, 'eq')),
      ).toBe(mainBandQ === 'proportional');
    });
    expect(JSON.stringify(state)).toBe(snapshot);
  },
);

it('preserves legacy Q on load and honors an explicit Constant choice in Studio', () => {
  expect(getMainBandQ({ eqMode: 'studio' })).toBe('proportional');
  expect(getMainBandQ({ eqBandQ: 'asymmetric' })).toBe('asymmetric');
  expect(getMainBandQ({ eqMode: 'studio', mainBandQ: 'off' })).toBe('off');
});
