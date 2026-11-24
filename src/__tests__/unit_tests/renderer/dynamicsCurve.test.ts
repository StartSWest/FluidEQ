/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IDynamicsBand } from '../../../common/dsp/dynamicsStage';
import dynamicsGainDb, {
  bandHolds,
  bandLifts,
  heardGainDb,
  liftTopDb,
  mixedGainDb,
  reportedToHeardDb,
} from '../../../renderer/dsp/dynamicsCurve';

/**
 * The curve the card draws is the engine's: `target_gain_db` and
 * `feq_compander_block_report` in native/dsp-core/src/compander.cpp. Every
 * expected number below is worked out by hand from those two functions, not
 * read back from the TypeScript, so a change on either side fails here.
 */
const band = (overrides: Partial<IDynamicsBand>): IDynamicsBand => ({
  upThresholdDb: -40,
  upRatio: 1,
  upMaxDb: 0,
  downThresholdDb: -20,
  downRatio: 1,
  ...overrides,
});

describe('the engine curve', () => {
  it('lifts by 1 - 1/ratio of the distance under the threshold', () => {
    // compander_test.cpp: "a quiet tone is lifted 10 dB" (-60 under -40 at 2:1).
    const lift = band({ upRatio: 2, upMaxDb: 18 });
    expect(dynamicsGainDb(lift, -60)).toBeCloseTo(10, 9);
    expect(dynamicsGainDb(lift, -50)).toBeCloseTo(5, 9);
    expect(dynamicsGainDb(lift, -40)).toBe(0);
    expect(dynamicsGainDb(lift, -30)).toBe(0);
  });

  it('never lifts past Up to', () => {
    const lift = band({ upRatio: 4, upMaxDb: 6 });
    // 30 dB under at 4:1 asks 22.5 dB; Up to holds it at 6.
    expect(dynamicsGainDb(lift, -55)).toBeCloseTo(6, 9);
    expect(dynamicsGainDb(lift, -60)).toBeCloseTo(6, 9);
  });

  it('fades the lift out over the 6 dB above the -75 dBFS floor', () => {
    const lift = band({ upRatio: 2, upMaxDb: 18 });
    // At -72: 32 dB under asks 16 dB, three sixths of the way up the fade.
    expect(dynamicsGainDb(lift, -72)).toBeCloseTo(16 * 0.5, 9);
    expect(dynamicsGainDb(lift, -75)).toBe(0);
    expect(dynamicsGainDb(lift, -80)).toBe(0);
    expect(dynamicsGainDb(lift, -69)).toBeCloseTo(14.5, 9);
  });

  it('holds by 1 - 1/ratio of the distance over the threshold', () => {
    const hold = band({ downThresholdDb: -24, downRatio: 4 });
    expect(dynamicsGainDb(hold, -8)).toBeCloseTo(-12, 9);
    expect(dynamicsGainDb(hold, -24)).toBe(0);
    expect(dynamicsGainDb(hold, -40)).toBe(0);
  });

  it('adds a lift and a hold where their ranges overlap', () => {
    const both = band({
      upThresholdDb: -20,
      upRatio: 2,
      upMaxDb: 18,
      downThresholdDb: -40,
      downRatio: 2,
    });
    // At -30: lift (10 * 0.5) = 5, hold (10 * 0.5) = -5.
    expect(dynamicsGainDb(both, -30)).toBeCloseTo(0, 9);
  });

  it('says a band lifts only with a ratio over one and some Up to', () => {
    expect(bandLifts(band({ upRatio: 2, upMaxDb: 0 }))).toBe(false);
    expect(bandLifts(band({ upRatio: 1, upMaxDb: 6 }))).toBe(false);
    expect(bandLifts(band({ upRatio: 1.1, upMaxDb: 0.5 }))).toBe(true);
    expect(bandHolds(band({ downRatio: 1 }))).toBe(false);
    expect(bandHolds(band({ downRatio: 1.1 }))).toBe(true);
  });

  it('puts the top of the lift where it reaches Up to', () => {
    const lift = band({ upThresholdDb: -30, upRatio: 2, upMaxDb: 6 });
    const top = liftTopDb(lift);
    expect(top).toBeCloseTo(-42, 9);
    expect(dynamicsGainDb(lift, top ?? 0)).toBeCloseTo(6, 9);
    expect(liftTopDb(band({}))).toBeUndefined();
  });
});

describe('make-up and mix', () => {
  it('reports a gain the way feq_compander_block_report does', () => {
    // 20 log10(1 - mix + mix * 10^((g + makeup) / 20)).
    expect(mixedGainDb(-12, 0, 1)).toBeCloseTo(-12, 9);
    expect(mixedGainDb(-12, 0, 0.5)).toBeCloseTo(
      20 * Math.log10(0.5 + 0.5 * 10 ** (-12 / 20)),
      9,
    );
    expect(mixedGainDb(-12, 0, 0.5)).toBeCloseTo(-4.0741, 3);
    expect(mixedGainDb(0, 6, 0.5)).toBeCloseTo(3.5081, 3);
    expect(mixedGainDb(-20, 6, 0)).toBe(0);
  });

  it('takes make-up out of the curve, so an untouched level sits on unity', () => {
    const hold = band({ downThresholdDb: -20, downRatio: 4 });
    [0, 1, 0.5].forEach((mix) => {
      expect(heardGainDb(hold, -40, 6, mix)).toBeCloseTo(0, 9);
    });
    // At a full mix the make-up is a constant and the curve is the engine's.
    expect(heardGainDb(hold, -4, 6, 1)).toBeCloseTo(-12, 9);
    expect(heardGainDb(hold, -4, -3, 1)).toBeCloseTo(-12, 9);
  });

  it('draws the curve a partial mix plays, flatter than the setting', () => {
    const hold = band({ downThresholdDb: -20, downRatio: 4 });
    const wet = dynamicsGainDb(hold, -4);
    const heard = heardGainDb(hold, -4, 0, 0.5);
    expect(heard).toBeCloseTo(20 * Math.log10(0.5 + 0.5 * 10 ** (wet / 20)), 9);
    expect(heard).toBeGreaterThan(wet);
    expect(heardGainDb(hold, -4, 0, 0)).toBe(0);
    // With make-up the dry share is weighed against a louder wet one.
    const share = mixedGainDb(0, 6, 0.5);
    expect(heardGainDb(hold, -4, 6, 0.5)).toBeCloseTo(
      mixedGainDb(wet, 6, 0.5) - share,
      9,
    );
  });

  it('places a steady band reported by the engine on its curve', () => {
    const lift = band({ upRatio: 2, upMaxDb: 12, downRatio: 3 });
    [
      [1, 0],
      [1, 4],
      [0.5, 0],
      [0.35, -6],
    ].forEach(([mix, makeup]) => {
      [-60, -45, -10].forEach((level) => {
        const reported = mixedGainDb(dynamicsGainDb(lift, level), makeup, mix);
        expect(reportedToHeardDb(reported, makeup, mix)).toBeCloseTo(
          heardGainDb(lift, level, makeup, mix),
          9,
        );
      });
    });
  });
});
