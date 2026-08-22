/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Samples in the transfer curve. 1024 is inaudibly fine and cheap to build. */
const CURVE_SAMPLES = 1_024;

/**
 * The exciter's transfer curve, for a `WaveShaperNode`.
 *
 * This is the one stage in the chain Equalizer APO could never host. Every APO
 * command — `Filter`, `Convolution`, `Preamp`, `GraphicEQ` — is linear, and no
 * linear operation produces a frequency that was not in its input. Generating
 * the harmonics a lossy encoder discarded requires a non-linearity, and this
 * curve is it.
 *
 * `tanh` normalised to its own endpoint rather than raw. An un-normalised
 * `tanh` compresses the output level as drive rises, and that level drop is
 * heard as the effect doing nothing — the user turns the knob up and the sound
 * gets quieter and duller instead of brighter. Dividing by `tanh(drive)` makes
 * the curve span exactly -1..1 at every drive, so drive changes the harmonic
 * content and nothing else.
 *
 * Symmetric, so it generates odd harmonics only. Deliberate: odd harmonics on
 * a high band read as air and presence, while the even harmonics an asymmetric
 * curve would add read as warmth much lower down, which is not what a stage
 * fed only the top octaves is for.
 *
 * Nothing here recovers anything. The encoder threw the original highs away
 * and they are gone; what this produces is plausible, not true.
 */
export const buildShaperCurve = (
  drive: number,
  samples: number = CURVE_SAMPLES,
): Float32Array => {
  const curve = new Float32Array(samples);
  const last = samples - 1;
  const normalise = Math.tanh(drive);
  for (let i = 0; i < samples; i += 1) {
    const x = (i / last) * 2 - 1;
    curve[i] = Math.tanh(drive * x) / normalise;
  }
  return curve;
};
