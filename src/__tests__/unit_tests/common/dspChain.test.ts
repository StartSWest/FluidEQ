/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  DSP_DEFAULTS,
  EQ_MAX_BAND_COUNT,
  EQ_RACK_SIZES,
  IDspSettings,
  buildEqRack,
  clampDspSettings,
} from '../../../common/dsp/chain';
import { DSP_PRESETS } from '../../../common/dsp/presets';

describe('dsp chain settings', () => {
  it('defaults to every module bypassed', () => {
    expect(DSP_DEFAULTS.exciter.enabled).toBe(false);
    expect(DSP_DEFAULTS.compressor.enabled).toBe(false);
    expect(DSP_DEFAULTS.maximizer.enabled).toBe(false);
  });

  it('clamps out-of-range values rather than rejecting them', () => {
    const clamped = clampDspSettings({
      ...DSP_DEFAULTS,
      exciter: {
        ...DSP_DEFAULTS.exciter,
        bands: [
          { ...DSP_DEFAULTS.exciter.bands[0], drive: 999 },
          ...DSP_DEFAULTS.exciter.bands.slice(1),
        ],
      },
    });
    // 3.5, because that is where the curve stops being a colour and starts
    // being a clipper. It used to stop at 10, and everything above about 3.5
    // was intermodulation rather than harmonics — so two thirds of the dial
    // made distortion, and anybody turning it up to hear what it did found
    // exactly that.
    expect(clamped.exciter.bands[0].drive).toBe(3.5);
  });

  it('replaces an unreadable blob with the defaults', () => {
    expect(clampDspSettings('nonsense')).toEqual(DSP_DEFAULTS);
  });

  /**
   * One bad field costs one field.
   *
   * The wholesale version of this — reject the object, return the defaults —
   * looks safer and is worse: a preset written by a later build carrying a
   * single value this build has never heard of would silently reset every
   * other setting the user had made.
   */
  it('keeps the readable fields when one of them is not', () => {
    const clamped = clampDspSettings({
      ...DSP_DEFAULTS,
      maximizer: {
        ...DSP_DEFAULTS.maximizer,
        enabled: true,
        ceilingDb: 'loud',
      },
    });
    expect(clamped.maximizer.enabled).toBe(true);
    expect(clamped.maximizer.ceilingDb).toBe(DSP_DEFAULTS.maximizer.ceilingDb);
  });

  it('round-trips through JSON unchanged', () => {
    const parsed: IDspSettings = clampDspSettings(
      JSON.parse(JSON.stringify(DSP_DEFAULTS)),
    );
    expect(parsed).toEqual(DSP_DEFAULTS);
  });

  it('ships presets that all survive clamping unchanged', () => {
    DSP_PRESETS.forEach((preset) => {
      expect(clampDspSettings(preset.settings)).toEqual(preset.settings);
    });
  });

  it('always returns three compressor bands whatever it was handed', () => {
    const clamped = clampDspSettings({
      ...DSP_DEFAULTS,
      compressor: { ...DSP_DEFAULTS.compressor, bands: [] },
    });
    expect(clamped.compressor.bands).toHaveLength(3);
  });
});

/**
 * The sanitiser must not eat the exciter's monitoring flag.
 *
 * Isolate is not meant to survive a restart, and the first attempt implemented
 * that by forcing it false inside `clampDspSettings`. That looked like the
 * right place and was not: this function runs on every patch AND on every
 * settings message the worklet receives, so the flag was stripped between the
 * button and the audio. The button lit, the settings object said true one line
 * earlier, and the mode did nothing whatsoever.
 *
 * Not persisting is a fact about STORAGE, so `readStored` drops it and nothing
 * else does. This is the test that tells those two apart.
 */
describe('exciter isolate survives sanitising', () => {
  it('keeps a true isolate flag', () => {
    const clamped = clampDspSettings({
      ...DSP_DEFAULTS,
      exciter: { ...DSP_DEFAULTS.exciter, isolate: true },
    });
    expect(clamped.exciter.isolate).toBe(true);
  });

  it('still defaults it off, and rejects a non-boolean', () => {
    expect(clampDspSettings(DSP_DEFAULTS).exciter.isolate).toBe(false);
    const nonsense = clampDspSettings({
      ...DSP_DEFAULTS,
      exciter: { ...DSP_DEFAULTS.exciter, isolate: 'yes' },
    });
    expect(nonsense.exciter.isolate).toBe(false);
  });
});

/**
 * The rack sizes, and the guarantee that moving between them is lossless.
 *
 * Reported as "switching bands loses the imported curve", and it was: each
 * change resampled the live rack, so every trip through a smaller size threw
 * away detail that the next larger size could not invent again.
 */
describe('EQ rack sizes', () => {
  it('offers the four sizes at their ISO centres', () => {
    expect(EQ_RACK_SIZES).toEqual([6, 10, 15, 31]);
    EQ_RACK_SIZES.forEach((size) => {
      expect(buildEqRack(size)).toHaveLength(size);
    });
  });

  /**
   * A shelf at 16 kHz delivers 3-6 dB of a requested 6, and one at 20 kHz
   * against a 44.1 kHz rate delivers almost nothing — the cookbook forces the
   * response flat at Nyquist. The graphic racks are bells throughout so no
   * control on them is a dial that moves and does nothing.
   */
  it('puts no shelf at the top of a graphic rack', () => {
    [6, 10, 31].forEach((size) => {
      expect(buildEqRack(size).every((band) => band.type === 'PK')).toBe(true);
    });
  });

  it('gives a denser rack a higher Q, as the spacing demands', () => {
    const ten = buildEqRack(10)[5].quality;
    const thirtyOne = buildEqRack(31)[15].quality;
    expect(thirtyOne).toBeGreaterThan(ten);
    // The standard octave relation: Q = 1 / (2^(n/2) - 2^(-n/2)).
    expect(ten).toBeCloseTo(1.41, 1);
    expect(thirtyOne).toBeCloseTo(4.32, 1);
  });

  it('keeps a stored rack at whatever length it was saved with', () => {
    const clamped = clampDspSettings({
      ...DSP_DEFAULTS,
      eq: { ...DSP_DEFAULTS.eq, bands: buildEqRack(31) },
    });
    expect(clamped.eq.bands).toHaveLength(31);
  });

  it('refuses to allocate past the CPU ceiling', () => {
    const clamped = clampDspSettings({
      ...DSP_DEFAULTS,
      eq: {
        ...DSP_DEFAULTS.eq,
        bands: Array.from({ length: EQ_MAX_BAND_COUNT + 40 }, () => ({
          enabled: true,
          type: 'PK',
          frequency: 1000,
          gainDb: 0,
          quality: 1,
        })),
      },
    });
    expect(clamped.eq.bands).toHaveLength(EQ_MAX_BAND_COUNT);
  });
});
