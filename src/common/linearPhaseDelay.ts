/* FluidEQ — GPL-3.0-or-later */

import { engineAtLeast } from './engineHealth';

/** Preview of the native band FIR, relative to Minimum. Keep in step with
 * system-apo/linear_bands.cpp and dsp-core/convolver.cpp; the live badge uses
 * native telemetry instead. Sampled curves already retain their shared buffer. */
export const linearPhaseAddedMs = (
  sampleRate: number,
  hasBands: boolean,
): number => {
  if (
    !Number.isFinite(sampleRate) ||
    sampleRate < 8000 ||
    sampleRate > 384000
  ) {
    throw new Error('Invalid phase preview sample rate.');
  }
  if (!hasBands) {
    return 0;
  }
  const length = sampleRate > 48000 ? 65536 : 32768;
  return ((length / 2 - 1 + 512) * 1000) / sampleRate;
};

/**
 * The first FluidEQ Engine that builds every layer in linear phase into one
 * FIR (`native/system-apo/src/engine.rc`): from here Your EQ and the curves
 * both linear share one delay, where an older engine adds one per layer.
 */
export const ENGINE_SHARED_LINEAR_SINCE: readonly [number, number] = [1, 15];

export const engineSharesLinearDelay = (
  dllVersion: string | undefined,
): boolean => engineAtLeast(dllVersion, ENGINE_SHARED_LINEAR_SINCE);
