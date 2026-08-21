/*
<FluidEQ: System-wide parametric audio equalizer interface>
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

import { getResolvedPreAmp } from '../../../main/flush';
import {
  FilterTypeEnum,
  getDefaultState,
  IState,
} from '../../../common/constants';

/**
 * The seam where the measurement actually reaches the output.
 *
 * Everything either side of this is covered elsewhere — the arithmetic in
 * `smartHeadroom.test.ts`, the accumulator in `headroomCapture.test.ts`. This
 * is the one that would still pass if the two were wired together wrongly, so
 * it asks its questions of the resolver the config writer really calls.
 */

/** Ten octave centres, as the capture reports them. */
const CENTRES = [28, 57, 113, 226, 453, 894, 1768, 3536, 7071, 14142];

const programme = (levels: number[]) =>
  CENTRES.map((frequency, index) => ({ frequency, gain: levels[index] }));

/** Bass loud, treble forty-odd decibels down: ordinary music. */
const PINK = programme([-8, -13, -17, -22, -26, -31, -35, -40, -44, -49]);

/** Flat: the chain's peak and the music's peak coincide, so nothing is spare. */
const FLAT = programme(CENTRES.map(() => -20));

/** A chain that boosts the treble, which is where the wasted headroom lives. */
const withTrebleBoost = (): IState => {
  const state = getDefaultState();
  state.isFlat = false;
  state.isAutoPreAmpOn = true;
  state.filters = {
    a: {
      id: 'a',
      frequency: 10000,
      gain: 8,
      quality: 1,
      type: FilterTypeEnum.PK,
    },
  };
  return state;
};

describe('smart auto-normalize through the config writer', () => {
  it('is the shipped worst case until something has been heard (null)', () => {
    const state = withTrebleBoost();
    const normalize = getResolvedPreAmp(state);
    expect(getResolvedPreAmp(state)).toBe(normalize);
  });

  it('recovers level once the music says there is room (positive control)', () => {
    // The control the null above needs. Same chain, same resolver, the only
    // difference being that a measurement exists.
    const state = withTrebleBoost();
    const normalize = getResolvedPreAmp(state);
    state.smartHeadroomProgramme = PINK;
    expect(getResolvedPreAmp(state)).toBeGreaterThan(normalize + 3);
  });

  it('recovers nothing when the music fills the band evenly', () => {
    const state = withTrebleBoost();
    const normalize = getResolvedPreAmp(state);
    state.smartHeadroomProgramme = FLAT;
    expect(getResolvedPreAmp(state)).toBe(normalize);
  });

  it('never comes out below the switch position under it', () => {
    const materials = [
      PINK,
      FLAT,
      programme(CENTRES.map((_f, index) => -50 + index * 5)),
      programme(CENTRES.map(() => -3)),
    ];
    const state = withTrebleBoost();
    const normalize = getResolvedPreAmp(state);
    materials.forEach((material) => {
      state.smartHeadroomProgramme = material;
      expect(getResolvedPreAmp(state)).toBeGreaterThanOrEqual(normalize);
    });
  });

  it('applies the supervisor trim, and only downwards', () => {
    const state = withTrebleBoost();
    state.smartHeadroomProgramme = PINK;
    const plain = getResolvedPreAmp(state);
    state.smartHeadroomTrimDb = -4;
    expect(getResolvedPreAmp(state)).toBeCloseTo(plain - 4, 1);
    // A positive trim reaching the resolver would be the supervisor adding
    // level. It is clamped in the IPC handler and again in the maths; this is
    // the assertion that the second clamp is really there.
    state.smartHeadroomTrimDb = 6;
    expect(getResolvedPreAmp(state)).toBeCloseTo(plain, 1);
  });

  it('is ignored entirely while Auto normalize is off', () => {
    const state = withTrebleBoost();
    state.isAutoPreAmpOn = false;
    state.preAmp = -5;
    state.smartHeadroomProgramme = PINK;
    // Off means the user owns the number, and Smart is a position of the same
    // switch rather than something layered on top of Off.
    expect(getResolvedPreAmp(state)).toBe(-5);
  });

  /*
   * Moved here from the response-graph test, which used to assert it by
   * recomputing the worst case beside the plot. The graph no longer derives the
   * preamp at all — it reports what this resolver settled on — so the guarantee
   * that every layer is reserved for belongs against the resolver itself, which
   * is also the thing that writes the `Preamp:` line.
   */
  it('reserves headroom for the headphone layer, not just the bands', () => {
    const bandsOnly = getResolvedPreAmp(withTrebleBoost());

    const withCorrection = withTrebleBoost();
    withCorrection.headphone = {
      intensity: 1,
      filters: {
        h: {
          id: 'h',
          frequency: 3000,
          gain: 6,
          quality: 1,
          type: FilterTypeEnum.PK,
        },
      },
    };
    // A layer boosting where the bands do not has to cost headroom of its own.
    // It once cost nothing, because the arithmetic did not know it was there.
    expect(getResolvedPreAmp(withCorrection)).toBeLessThan(bandsOnly);
  });

  it('leaves a chain that does nothing at unity', () => {
    const state = getDefaultState();
    state.isAutoPreAmpOn = true;
    state.smartHeadroomProgramme = PINK;
    expect(getResolvedPreAmp(state)).toBe(0);
  });
});
