/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * In-place iterative radix-2 complex FFT.
 *
 * Iterative rather than recursive because the separation path runs this 2,200
 * times per chunk and the call overhead is measurable. `inverse` selects the
 * sign of the twiddle factor only — the caller applies the 1/N scaling, so a
 * forward transform followed by an inverse one is the identity up to that
 * factor.
 *
 * Lives here rather than beside the one caller that first needed it. The
 * linear-phase EQ builds its kernel from a transform of the same shape, and a
 * second implementation would be a second set of sign and scaling conventions
 * to keep in agreement with this one — the kind of duplication that stays
 * correct until somebody fixes a bug in one of them.
 */
/* eslint-disable no-bitwise --
 * A radix-2 FFT is defined in terms of bit operations: the permutation below
 * reverses the bits of each index, and the stage loop doubles a power of two.
 * Written with arithmetic instead they become a division and a modulo per
 * element, which is both slower in the hot loop and further from every
 * reference implementation a reader might check this against.
 */
export const fftInPlace = (
  real: Float64Array,
  imaginary: Float64Array,
  inverse: boolean,
): void => {
  const size = real.length;
  // Bit-reversal permutation, so the butterflies below can run in place.
  for (let i = 1, j = 0; i < size; i += 1) {
    let bit = size >> 1;
    for (; j & bit; bit >>= 1) {
      j ^= bit;
    }
    j ^= bit;
    if (i < j) {
      const tr = real[i];
      real[i] = real[j];
      real[j] = tr;
      const ti = imaginary[i];
      imaginary[i] = imaginary[j];
      imaginary[j] = ti;
    }
  }
  for (let length = 2; length <= size; length <<= 1) {
    const angle = ((inverse ? 2 : -2) * Math.PI) / length;
    const stepReal = Math.cos(angle);
    const stepImaginary = Math.sin(angle);
    const half = length / 2;
    for (let start = 0; start < size; start += length) {
      let twiddleReal = 1;
      let twiddleImaginary = 0;
      for (let k = 0; k < half; k += 1) {
        const topReal = real[start + k];
        const topImaginary = imaginary[start + k];
        const bottomReal =
          real[start + k + half] * twiddleReal -
          imaginary[start + k + half] * twiddleImaginary;
        const bottomImaginary =
          real[start + k + half] * twiddleImaginary +
          imaginary[start + k + half] * twiddleReal;
        real[start + k] = topReal + bottomReal;
        imaginary[start + k] = topImaginary + bottomImaginary;
        real[start + k + half] = topReal - bottomReal;
        imaginary[start + k + half] = topImaginary - bottomImaginary;
        const nextReal =
          twiddleReal * stepReal - twiddleImaginary * stepImaginary;
        twiddleImaginary =
          twiddleReal * stepImaginary + twiddleImaginary * stepReal;
        twiddleReal = nextReal;
      }
    }
  }
};
/* eslint-enable no-bitwise */
