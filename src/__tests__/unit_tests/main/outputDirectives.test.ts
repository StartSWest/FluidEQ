import { getDefaultState, IState } from '../../../common/constants';
import { stateToApoFiles } from '../../../main/apoRender';

it('keeps APO preamp intact and uses comments for native final-output control', () => {
  const state = {
    ...getDefaultState(),
    isEnabled: true,
    preAmp: -7,
    isAutoPreAmpOn: false,
  };
  const manual = stateToApoFiles(state);
  expect(manual?.preAmp).toBe('Preamp: -7 dB');
  expect(manual?.engineDirectives).toContain('# FluidEQAutoPreamp: OFF');
  const automatic = stateToApoFiles({ ...state, isAutoPreAmpOn: true });
  expect(automatic?.preAmp).toMatch(/^Preamp: -?\d/);
  expect(automatic?.engineDirectives).toContain('# FluidEQAutoPreamp: ON');
  expect(
    automatic?.engineDirectives?.every((line) => line.startsWith('# ')),
  ).toBe(true);
  expect(stateToApoFiles({ ...state, isEnabled: false })).toBeUndefined();
});

it('does not add curve latency for an empty custom file', () => {
  const state: IState = {
    ...getDefaultState(),
    isEnabled: true,
    customFx: { fileName: 'custom.txt', preAmp: 0, filters: {} },
  };
  expect(stateToApoFiles(state)?.engineDirectives).not.toContain(
    '# FluidEQCurveStage: ON',
  );
  state.customFx = {
    fileName: 'custom.txt',
    preAmp: 0,
    filters: {},
    graphicEq: [{ frequency: 1000, gain: 2 }],
  };
  expect(stateToApoFiles(state)?.engineDirectives).toContain(
    '# FluidEQCurveStage: ON',
  );
});
