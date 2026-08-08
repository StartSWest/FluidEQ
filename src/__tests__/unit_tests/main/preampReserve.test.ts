/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
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

import { stateToString } from '../../../main/flush';
import { getChainPeakGain } from '../../../common/response';
import {
  AutoEqFormat,
  FilterTypeEnum,
  IState,
  getDefaultState,
} from '../../../common/constants';

const withBands = (): IState => {
  const state = getDefaultState();
  state.isFlat = false;
  state.isAutoPreAmpOn = true;
  state.filters = {
    a: {
      id: 'a',
      frequency: 100,
      gain: 6,
      quality: 1,
      type: FilterTypeEnum.PK,
    },
  };
  return state;
};

const preampLines = (state: IState) =>
  stateToString(state)
    .replace(/\r/g, '')
    .split('\n')
    .filter((line) => line.startsWith('Preamp:'));

const preampValue = (state: IState) =>
  Number(/-?[\d.]+/.exec(preampLines(state)[0])?.[0]);

/**
 * Every layer shares one preamp, and its value is derived from what was
 * actually written rather than stored.
 *
 * That is what makes it self-correcting. A stored value goes stale the moment a
 * layer changes somewhere the response graph is not watching, and the output
 * stays attenuated for a boost that is no longer in the chain.
 */
describe('preamp headroom', () => {
  it('writes exactly one preamp however many layers are active', () => {
    const state = withBands();
    state.voicing = { profileId: 'music', intensity: 1 };
    state.driver = { profileId: 'balanced-armature-iem', intensity: 1 };

    expect(preampLines(state)).toHaveLength(1);
  });

  it('reserves more headroom as layers are added', () => {
    const bands = preampValue(withBands());

    const voiced = withBands();
    voiced.voicing = { profileId: 'music', intensity: 1 };

    const both = withBands();
    both.voicing = { profileId: 'music', intensity: 1 };
    both.driver = { profileId: 'balanced-armature-iem', intensity: 1 };

    expect(preampValue(voiced)).toBeLessThan(bands);
    expect(preampValue(both)).toBeLessThan(preampValue(voiced));
  });

  it('gives the headroom back when a layer is removed', () => {
    const before = preampValue(withBands());

    const withLayers = withBands();
    withLayers.voicing = { profileId: 'music', intensity: 1 };
    withLayers.driver = { profileId: 'balanced-armature-iem', intensity: 1 };
    expect(preampValue(withLayers)).toBeLessThan(before);

    // Removing them must land back on the original value, not somewhere near
    // it — the whole point is that nothing is left over.
    const after = withBands();
    expect(preampValue(after)).toBe(before);
  });

  it('reserves nothing when the chain only cuts', () => {
    const state = withBands();
    state.filters.a.gain = -6;

    expect(preampValue(state)).toBe(0);
  });

  it('reserves nothing when the EQ is cleared and no layer is active', () => {
    const state = getDefaultState();
    state.isFlat = true;
    state.isAutoPreAmpOn = true;

    expect(preampValue(state)).toBe(0);
  });

  it('leaves a manual preamp completely alone', () => {
    const state = withBands();
    state.isAutoPreAmpOn = false;
    state.preAmp = -9.5;

    expect(preampValue(state)).toBe(-9.5);
  });

  it('cancels the peak of the combined chain, not the sum of the peaks', () => {
    // Two boosts far apart never coincide, so reserving both would throw away
    // headroom the user can hear as lost volume.
    const apart = getChainPeakGain([
      { type: FilterTypeEnum.PK, frequency: 60, gain: 6, quality: 2 },
      { type: FilterTypeEnum.PK, frequency: 8000, gain: 6, quality: 2 },
    ]);
    expect(apart).toBeGreaterThan(5.5);
    expect(apart).toBeLessThan(7);

    // Stacked at the same spot they genuinely do add up.
    const stacked = getChainPeakGain([
      { type: FilterTypeEnum.PK, frequency: 1000, gain: 6, quality: 2 },
      { type: FilterTypeEnum.PK, frequency: 1000, gain: 6, quality: 2 },
    ]);
    expect(stacked).toBeGreaterThan(11);
  });

  it('ignores non-finite filters rather than returning NaN', () => {
    expect(
      getChainPeakGain([
        { type: FilterTypeEnum.PK, frequency: NaN, gain: NaN, quality: NaN },
      ]),
    ).toBe(0);
  });
  it('reserves headroom for a GraphicEQ curve, which writes no Filter lines', () => {
    // GraphicEQ is a single line, not a filter list, so nothing lands in the
    // written-filter set. Deriving only from that set handed APO a +9 dB curve
    // with no attenuation at all.
    const state = getDefaultState();
    state.isFlat = false;
    state.isAutoPreAmpOn = true;
    state.eqFormat = AutoEqFormat.GRAPHIC;
    state.graphicEq = [
      { frequency: 20, gain: 0 },
      { frequency: 100, gain: 9 },
      { frequency: 1000, gain: 0 },
    ];

    expect(preampValue(state)).toBe(-9);
  });

  it('reserves headroom for a convolution, which is one line too', () => {
    const state = getDefaultState();
    state.isFlat = true;
    state.isAutoPreAmpOn = true;
    state.convolution = {
      name: 'HRTF',
      filters: {
        x: {
          id: 'x',
          frequency: 120,
          gain: 5,
          quality: 1,
          type: FilterTypeEnum.PK,
        },
      },
    };

    // Needs the convolution filename, since the Convolution line is only
    // written when there is a file to point at.
    const line = stateToString(state, 'hrtf.wav')
      .replace(/\r/g, '')
      .split('\n')
      .filter((entry) => entry.startsWith('Preamp:'))[0];
    const preamp = Number(/-?[\d.]+/.exec(line)?.[0]);

    expect(preamp).toBeLessThan(0);
    expect(preamp).toBeCloseTo(-5, 0);
  });
});
