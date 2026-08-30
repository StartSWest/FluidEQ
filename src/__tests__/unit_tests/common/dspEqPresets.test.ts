/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  DSP_DEFAULTS,
  IEqSettings,
  buildEqRack,
  clampDspSettings,
} from '../../../common/dsp/chain';
import {
  EQ_DEFAULT_PRESET_ID,
  EQ_PRESETS,
  eqPresetSetup,
  eqSettingsForPreset,
} from '../../../common/dsp/eqPresets';
import {
  biquadCoefficients,
  biquadMagnitudeDb,
} from '../../../renderer/dsp/biquad';

/**
 * Every value is intentionally unlike the factory baseline. If a preset
 * application accidentally merges with the current rack, at least one of
 * these values survives and the all-presets contract below names the profile.
 */
const contaminatedEq = (): IEqSettings => ({
  ...DSP_DEFAULTS.eq,
  enabled: true,
  isolate: true,
  model: 'wide',
  modelAmount: 0.23,
  engine: 'parallel',
  phase: 'linear',
  stereo: 'side',
  monoBelowHz: 300,
  oversample: 4,
  subsonicHz: 40,
  fuzzAmount: 1,
  presetId: 'stale-profile',
  bands: buildEqRack(6).map((band, index) => ({
    ...band,
    enabled: index % 2 === 0,
    type: 'NO',
    frequency: band.frequency + 7,
    gainDb: 12,
    quality: 9,
    dynamic: true,
    thresholdDb: -3,
  })),
  sourceBands: buildEqRack(10),
});

describe('complete EQ factory presets', () => {
  it('assigns every global sound value for every preset', () => {
    EQ_PRESETS.forEach((preset) => {
      const result = eqSettingsForPreset(contaminatedEq(), preset);
      const setup = eqPresetSetup(preset);
      const expected = setup;

      expect({
        id: preset.id,
        actual: {
          model: result.model,
          modelAmount: result.modelAmount,
          engine: result.engine,
          phase: result.phase,
          stereo: result.stereo,
          monoBelowHz: result.monoBelowHz,
          oversample: result.oversample,
          subsonicHz: result.subsonicHz,
          fuzzAmount: result.fuzzAmount,
        },
      }).toEqual({
        id: preset.id,
        actual: {
          model: expected.model,
          modelAmount: expected.modelAmount,
          engine: expected.engine,
          phase: expected.phase,
          stereo: expected.stereo,
          monoBelowHz: expected.monoBelowHz,
          oversample: expected.oversample,
          subsonicHz: expected.subsonicHz,
          fuzzAmount: expected.fuzzAmount,
        },
      });
      expect(`${preset.id}: monitor cleared`).toBe(
        `${preset.id}: ${!result.isolate ? 'monitor cleared' : 'failed'}`,
      );
      expect(`${preset.id}: power retained`).toBe(
        `${preset.id}: ${result.enabled ? 'power retained' : 'failed'}`,
      );
    });
  });

  it('assigns every band shape and value for every preset', () => {
    EQ_PRESETS.forEach((preset) => {
      const result = eqSettingsForPreset(contaminatedEq(), preset);
      expect(`${preset.id}: band count ${result.bands.length}`).toBe(
        `${preset.id}: band count ${DSP_DEFAULTS.eq.bands.length}`,
      );

      result.bands.forEach((band, index) => {
        const canonical = DSP_DEFAULTS.eq.bands[index];
        const threshold = preset.dynamic?.[index] ?? null;
        expect({
          id: `${preset.id}:${index + 1}`,
          enabled: band.enabled,
          type: band.type,
          frequency: band.frequency,
          quality: band.quality,
          gainDb: band.gainDb,
          dynamic: band.dynamic,
          thresholdDb: band.thresholdDb,
        }).toEqual({
          id: `${preset.id}:${index + 1}`,
          enabled: canonical.enabled,
          type: canonical.type,
          frequency: canonical.frequency,
          quality: canonical.quality,
          gainDb: preset.gains[index],
          dynamic: threshold !== null,
          thresholdDb: threshold ?? canonical.thresholdDb,
        });
      });

      const expectedSource =
        preset.id === EQ_DEFAULT_PRESET_ID ? [] : result.bands;
      expect({ id: preset.id, sourceBands: result.sourceBands }).toEqual({
        id: preset.id,
        sourceBands: expectedSource,
      });
      expect(result.sourceBands).not.toBe(result.bands);
    });
  });

  it('produces settings accepted unchanged by the engine clamp', () => {
    EQ_PRESETS.forEach((preset) => {
      const result = eqSettingsForPreset(contaminatedEq(), preset);
      const clamped = clampDspSettings({ ...DSP_DEFAULTS, eq: result }).eq;
      expect({ id: preset.id, clamped }).toEqual({
        id: preset.id,
        clamped: result,
      });
    });
  });

  /**
   * The rule `eqPresets.ts` states about itself, enforced.
   *
   * These bands sit a third of an octave apart at the bottom, so their skirts
   * overlap and adjacent gains ADD. The largest band in a curve is therefore
   * not what the curve does: "bass boost" once had a largest band of +5 and
   * measured +12.15 dB summed at 69 Hz, and ten presets were past the limit
   * with none of them looking it. They were all rescaled — and then nothing
   * held them there, so five had drifted back over by the time this was
   * written. Only by a tenth of a decibel, which is exactly how a limit
   * without a test decays.
   *
   * Measured from the coefficients the engine actually builds, model and all,
   * because `wide` stacks 4-7 dB where `proportional` stacks under 2: widening
   * each skirt is widening the overlap.
   */
  it('keeps every summed curve under the +6 dB ceiling it claims', () => {
    const points = Array.from(
      { length: 400 },
      (_, index) => 20 * 1_000 ** (index / 399),
    );
    const peaks = EQ_PRESETS.map((preset) => {
      const result = eqSettingsForPreset(contaminatedEq(), preset);
      const setup = eqPresetSetup(preset);
      const peak = points.reduce((highest, hz) => {
        const summed = result.bands.reduce(
          (total, band) =>
            band.enabled
              ? total +
                biquadMagnitudeDb(
                  biquadCoefficients(
                    {
                      type: band.type as never,
                      frequency: band.frequency,
                      gainDb: band.gainDb,
                      quality: band.quality,
                    },
                    48_000,
                    setup.model,
                    setup.modelAmount,
                  ),
                  hz,
                  48_000,
                )
              : total,
          0,
        );
        return Math.max(highest, summed);
      }, Number.NEGATIVE_INFINITY);
      return { id: preset.id, over: peak > 6 };
    });
    expect(peaks.filter((one) => one.over)).toEqual([]);
  });

  /**
   * The positive control for the ceiling above.
   *
   * An empty list would also be what a broken measurement produced, and a
   * summing bug that always returned zero would pass the check silently. A
   * curve deliberately built past the limit has to be caught.
   */
  it('POSITIVE CONTROL: a curve over the ceiling is detected', () => {
    const loud = eqSettingsForPreset(contaminatedEq(), EQ_PRESETS[2]);
    const peak = loud.bands.reduce(
      (total, band) =>
        total +
        biquadMagnitudeDb(
          biquadCoefficients(
            {
              type: band.type as never,
              frequency: band.frequency,
              gainDb: band.gainDb * 4,
              quality: band.quality,
            },
            48_000,
            'wide',
            1,
          ),
          60,
          48_000,
        ),
      0,
    );
    expect(peak).toBeGreaterThan(6);
  });
});
