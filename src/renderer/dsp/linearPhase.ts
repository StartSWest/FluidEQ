/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What linear phase delays the sound by, as the engine builds it
 * (`feq_linear_phase_latency`, `linear_phase.cpp`): half the 16384-tap kernel,
 * where a symmetric filter's energy sits, and the 512-sample partition its
 * convolver buffers (`convolver.cpp`). Change either there, change it here.
 *
 * 16384 taps is a measurement rather than a default: a Q of 8 at 50 Hz — what
 * published correction files contain — rings for about 51 ms, and asked for
 * +9 dB, 8192 taps returned +6.12 where 16384 returned +8.87.
 */
const KERNEL_SIZE = 16_384;
const CONVOLVER_PARTITION = 512;
const LINEAR_PHASE_LATENCY = KERNEL_SIZE / 2 + CONVOLVER_PARTITION;

/**
 * The same in milliseconds at `sampleRate`, shown on the control that offers
 * the mode: one that quietly puts the sound a fifth of a second behind the
 * transport should say so before it is chosen, not after somebody notices the
 * karaoke drifting.
 */
const linearPhaseLatencyMs = (sampleRate: number): number =>
  Math.round((LINEAR_PHASE_LATENCY / sampleRate) * 1_000);

export default linearPhaseLatencyMs;
