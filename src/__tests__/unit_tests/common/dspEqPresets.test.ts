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
  preampDb: 24,
  trimDb: -24,
  trimMode: 'off',
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
      const expected =
        preset.id === EQ_DEFAULT_PRESET_ID
          ? { ...setup, trimMode: 'off' as const }
          : setup;

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
          preampDb: result.preampDb,
          trimMode: result.trimMode,
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
          preampDb: expected.preampDb,
          trimMode: expected.trimMode,
        },
      });
      expect(`${preset.id}: stale trim cleared`).toBe(
        `${preset.id}: ${result.trimDb === 0 ? 'stale trim cleared' : 'failed'}`,
      );
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
});
