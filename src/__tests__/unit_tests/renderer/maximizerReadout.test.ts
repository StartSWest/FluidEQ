/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import createMaximizerReadout from '../../../renderer/dsp/maximizerReadout';

const reading = (
  reductionDb = 0,
  outputDb = -120,
  peakHoldDb = reductionDb,
) => ({ reductionDb, outputDb, peakHoldDb });

it('holds the digits between readable updates while retaining a short peak', () => {
  const meter = createMaximizerReadout();
  expect(meter.sample(0, reading(6, -6))).toBeNull();
  expect(meter.sample(100, reading(0, -18))).toBeNull();
  expect(meter.sample(200, reading(0, -18))).toBeNull();
  const result = meter.sample(250, reading(0, -18));
  expect(result?.reductionDb).toBeCloseTo(2.4);
  expect(result?.peakHoldDb).toBe(6);
  // Power averaging, rather than displaying either instantaneous endpoint.
  expect(result?.outputDb).toBeCloseTo(
    10 * Math.log10(0.4 * 10 ** -0.6 + 0.6 * 10 ** -1.8),
  );
  expect(meter.sample(300, reading(12, -1))).toBeNull();
});

it.each([60, 144])(
  'uses elapsed time at %i Hz, not a count of screen frames',
  (hz) => {
    const meter = createMaximizerReadout();
    const updates = [];
    for (let frame = 0; frame <= hz; frame += 1) {
      const result = meter.sample((frame * 1000) / hz, reading(3, -12));
      if (result) {
        updates.push(result);
      }
    }
    expect(updates.length).toBeGreaterThanOrEqual(3);
    expect(updates.length).toBeLessThanOrEqual(4);
    updates.forEach((result) => {
      expect(result.reductionDb).toBeCloseTo(3);
      expect(result.outputDb).toBeCloseTo(-12);
    });
  },
);

it('clears the previous song and its held peak when analysis stops', () => {
  const meter = createMaximizerReadout();
  meter.sample(0, reading(12, -1));
  meter.sample(200, reading(12, -1));
  meter.reset();
  expect(meter.sample(10_000, reading())).toBeNull();
  expect(meter.sample(10_250, reading())).toEqual(reading());
});

it('does not replay missed updates after the window was suspended', () => {
  const meter = createMaximizerReadout();
  meter.sample(0, reading(2, -10));
  expect(meter.sample(60_000, reading(2, -10))).toEqual(reading(2, -10));
  expect(meter.sample(60_001, reading(8, -2))).toBeNull();
});
