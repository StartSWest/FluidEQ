/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { FilterTypeEnum } from '../../../common/constants';
import { TEqEngine } from '../../../common/dsp/chain';
import {
  biquadCoefficients,
  createBiquadState,
} from '../../../renderer/dsp/biquad';
import { processEqBands } from '../../../renderer/dsp/eqEngine';

const RATE = 48_000;
const BLOCK = 512;

const bell = (frequency: number, gainDb: number, quality = 1) =>
  biquadCoefficients(
    { type: FilterTypeEnum.PK, frequency, gainDb, quality },
    RATE,
  );

/** A burst with content everywhere, so every band has something to act on. */
const impulseTrain = (): Float32Array => {
  const signal = new Float32Array(BLOCK);
  signal[0] = 1;
  for (let i = 1; i < BLOCK; i += 1) {
    // A decaying noise-like tail, deterministic so the test cannot flap.
    signal[i] = Math.sin(i * 1.7) * Math.exp(-i / 90) * 0.5;
  }
  return signal;
};

const run = (
  coefficients: ReturnType<typeof bell>[],
  engine: TEqEngine,
): Float32Array => {
  const target = impulseTrain();
  const states = coefficients.map(() => createBiquadState());
  processEqBands(
    states,
    coefficients,
    target,
    engine,
    new Float32Array(BLOCK),
    new Float32Array(BLOCK),
  );
  return target;
};

const worstDifference = (a: Float32Array, b: Float32Array): number =>
  a.reduce(
    (worst, value, index) => Math.max(worst, Math.abs(value - b[index])),
    0,
  );

describe('the EQ engines', () => {
  /**
   * With one band there is nothing to arrange, so the two must agree exactly.
   *
   * This is what proves the parallel path is a rearrangement rather than a
   * different filter: `dry + (wet - dry)` is `wet`, and if it were not, every
   * comparison below would be measuring a bug instead of a topology.
   */
  it('agree exactly when there is only one band', () => {
    const one = [bell(1_000, 6)];
    expect(
      worstDifference(run(one, 'serial'), run(one, 'parallel')),
    ).toBeLessThan(1e-9);
  });

  /**
   * The point of the control.
   *
   * Two overlapping bands compound in a cascade and sum in parallel, so the
   * same dials produce a measurably different signal. Without this the engine
   * picker would be a label.
   */
  it('differ once bands overlap', () => {
    const overlapping = [bell(900, 8, 0.8), bell(1_300, 8, 0.8)];
    const difference = worstDifference(
      run(overlapping, 'serial'),
      run(overlapping, 'parallel'),
    );
    expect(difference).toBeGreaterThan(0.02);
  });

  /**
   * Order matters in a cascade and cannot matter in parallel. That asymmetry
   * is the clearest statement of what the two topologies are.
   */
  it('make the parallel engine indifferent to band order', () => {
    const forward = [bell(700, 9, 0.7), bell(1_500, -9, 0.7)];
    const reversed = [forward[1], forward[0]];
    expect(
      worstDifference(run(forward, 'parallel'), run(reversed, 'parallel')),
    ).toBeLessThan(1e-9);
    // CONTROL: the cascade is NOT indifferent, so the assertion above is a
    // property of the topology rather than of these particular filters.
    expect(
      worstDifference(run(forward, 'serial'), run(reversed, 'serial')),
    ).toBeGreaterThan(0);
  });

  it('NULL TEST: no bands leaves the signal untouched', () => {
    const untouched = impulseTrain();
    expect(worstDifference(run([], 'parallel'), untouched)).toBe(0);
    expect(worstDifference(run([], 'serial'), untouched)).toBe(0);
  });

  /**
   * The mistake the difference-summing avoids.
   *
   * Adding the bands' outputs rather than what they changed would stack one
   * copy of the dry signal per band. With four bands at unity that would come
   * out four times too loud, which is a bug that sounds like "parallel is
   * broken" rather than like a topology.
   */
  it('does not multiply the dry signal by the band count', () => {
    const flat = [bell(500, 0), bell(1_000, 0), bell(2_000, 0), bell(4_000, 0)];
    const untouched = impulseTrain();
    expect(worstDifference(run(flat, 'parallel'), untouched)).toBeLessThan(
      1e-9,
    );
  });
});
