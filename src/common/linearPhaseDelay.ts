/* FluidEQ — GPL-3.0-or-later */

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
