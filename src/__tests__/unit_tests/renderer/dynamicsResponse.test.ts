/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/
import {
  createDynamicsMotion,
  dynamicsResponseDb,
} from '../../../renderer/dsp/dynamicsResponse';

it.each([8000, 44100, 48000, 96000, 192000])(
  'keeps equal band gains flat through both crossover corners at %s Hz',
  (rate) => {
    [0, 6, -12].forEach((gain) => {
      [20, 60, 150, 800, 4000, rate / 2].forEach((hz) => {
        expect(dynamicsResponseDb(hz, rate, [gain, gain, gain])).toBeCloseTo(
          gain,
          10,
        );
      });
    });
  },
);

it('shows lifting bass and held treble on their correct ends, with continuous crossovers', () => {
  const gains = [12, 0, -12];
  expect(dynamicsResponseDb(20, 48000, gains)).toBeGreaterThan(11);
  // First-order bands overlap even at Nyquist: the actual response is not
  // the high band's gain alone. Check against a time-domain impulse through
  // the native residual split rather than assuming ideal brick-wall bands.
  [20, 150, 800, 4000, 20000].forEach((hz) => {
    let low = 0;
    let mid = 0;
    let real = 0;
    let imag = 0;
    const lowC = Math.exp((-2 * Math.PI * 150) / 48000);
    const highC = Math.exp((-2 * Math.PI * 4000) / 48000);
    for (let sample = 0; sample < 8192; sample += 1) {
      const input = sample === 0 ? 1 : 0;
      low = input + lowC * (low - input);
      const rest = input - low;
      mid = rest + highC * (mid - rest);
      const out = low * 10 ** (12 / 20) + mid + (rest - mid) * 10 ** (-12 / 20);
      const angle = (2 * Math.PI * hz * sample) / 48000;
      real += out * Math.cos(angle);
      imag -= out * Math.sin(angle);
    }
    expect(dynamicsResponseDb(hz, 48000, gains)).toBeCloseTo(
      20 * Math.log10(Math.hypot(real, imag)),
      10,
    );
  });
  [150, 4000].forEach((corner) => {
    expect(
      Math.abs(
        dynamicsResponseDb(corner - 0.01, 48000, gains) -
          dynamicsResponseDb(corner + 0.01, 48000, gains),
      ),
    ).toBeLessThan(0.01);
  });
});

it('interpolates by elapsed time at 60 and 240 Hz, resets and resumes without stale motion', () => {
  const run = (step: number) => {
    const motion = createDynamicsMotion();
    motion.read([0, 0, 0], 0);
    for (let at = step; at <= 100 + 0.001; at += step) {
      motion.read([12, -6, 3], at);
    }
    return [...motion.read([12, -6, 3], 100)];
  };
  run(100 / 6).forEach((gain, band) =>
    expect(gain).toBeCloseTo(run(100 / 24)[band], 10),
  );
  const motion = createDynamicsMotion();
  motion.read([12, -6, 3], 0);
  motion.reset();
  expect(motion.read([0, 0, 0], 500)).toEqual([0, 0, 0]);
  expect(motion.read([3, 2, 1], 1000)).toEqual([3, 2, 1]);
});
