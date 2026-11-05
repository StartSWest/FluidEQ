/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

type TComplex = readonly [number, number];
const multiply = (a: TComplex, b: TComplex): TComplex => [
  a[0] * b[0] - a[1] * b[1],
  a[0] * b[1] + a[1] * b[0],
];

/** Native first-order residual split, including phase through both corners. */
export const dynamicsResponseDb = (
  hz: number,
  sampleRate: number,
  gainDb: readonly number[],
): number => {
  const w = (2 * Math.PI * hz) / sampleRate;
  const lowPass = (corner: number): TComplex => {
    const c = Math.exp((-2 * Math.PI * corner) / sampleRate);
    const real = 1 - c * Math.cos(w);
    const imag = c * Math.sin(w);
    const denominator = real * real + imag * imag;
    return [((1 - c) * real) / denominator, (-(1 - c) * imag) / denominator];
  };
  const low = lowPass(150);
  const rest: TComplex = [1 - low[0], -low[1]];
  const mid = multiply(rest, lowPass(4_000));
  const high: TComplex = [rest[0] - mid[0], rest[1] - mid[1]];
  let real = 0;
  let imag = 0;
  [low, mid, high].forEach((band, index) => {
    const gain = 10 ** (gainDb[index] / 20);
    real += band[0] * gain;
    imag += band[1] * gain;
  });
  return 20 * Math.log10(Math.max(1e-6, Math.hypot(real, imag)));
};

/** Display-only interpolation; the engine already applied attack and release. */
export const createDynamicsMotion = () => {
  const gains = [0, 0, 0];
  let at = Number.NEGATIVE_INFINITY;
  return {
    read(target: readonly number[], now: number) {
      const elapsed = now - at;
      const amount = elapsed > 250 ? 1 : 1 - 2 ** (-Math.max(0, elapsed) / 25);
      gains.forEach((gain, band) => {
        gains[band] = gain + (target[band] - gain) * amount;
      });
      at = now;
      return gains;
    },
    reset() {
      gains.fill(0);
      at = Number.NEGATIVE_INFINITY;
    },
  };
};
