import { SPECTRUM_TEXELS, WAVEFORM_TEXELS } from 'common/sceneUniformContract';

/**
 * The live measurement, packed into the two textures a scene reads.
 *
 * Both are R8: eight bits over a forty-decibel window is about 0.16 dB a step,
 * far under anything the eye can see in a glow, and — unlike a float texture —
 * R8 is linearly filterable on every WebGL2 implementation without an
 * extension. A scene sampling a nearest-only float texture would stair-step
 * in a way that looks like a bug in the scene, on some machines only.
 *
 * The spectrum points arrive log-spaced BY INDEX over 16 Hz – 25 kHz, so an
 * index-linear resample keeps the frequency axis log-uniform in the texture,
 * which is what `u = 0.5` meaning "about 630 Hz" in the shader contract relies
 * on. The endpoints land exactly.
 */

export interface ISpectrumSample {
  y: number;
}

const clampByte = (unit: number): number =>
  Number.isFinite(unit) ? Math.round(Math.min(1, Math.max(0, unit)) * 255) : 0;

/**
 * Resample `points` to `out.length` texels by index, normalising decibels into
 * 0..1 over the plot's gain range. A NaN lands as silence, not as full scale.
 */
export const fillSpectrumTexels = (
  points: readonly ISpectrumSample[],
  out: Uint8Array,
  minGain: number,
  maxGain: number,
): void => {
  const depth = Math.max(1e-6, maxGain - minGain);
  const count = points.length;
  if (count === 0) {
    out.fill(0);
    return;
  }
  if (count === 1) {
    out.fill(clampByte((points[0].y - minGain) / depth));
    return;
  }
  const last = out.length - 1;
  for (let i = 0; i <= last; i += 1) {
    const position = (i / last) * (count - 1);
    const lower = Math.floor(position);
    const upper = Math.min(count - 1, lower + 1);
    const t = position - lower;
    const y = points[lower].y * (1 - t) + points[upper].y * t;
    out[i] = clampByte((y - minGain) / depth);
  }
};

/**
 * The waveform envelope — already absolute amplitudes in 0..1 — stretched so
 * the last sample sits in the last texel rather than clamp-repeating the edge.
 */
export const fillWaveformTexels = (
  waveform: readonly number[],
  out: Uint8Array,
): void => {
  const count = waveform.length;
  if (count === 0) {
    out.fill(0);
    return;
  }
  if (count === 1) {
    out.fill(clampByte(waveform[0]));
    return;
  }
  const last = out.length - 1;
  for (let i = 0; i <= last; i += 1) {
    const position = (i / last) * (count - 1);
    const lower = Math.floor(position);
    const upper = Math.min(count - 1, lower + 1);
    const t = position - lower;
    out[i] = clampByte(waveform[lower] * (1 - t) + waveform[upper] * t);
  }
};

export const createSpectrumTexels = () => new Uint8Array(SPECTRUM_TEXELS);
export const createWaveformTexels = () => new Uint8Array(WAVEFORM_TEXELS);

/**
 * `#rrggbb` to unit RGB. Anything else — a name, an `hsl()`, an empty string
 * from a theme that has not painted yet — answers the app's default accent, so
 * a scene is never handed black for its highlight.
 */
export const parseAccent = (css: string): [number, number, number] => {
  const match = /^\s*#([0-9a-f]{6})\s*$/i.exec(css);
  if (!match) {
    return [0, 0.898, 0.812];
  }
  const value = parseInt(match[1], 16);
  return [
    ((value >> 16) & 0xff) / 255, // eslint-disable-line no-bitwise
    ((value >> 8) & 0xff) / 255, // eslint-disable-line no-bitwise
    (value & 0xff) / 255, // eslint-disable-line no-bitwise
  ];
};
