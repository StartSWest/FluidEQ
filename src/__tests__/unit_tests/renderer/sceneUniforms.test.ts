/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  SPECTRUM_TEXELS,
  WAVEFORM_TEXELS,
} from '../../../common/sceneUniformContract';
import {
  createSpectrumTexels,
  createWaveformTexels,
  fillSpectrumTexels,
  fillWaveformTexels,
  parseAccent,
} from '../../../renderer/graph/sceneUniforms';

const MIN = -20;
const MAX = 20;

describe('packing the spectrum into a texture', () => {
  it('lands the endpoints exactly and keeps a ramp monotonic', () => {
    const points = Array.from({ length: 320 }, (_, i) => ({
      y: MIN + ((MAX - MIN) * i) / 319,
    }));
    const out = createSpectrumTexels();
    fillSpectrumTexels(points, out, MIN, MAX);

    expect(out).toHaveLength(SPECTRUM_TEXELS);
    expect(out[0]).toBe(0);
    expect(out[SPECTRUM_TEXELS - 1]).toBe(255);
    for (let i = 1; i < out.length; i += 1) {
      expect(out[i]).toBeGreaterThanOrEqual(out[i - 1]);
    }
  });

  it('reads full scale as 255 and silence as 0', () => {
    const out = createSpectrumTexels();
    fillSpectrumTexels([{ y: MAX }, { y: MAX }], out, MIN, MAX);
    expect(out.every((texel) => texel === 255)).toBe(true);
    fillSpectrumTexels([{ y: MIN }, { y: MIN }], out, MIN, MAX);
    expect(out.every((texel) => texel === 0)).toBe(true);
  });

  /** A NaN from a half-initialised frame is silence, never full scale. */
  it('lands a NaN as zero', () => {
    const out = createSpectrumTexels();
    fillSpectrumTexels([{ y: Number.NaN }, { y: Number.NaN }], out, MIN, MAX);
    expect(out.every((texel) => texel === 0)).toBe(true);
  });

  it('clamps values outside the gain range', () => {
    const out = createSpectrumTexels();
    fillSpectrumTexels([{ y: 900 }, { y: -900 }], out, MIN, MAX);
    expect(out[0]).toBe(255);
    expect(out[SPECTRUM_TEXELS - 1]).toBe(0);
  });

  it('answers silence for no points, and a flat field for one', () => {
    const out = createSpectrumTexels();
    out.fill(7);
    fillSpectrumTexels([], out, MIN, MAX);
    expect(out.every((texel) => texel === 0)).toBe(true);
    fillSpectrumTexels([{ y: 0 }], out, MIN, MAX);
    expect(out.every((texel) => texel === 128)).toBe(true);
  });
});

describe('packing the waveform into a texture', () => {
  it('puts the last sample in the last texel rather than clamp-repeating', () => {
    const samples = Array.from({ length: 96 }, (_, i) => i / 95);
    const out = createWaveformTexels();
    fillWaveformTexels(samples, out);
    expect(out).toHaveLength(WAVEFORM_TEXELS);
    expect(out[0]).toBe(0);
    expect(out[WAVEFORM_TEXELS - 1]).toBe(255);
  });

  it('is empty for no samples', () => {
    const out = createWaveformTexels();
    out.fill(9);
    fillWaveformTexels([], out);
    expect(out.every((texel) => texel === 0)).toBe(true);
  });
});

describe('the accent colour', () => {
  it('parses a hex colour into unit RGB', () => {
    expect(parseAccent('#ff0080')).toEqual([1, 0, 128 / 255]);
    expect(parseAccent('  #00E5CF ')).toEqual([0, 229 / 255, 207 / 255]);
  });

  /** A theme that has not painted yet must not hand a scene black. */
  it.each(['', 'red', 'hsl(160 90% 50%)', '#abc'])(
    'answers the default for %p',
    (css) => {
      const [r, g, b] = parseAccent(css);
      expect(r + g + b).toBeGreaterThan(0.5);
    },
  );
});
